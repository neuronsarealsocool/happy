const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".wasm": "application/wasm",
};

function contentType(pathname) {
  const match = pathname.match(/\.[^.\/]+$/);
  return match ? MIME_TYPES[match[0].toLowerCase()] : undefined;
}

async function fromAssets(env, request, pathname) {
  const url = new URL(request.url);
  url.pathname = pathname;
  const response = await env.ASSETS.fetch(new Request(url, request));
  if (response.status !== 404) {
    const headers = new Headers(response.headers);
    const type = contentType(pathname);
    if (type) {
      headers.set("content-type", type);
    }
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  }
  return null;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const direct = await fromAssets(env, request, url.pathname);
    if (direct) {
      return direct;
    }
    return fromAssets(env, request, "/index.html");
  },
};
