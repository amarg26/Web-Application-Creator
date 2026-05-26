---
name: YouTube transcript fetching
description: How to fetch YouTube transcripts from the API server; what works and what doesn't from Replit.
---

## Rule
Use the `youtube-transcript` npm package in `@workspace/api-server`. It calls the unsigned timedtext endpoint which works from Replit's servers without session cookies.

**Why:** Three alternative approaches all fail from Replit's IP range:
1. `youtubei.js` `getTranscript()` — calls `/youtubei/v1/get_transcript` which returns 400 "Precondition check failed" (session auth required)
2. Signed timedtext URLs from `ytInitialPlayerResponse` — return 404 HTML (session auth required)
3. Custom scraping with consent cookies only — consent cookie alone insufficient; need a real YouTube user session

The `youtube-transcript` package uses the unsigned `/api/timedtext?v={id}&lang=en` endpoint which bypasses session requirements for public captioned videos.

**How to apply:**
- Import: `import { YoutubeTranscript } from "youtube-transcript"`
- Call: `YoutubeTranscript.fetchTranscript(videoId, { lang: "en" })`
- Returns: `{ text: string; duration: number; offset: number; lang: string }[]` — note `offset` and `duration` are in **milliseconds**, divide by 1000 for seconds
- Get the video title separately via oEmbed: `https://www.youtube.com/oembed?url=...&format=json`

## Debugging notes
- Shell `node -e "..."` with regex `/\\u0026/g` has backslash eaten by shell — in server TypeScript files this works fine since no shell escaping
- `youtubei.js` v17.0.1 `get_transcript` 400 is NOT a version mismatch — it's a session requirement that no client version fixes
- The `/next` Innertube API (200 ✓) and oEmbed (200 ✓) both work fine without auth from Replit
