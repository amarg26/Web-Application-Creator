/**
 * Cloudflare Worker — YouTube Innertube proxy
 *
 * Deploy this at: https://workers.cloudflare.com (free, no credit card)
 * Free tier: 100,000 requests/day
 *
 * After deploying, copy the worker URL (e.g. https://yt-proxy.YOUR-NAME.workers.dev)
 * and add it as the YT_PROXY_URL secret in your Replit project.
 */

const ANDROID_UA = "com.google.android.youtube/20.10.38 (Linux; U; Android 14)";
const CONSENT_COOKIE = "CONSENT=YES+cb; SOCS=CAI=";
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const action = url.pathname.replace(/^\//, "");

    try {
      if (action === "player") {
        return await proxyPlayer(request);
      }
      if (action === "timedtext") {
        return await proxyTimedtext(request);
      }
      return new Response("Not Found", { status: 404, headers: CORS_HEADERS });
    } catch (err) {
      return new Response(JSON.stringify({ error: String(err) }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }
  },
};

/** POST /player — proxy a YouTube Innertube player request */
/** POST /player — proxy a YouTube Innertube player request */
async function proxyPlayer(request) {
  const body = await request.text();
  const ytResp = await fetch(
    "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": BROWSER_UA,
        "Origin": "https://www.youtube.com",
        "Referer": "https://www.youtube.com/embed/" + JSON.parse(body).videoId,
      },
      body,
    }
  );
  const data = await ytResp.text();
  return new Response(data, {
    status: ytResp.status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

/** POST /timedtext — proxy a YouTube timedtext URL fetch */
async function proxyTimedtext(request) {
  const { url: timedtextUrl, videoId } = await request.json();
  if (!timedtextUrl) {
    return new Response(JSON.stringify({ error: "url required" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const ytResp = await fetch(timedtextUrl, {
    headers: {
      "User-Agent": ANDROID_UA,
      "Referer": `https://www.youtube.com/watch?v=${videoId ?? ""}`,
      "Cookie": CONSENT_COOKIE,
    },
  });
  const xml = await ytResp.text();
  return new Response(xml, {
    status: ytResp.status,
    headers: { ...CORS_HEADERS, "Content-Type": "text/xml" },
  });
}
