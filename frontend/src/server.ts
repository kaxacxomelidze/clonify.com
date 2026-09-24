import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!isH3SwallowedErrorBody(body)) return response;

  console.error(consumeLastCapturedError() ?? new Error(`h3 swallowed SSR error: ${body}`));
  return new Response(renderErrorPage(), {
    status: 500,
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

function isH3SwallowedErrorBody(body: string): boolean {
  try {
    const payload = JSON.parse(body) as { unhandled?: unknown; message?: unknown };
    return payload.unhandled === true && payload.message === "HTTPError";
  } catch {
    return false;
  }
}

// HEAD requests (uptime monitors, Cloudflare scanners) start a full SSR stream
// whose body nobody reads, so it hangs until the router's 120s lifetime cleanup.
// Render as GET, drain the body so the stream finishes, and return headers only.
async function toHeadResponse(response: Response): Promise<Response> {
  const bytes = response.body ? (await response.arrayBuffer()).byteLength : 0;
  const headers = new Headers(response.headers);
  headers.set("content-length", String(bytes));
  return new Response(null, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    const isHead = request.method === "HEAD";
    try {
      const handler = await getServerEntry();
      // srvx hands us its own request class, which undici's `new Request(req, init)`
      // can't clone — rebuild the GET from url + headers instead.
      const ssrRequest = isHead
        ? new Request(request.url, { method: "GET", headers: new Headers(request.headers) })
        : request;
      const response = await normalizeCatastrophicSsrResponse(
        await handler.fetch(ssrRequest, env, ctx),
      );
      return isHead ? await toHeadResponse(response) : response;
    } catch (error) {
      console.error(error);
      return new Response(isHead ? null : renderErrorPage(), {
        status: 500,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};
