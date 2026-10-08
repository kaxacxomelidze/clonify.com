/**
 * Structural DOM edits made during capture (canvas → frames, video → poster, shell →
 * screenshot) must not touch the live page: React/Vue/Svelte still own those nodes and
 * crash on their next update ("removeChild … not a child of this node"), which swaps
 * the whole page for the framework error screen. Capture code only tags the node with
 * `data-clonyfy-defer` and stores the edit in `window.__clonyfyDeferred`; the edits are
 * applied here to the serialized snapshot instead.
 */
import * as parse5 from 'parse5';

export const DEFER_ATTR = 'data-clonyfy-defer';

export interface DeferredDomEdit {
  /** `replace` swaps the tagged element; `children` replaces its contents. */
  mode: 'replace' | 'children';
  html: string;
}

export type DeferredDomEdits = Record<string, DeferredDomEdit>;

interface P5Node {
  nodeName: string;
  attrs?: Array<{ name: string; value: string }>;
  childNodes?: P5Node[];
  parentNode?: P5Node | null;
  content?: P5Node;
}

function fragmentNodes(html: string, parent: P5Node): P5Node[] {
  const frag = parse5.parseFragment(String(html || '')) as unknown as P5Node;
  const nodes = frag.childNodes || [];
  for (const n of nodes) n.parentNode = parent;
  return nodes;
}

export function applyDeferredDomEdits(html: string, edits: DeferredDomEdits | null | undefined): string {
  const source = String(html || '');
  if (!edits || !Object.keys(edits).length || !source.includes(DEFER_ATTR)) return source;

  const doc = parse5.parse(source) as unknown as P5Node;
  let applied = 0;

  const visit = (node: P5Node) => {
    const kids = node.childNodes || [];
    for (let i = 0; i < kids.length; i++) {
      const child = kids[i];
      const attr = child.attrs?.find((a) => a.name === DEFER_ATTR);
      const edit = attr ? edits[attr.value] : undefined;
      if (attr && edit) {
        if (edit.mode === 'replace') {
          const replacement = fragmentNodes(edit.html, node);
          kids.splice(i, 1, ...replacement);
          i += replacement.length - 1;
          applied++;
          continue;
        }
        child.attrs = child.attrs!.filter((a) => a.name !== DEFER_ATTR);
        child.childNodes = fragmentNodes(edit.html, child);
        applied++;
        continue;
      }
      visit(child);
      if (child.content) visit(child.content);
    }
  };
  visit(doc);

  // Edits whose node vanished (re-render) leave stray markers — drop them.
  const out = applied ? parse5.serialize(doc as never) : source;
  return out.replace(/\sdata-clonyfy-defer="[^"]*"/g, '');
}
