export const config = { runtime: "edge" };

const TARGET_BASE = (process.env.TARGET_DOMAIN || "").replace(/\/$/, "");

const SITE_HTML = `<!doctype html>
<html lang="fa" dir="rtl">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Simple Site</title>
  <style>
    :root {
      color-scheme: dark;
      font-family: Tahoma, Arial, sans-serif;
      background: #0f172a;
      color: #e5e7eb;
    }

    * {
      box-sizing: border-box;
    }

    body {
      min-height: 100vh;
      margin: 0;
      display: grid;
      place-items: center;
      padding: 24px;
      background:
        radial-gradient(circle at top right, rgba(56, 189, 248, 0.25), transparent 32rem),
        radial-gradient(circle at bottom left, rgba(168, 85, 247, 0.22), transparent 28rem),
        #0f172a;
    }

    main {
      width: min(720px, 100%);
      padding: 36px;
      border: 1px solid rgba(148, 163, 184, 0.22);
      border-radius: 28px;
      background: rgba(15, 23, 42, 0.78);
      box-shadow: 0 24px 80px rgba(0, 0, 0, 0.35);
      backdrop-filter: blur(18px);
      text-align: center;
    }

    h1 {
      margin: 0 0 14px;
      font-size: clamp(2rem, 5vw, 3.5rem);
      line-height: 1.15;
    }

    p {
      margin: 0 auto 24px;
      max-width: 560px;
      color: #cbd5e1;
      font-size: 1.05rem;
      line-height: 2;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 8px 14px;
      border-radius: 999px;
      background: rgba(14, 165, 233, 0.16);
      color: #7dd3fc;
      border: 1px solid rgba(125, 211, 252, 0.26);
      font-size: 0.92rem;
    }
  </style>
</head>
<body>
  <main>
    <span class="badge">/site</span>
    <h1>سایت ساده شما آماده است</h1>
    <p>
      این صفحه فقط روی مسیر <strong>/site</strong> نمایش داده می‌شود.
      همه مسیرهای دیگر بدون تغییر به دامنه تنظیم‌شده در <strong>TARGET_DOMAIN</strong> فوروارد می‌شوند.
    </p>
  </main>
</body>
</html>`;

const STRIP_HEADERS = new Set([
  "host",
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "forwarded",
  "x-forwarded-host",
  "x-forwarded-proto",
  "x-forwarded-port",
]);

function isSitePath(req) {
  try {
    const { pathname } = new URL(req.url);
    return pathname === "/site" || pathname === "/site/";
  } catch {
    return false;
  }
}

function siteResponse(method) {
  return new Response(method === "HEAD" ? null : SITE_HTML, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
}

export default async function handler(req) {
  if (isSitePath(req)) {
    return siteResponse(req.method);
  }

  if (!TARGET_BASE) {
    return new Response("Misconfigured: TARGET_DOMAIN is not set", { status: 500 });
  }

  try {
    const pathStart = req.url.indexOf("/", 8);
    const targetUrl =
      pathStart === -1 ? TARGET_BASE + "/" : TARGET_BASE + req.url.slice(pathStart);

    const out = new Headers();
    let clientIp = null;
    for (const [k, v] of req.headers) {
      if (STRIP_HEADERS.has(k)) continue;
      if (k.startsWith("x-vercel-")) continue;
      if (k === "x-real-ip") {
        clientIp = v;
        continue;
      }
      if (k === "x-forwarded-for") {
        if (!clientIp) clientIp = v;
        continue;
      }
      out.set(k, v);
    }
    if (clientIp) out.set("x-forwarded-for", clientIp);

    const method = req.method;
    const hasBody = method !== "GET" && method !== "HEAD";

    return await fetch(targetUrl, {
      method,
      headers: out,
      body: hasBody ? req.body : undefined,
      duplex: "half",
      redirect: "manual",
    });
  } catch (err) {
    console.error("relay error:", err);
    return new Response("Bad Gateway: Tunnel Failed", { status: 502 });
  }
}
