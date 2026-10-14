/**
 * Runs Clonyfy's own preview scripts on the Studio canvas.
 *
 * The editor page carries the same Clonyfy scripts as the preview (animation runtime:
 * canvas frame playback, logo marquees, entrance animations, revived CSS loops; the
 * visibility patch), but its iframe is sandboxed without scripts so the site's code can
 * never run. This host executes exactly those scripts from the editor, against the iframe
 * document — no re-implementation, so the canvas behaves like the preview.
 *
 * Everything the scripts change is recorded (attributes, text, added/removed nodes).
 * `withOriginals()` puts the page back to its captured state for serialization (save,
 * export, undo snapshots, source view) and then restores the live state, so an
 * animation frame is never saved. Elements the user edits are handed over (`own`): the
 * scripts can no longer change them, so an edit is never overwritten.
 */

const RUNTIME_SCRIPTS =
  "script[data-clonyfy-animation-runtime], script#__clonyfy_visibility_script__";
/** "Already installed" guards the scripts set on window. */
const GUARDS = ["__clonyfyAnimRuntime"];

export type RuntimeHost = {
  /** Serialize/inspect the page without the scripts' changes, then put them back. */
  withOriginals<T>(fn: () => T): T;
  /** Run DOM changes that belong to neither the user nor the scripts (e.g. the scroll replay). */
  quiet<T>(fn: () => T): T;
  /** The user edits `el`: the scripts may no longer change it. */
  own(el: Element | null): void;
  /** Nodes the scripts added (marquee copies…) — not part of the page. */
  isRuntimeNode(node: Node): boolean;
  /** Stop the scripts and put the page back to its captured state. */
  destroy(): void;
};

type AnyFn = (...args: unknown[]) => unknown;
type Win = Window & typeof globalThis;

export function startRuntimeHost(doc: Document): RuntimeHost | null {
  const win = doc.defaultView as Win | null;
  if (!win || !doc.documentElement) return null;
  const sources = Array.from(doc.querySelectorAll<HTMLScriptElement>(RUNTIME_SCRIPTS))
    .map((s) => s.textContent || "")
    .filter((s) => s.trim());
  if (!sources.length) return null;
  const P = window as Win; // the editor's own realm: timers and observers that always run

  /* ------------------------------------------------------- change record */

  const attrOrig = new Map<Element, Map<string, string | null>>();
  const textOrig = new Map<CharacterData, string | null>();
  const added = new Set<Node>();
  const removed: Array<{ node: Node; parent: Node; next: Node | null }> = [];
  const owned = new WeakSet<Element>();
  let depth = 0; // inside a script turn
  let quietDepth = 0;
  let dead = false;

  const insideAdded = (n: Node | null) => {
    for (let x = n; x; x = x.parentNode) if (added.has(x)) return true;
    return false;
  };
  const ownedNode = (n: Node | null) => {
    for (let x = n; x; x = x.parentNode)
      if (x.nodeType === 1 && owned.has(x as Element)) return true;
    return false;
  };
  const setAttr = (el: Element, name: string, v: string | null) => {
    try {
      if (v === null) el.removeAttribute(name);
      else el.setAttribute(name, v);
    } catch {
      /* invalid name */
    }
  };

  /** Changes made by the user/editor: the user's value wins over the captured one. */
  const onUser = (recs: MutationRecord[]) => {
    if (quietDepth > 0) return;
    for (const r of recs) {
      if (r.type === "attributes") attrOrig.get(r.target as Element)?.delete(r.attributeName!);
      else if (r.type === "characterData") textOrig.delete(r.target as CharacterData);
    }
  };
  const record = (r: MutationRecord) => {
    if (r.type === "attributes") {
      const el = r.target as Element;
      if (insideAdded(el)) return;
      let m = attrOrig.get(el);
      if (!m) attrOrig.set(el, (m = new Map()));
      if (!m.has(r.attributeName!)) m.set(r.attributeName!, r.oldValue);
    } else if (r.type === "characterData") {
      const t = r.target as CharacterData;
      if (!insideAdded(t) && !textOrig.has(t)) textOrig.set(t, r.oldValue);
    } else {
      const inAdded = insideAdded(r.target);
      r.removedNodes.forEach((n) => {
        if (added.has(n)) added.delete(n);
        else if (!inAdded) removed.push({ node: n, parent: r.target, next: r.nextSibling });
      });
      if (!inAdded) r.addedNodes.forEach((n) => added.add(n));
    }
  };
  /** Undo a script change to something the user owns. */
  const undoRecord = (r: MutationRecord) => {
    if (r.type === "attributes") setAttr(r.target as Element, r.attributeName!, r.oldValue);
    else if (r.type === "characterData") (r.target as CharacterData).data = r.oldValue ?? "";
    else {
      r.addedNodes.forEach((n) => n.parentNode?.removeChild(n));
      r.removedNodes.forEach((n) => {
        const next = r.nextSibling && r.nextSibling.parentNode === r.target ? r.nextSibling : null;
        r.target.insertBefore(n, next);
      });
    }
  };

  const mo = new P.MutationObserver(onUser);
  mo.observe(doc, {
    subtree: true,
    attributes: true,
    attributeOldValue: true,
    childList: true,
    characterData: true,
    characterDataOldValue: true,
  });

  const endTurn = () => {
    const recs = mo.takeRecords();
    const frozen: MutationRecord[] = [];
    for (const r of recs) {
      const blocked =
        r.type === "attributes" ? owned.has(r.target as Element) : ownedNode(r.target);
      if (blocked) frozen.push(r);
      else record(r);
    }
    if (frozen.length) {
      for (let i = frozen.length - 1; i >= 0; i--) undoRecord(frozen[i]!);
      mo.takeRecords();
    }
  };
  /** Wrap a script callback so its DOM changes are recorded as the scripts'. */
  const turn = <F extends AnyFn>(fn: F) =>
    function (this: unknown, ...args: unknown[]) {
      if (dead) return undefined;
      if (depth === 0) onUser(mo.takeRecords());
      depth++;
      try {
        return fn.apply(this, args);
      } catch {
        return undefined;
      } finally {
        depth--;
        if (depth === 0) endTurn();
      }
    };

  /* ------------------------------------------------- the scripts' globals */

  const timeouts = new Set<number>();
  const intervals = new Set<number>();
  const frames = new Set<number>();
  const observers: Array<{ disconnect(): void }> = [];
  const observerOf = (Ctor: unknown) =>
    Ctor
      ? function (cb: AnyFn, options?: unknown) {
          const o = new (Ctor as new (cb: AnyFn, o?: unknown) => { disconnect(): void })(
            turn(cb),
            options,
          );
          observers.push(o);
          return o;
        }
      : undefined;
  const overrides: Record<string, unknown> = {
    setTimeout: (fn: unknown, ms?: number, ...args: unknown[]) => {
      if (typeof fn !== "function" || dead) return 0;
      const id: number = P.setTimeout(() => {
        timeouts.delete(id);
        turn(fn as AnyFn)(...args);
      }, ms);
      timeouts.add(id);
      return id;
    },
    clearTimeout: (id: number) => {
      P.clearTimeout(id);
      timeouts.delete(id);
    },
    setInterval: (fn: unknown, ms?: number, ...args: unknown[]) => {
      if (typeof fn !== "function" || dead) return 0;
      const id: number = P.setInterval(() => turn(fn as AnyFn)(...args), ms);
      intervals.add(id);
      return id;
    },
    clearInterval: (id: number) => {
      P.clearInterval(id);
      intervals.delete(id);
    },
    requestAnimationFrame: (fn: unknown) => {
      if (typeof fn !== "function" || dead) return 0;
      const id: number = P.requestAnimationFrame((t) => {
        frames.delete(id);
        turn(fn as AnyFn)(t);
      });
      frames.add(id);
      return id;
    },
    cancelAnimationFrame: (id: number) => {
      P.cancelAnimationFrame(id);
      frames.delete(id);
    },
    IntersectionObserver: observerOf(P.IntersectionObserver),
    MutationObserver: observerOf(P.MutationObserver),
    ResizeObserver: observerOf(P.ResizeObserver),
  };
  // `window`, `document`, timers… resolve to the canvas; timers/observers run in the editor.
  const scope: object = new Proxy(Object.create(null) as object, {
    has: (_, k) => typeof k === "string" && (k in overrides || k in win),
    get: (_, k) => {
      if (typeof k !== "string") return undefined;
      if (k === "window" || k === "self" || k === "globalThis" || k === "top" || k === "parent")
        return scope;
      if (k in overrides) return overrides[k];
      const v = Reflect.get(win, k) as unknown;
      return typeof v === "function" && /^[a-z]/.test(k) ? (v as AnyFn).bind(win) : v;
    },
    set: (_, k, v) => {
      Reflect.set(win, k, v);
      return true;
    },
  });

  // Listeners the scripts add (scroll, animationend…) run as script turns too.
  const proto = win.EventTarget.prototype;
  const nativeAdd = proto.addEventListener;
  const nativeRemove = proto.removeEventListener;
  const wrapped = new WeakMap<object, EventListener>();
  const listeners: Array<[EventTarget, string, EventListener, unknown]> = [];
  proto.addEventListener = function (this: EventTarget, type: string, l: unknown, o?: unknown) {
    if (depth > 0 && !dead && typeof l === "function") {
      let w = wrapped.get(l);
      if (!w) wrapped.set(l, (w = turn(l as AnyFn) as EventListener));
      listeners.push([this, type, w, o]);
      return nativeAdd.call(this, type, w, o as AddEventListenerOptions);
    }
    return nativeAdd.call(this, type, l as EventListener, o as AddEventListenerOptions);
  } as typeof proto.addEventListener;
  proto.removeEventListener = function (this: EventTarget, type: string, l: unknown, o?: unknown) {
    const w = l && typeof l === "object" ? undefined : wrapped.get(l as object);
    if (w) nativeRemove.call(this, type, w, o as EventListenerOptions);
    return nativeRemove.call(this, type, l as EventListener, o as EventListenerOptions);
  } as typeof proto.removeEventListener;

  /* --------------------------------------------------------------- run */

  const w = win as unknown as Record<string, unknown>;
  for (const g of GUARDS) delete w[g];
  // The scroll timeline is played by the scroll replay, which also maps layers to it.
  w["__clonyfyScrollTimeline"] = true;
  turn(() => {
    for (const src of sources) {
      try {
        new P.Function("__scope", `with(__scope){${src}\n}`)(scope);
      } catch {
        /* a failing script must not break the editor */
      }
    }
  })();

  /* ------------------------------------------------------------- API */

  const quiet = <T>(fn: () => T): T => {
    if (quietDepth === 0 && !dead) onUser(mo.takeRecords());
    quietDepth++;
    try {
      return fn();
    } finally {
      quietDepth--;
      if (quietDepth === 0) mo.takeRecords();
    }
  };

  /** Put the captured state back; returns how to restore the live state. */
  const revert = () => {
    const inverse: Array<() => void> = [];
    for (const n of added) {
      const parent = n.parentNode;
      if (!parent) continue;
      const next = n.nextSibling;
      parent.removeChild(n);
      inverse.push(() => parent.insertBefore(n, next && next.parentNode === parent ? next : null));
    }
    for (let i = removed.length - 1; i >= 0; i--) {
      const { node, parent, next } = removed[i]!;
      if (node.parentNode) continue; // the user put it somewhere else
      parent.insertBefore(node, next && next.parentNode === parent ? next : null);
      inverse.push(() => node.parentNode?.removeChild(node));
    }
    for (const [el, m] of attrOrig) {
      for (const [name, v] of m) {
        const now = el.getAttribute(name);
        if (now === v) continue;
        setAttr(el, name, v);
        inverse.push(() => setAttr(el, name, now));
      }
    }
    for (const [t, v] of textOrig) {
      const now = t.data;
      t.data = v ?? "";
      inverse.push(() => (t.data = now));
    }
    return () => {
      for (let i = inverse.length - 1; i >= 0; i--) inverse[i]!();
    };
  };

  return {
    withOriginals: <T>(fn: () => T): T => {
      if (dead) return fn();
      return quiet(() => {
        const restore = revert();
        try {
          return fn();
        } finally {
          restore();
        }
      });
    },
    quiet,
    own(el) {
      if (el) owned.add(el);
    },
    isRuntimeNode: (n) => insideAdded(n),
    destroy() {
      if (dead) return;
      quiet(() => revert());
      dead = true;
      timeouts.forEach((id) => P.clearTimeout(id));
      intervals.forEach((id) => P.clearInterval(id));
      frames.forEach((id) => P.cancelAnimationFrame(id));
      observers.forEach((o) => o.disconnect());
      for (const [target, type, l, o] of listeners)
        nativeRemove.call(target, type, l, o as EventListenerOptions);
      proto.addEventListener = nativeAdd;
      proto.removeEventListener = nativeRemove;
      mo.disconnect();
      attrOrig.clear();
      textOrig.clear();
      added.clear();
      removed.length = 0;
    },
  };
}
