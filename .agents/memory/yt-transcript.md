---
name: YouTube transcript fetching
description: How YouTube transcript extraction works in this project and why it fails in production; the Cloudflare Worker proxy fix.
---

## The core problem

Replit deploys to GCP Cloud Run. YouTube has blacklisted GCP Cloud Run IP ranges for unauthenticated transcript/caption access. Every server-side approach fails from production:
- All Innertube clients (ANDROID, IOS, WEB_EMBEDDED_PLAYER, TV, VR, Music, Creator) → LOGIN_REQUIRED or ERROR
- Public unsigned timedtext API (`/api/timedtext?v=...&lang=en`) → HTTP 200, empty body
- HTML scraping → watch page fetches fine (1MB), but `ytInitialPlayerResponse` has `status=LOGIN_REQUIRED` with no `captionTracks`
- Invidious/Piped API → metadata works, caption content fetch returns empty body
- yt-dlp subprocess → uses same ANDROID Innertube API, same IP block

**Why:** YouTube's bot detection uses IP reputation. GCP Cloud Run IPs are flagged. Adding more client context fields (androidSdkVersion, osName, gl, hl, etc.) does NOT help — it's IP-based.

## The fix

Route all YouTube API calls through a **Cloudflare Worker** (`artifacts/yt-proxy-worker/worker.js`). Cloudflare's edge IPs are not on YouTube's blocklist.

Set `YT_PROXY_URL` secret in Replit to the deployed Worker URL. The transcript route in `artifacts/api-server/src/routes/transcript.ts` reads `process.env["YT_PROXY_URL"]` and routes through the proxy when set. See `artifacts/yt-proxy-worker/README.md` for 5-step deploy instructions (free, no credit card).

Worker endpoints:
- `POST /player` — proxies Innertube player API calls
- `POST /timedtext` — proxies signed timedtext URL fetches

## Dev vs production

In dev (Replit dev IPs are NOT blocked):
- `ANDROID` client with full context returns `status=OK` with `captionTracks`.

In production without proxy: all clients fail → all fallbacks fail → 503.

## Fallback chain (in transcript.ts)

1. Innertube clients (4 clients — via proxy if `YT_PROXY_URL` set, direct otherwise)
2. Public unsigned timedtext API
3. HTML scraping with session cookie forwarding
4. 503 if all fail

## Old note (now superseded)

Previously: `youtube-transcript` npm package used the unsigned timedtext endpoint, which also now returns empty body from GCP IPs. Do not use it.
