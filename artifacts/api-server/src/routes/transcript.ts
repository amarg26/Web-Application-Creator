import { Router, type IRouter } from "express";
import { FetchTranscriptBody, FetchTranscriptResponse } from "@workspace/api-zod";

const router: IRouter = Router();

// ---------------------------------------------------------------------------
// Innertube client definitions — tried in order until one works
// ---------------------------------------------------------------------------

interface InnertubeClient {
  name: string;
  context: Record<string, unknown>;
  userAgent: string;
}

const INNERTUBE_CLIENTS: InnertubeClient[] = [
  {
    name: "ANDROID",
    context: { client: { clientName: "ANDROID", clientVersion: "20.10.38" } },
    userAgent: "com.google.android.youtube/20.10.38 (Linux; U; Android 14)",
  },
  {
    name: "ANDROID_TESTSUITE",
    context: { client: { clientName: "ANDROID_TESTSUITE", clientVersion: "1.9", androidSdkVersion: 31 } },
    userAgent: "com.google.android.youtube/1.9 (Linux; U; Android 11)",
  },
  {
    name: "IOS",
    context: { client: { clientName: "IOS", clientVersion: "19.45.4", deviceModel: "iPhone16,2", osVersion: "18.1.0.22B83" } },
    userAgent: "com.google.ios.youtube/19.45.4 (iPhone16,2; U; CPU iOS 18_1_0 like Mac OS X)",
  },
  {
    name: "WEB_EMBEDDED_PLAYER",
    context: {
      client: { clientName: "WEB_EMBEDDED_PLAYER", clientVersion: "1.20240101", clientScreen: "EMBED" },
      thirdParty: { embedUrl: "https://www.youtube.com" },
    },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  },
];

const INNERTUBE_URL = "https://www.youtube.com/youtubei/v1/player?prettyPrint=false";

const BROWSER_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";
const CONSENT_COOKIE = "CONSENT=YES+cb.20210328-17-p0.en+FX+667; SOCS=CAESEwgDEgk0NjI3OBI";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractVideoId(input: string): string | null {
  const trimmed = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;
  try {
    const url = new URL(trimmed);
    const v = url.searchParams.get("v");
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
    if (url.hostname === "youtu.be") {
      const id = url.pathname.slice(1).split("/")[0]!;
      if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }
    const pathMatch = url.pathname.match(/\/(?:shorts|embed|v)\/([a-zA-Z0-9_-]{11})/);
    if (pathMatch) return pathMatch[1]!;
  } catch { /* not a URL */ }
  return null;
}

interface CaptionTrack {
  baseUrl?: string;
  languageCode?: string;
  kind?: string;
}

interface PlayerResponse {
  videoDetails?: { title?: string; lengthSeconds?: string };
  captions?: { playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] } };
  playabilityStatus?: { status?: string; reason?: string };
}

/**
 * Parse a JSON object assigned to a variable in an inline script tag.
 * Properly handles brackets and quotes inside strings.
 */
function parseInlineJson(html: string, varName: string): PlayerResponse | null {
  const startToken = `var ${varName} = `;
  const startIndex = html.indexOf(startToken);
  if (startIndex === -1) return null;
  const jsonStart = startIndex + startToken.length;

  let i = jsonStart;
  let depth = 0;
  let inString = false;
  let escape = false;

  for (; i < html.length; i++) {
    const c = html[i]!;
    if (escape) { escape = false; continue; }
    if (c === "\\" && inString) { escape = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === "{" || c === "[") depth++;
    else if (c === "}" || c === "]") {
      depth--;
      if (depth === 0) break;
    }
  }

  try {
    return JSON.parse(html.slice(jsonStart, i + 1)) as PlayerResponse;
  } catch {
    return null;
  }
}

/** Parse YouTube transcript XML — handles both classic and srv3 formats */
function parseTranscriptXml(
  xml: string,
  lang: string
): Array<{ text: string; start: number; duration: number }> {
  const results: Array<{ text: string; start: number; duration: number }> = [];

  const pRegex = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
  let m: RegExpExecArray | null;
  while ((m = pRegex.exec(xml)) !== null) {
    const text = m[3]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (text) results.push({ text: decodeEntities(text), start: parseInt(m[1]!, 10) / 1000, duration: parseInt(m[2]!, 10) / 1000 });
  }
  if (results.length > 0) return results;

  const classicRegex = /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g;
  while ((m = classicRegex.exec(xml)) !== null) {
    const text = decodeEntities(m[3]!).replace(/\s+/g, " ").trim();
    if (text) results.push({ text, start: parseFloat(m[1]!), duration: parseFloat(m[2]!) });
  }
  return results;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'");
}

/**
 * Fetch the caption XML from a signed timedtext URL.
 * Tries multiple User-Agent strategies. Returns XML string on success, null on failure.
 */
async function fetchCaptionXml(
  captionUrl: string,
  videoId: string,
  extraCookies?: string
): Promise<string | null> {
  const cookieHeader = [CONSENT_COOKIE, extraCookies].filter(Boolean).join("; ");

  const strategies: Record<string, string>[] = [
    // Mobile Android UA — matches Innertube ANDROID context
    { "User-Agent": "com.google.android.youtube/20.10.38 (Linux; U; Android 14)" },
    // Browser UA with cookies + referer
    { "User-Agent": BROWSER_UA, "Cookie": cookieHeader, "Referer": `https://www.youtube.com/watch?v=${videoId}` },
    // iOS UA
    { "User-Agent": "com.google.ios.youtube/19.45.4 (iPhone16,2; U; CPU iOS 18_1_0 like Mac OS X)" },
    // Browser UA, no cookies
    { "User-Agent": BROWSER_UA, "Referer": `https://www.youtube.com/watch?v=${videoId}` },
  ];

  for (const headers of strategies) {
    try {
      const res = await fetch(captionUrl, { headers });
      if (!res.ok) continue;
      const body = await res.text();
      if (body && !body.trimStart().startsWith("<html") && !body.trimStart().startsWith("<!")) {
        return body;
      }
    } catch { /* try next */ }
  }
  return null;
}

/**
 * Fallback: fetch the YouTube watch page with browser headers + consent cookie,
 * capture the session cookies it sets, parse ytInitialPlayerResponse to get the
 * signed timedtext URL, then fetch it with those session cookies.
 * This bypasses Innertube IP blocks entirely.
 */
async function fetchViaHtmlScraping(
  videoId: string
): Promise<{ playerData: PlayerResponse; sessionCookies: string } | null> {
  try {
    const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        "User-Agent": BROWSER_UA,
        "Accept-Language": "en-US,en;q=0.9",
        "Cookie": CONSENT_COOKIE,
      },
    });

    if (!res.ok) return null;

    // Capture session cookies set by the page (needed for timedtext fetch)
    const setCookie = res.headers.getSetCookie?.() ?? [];
    const sessionCookies = setCookie.map((c) => c.split(";")[0]!).join("; ");

    const html = await res.text();
    if (html.includes('class="g-recaptcha"')) return null;
    if (!html.includes('"playabilityStatus":')) return null;

    const playerData = parseInlineJson(html, "ytInitialPlayerResponse");
    if (!playerData) return null;

    return { playerData, sessionCookies };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

router.post("/transcript", async (req, res) => {
  const parsed = FetchTranscriptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const videoId = extractVideoId(parsed.data.url);
  if (!videoId) {
    res.status(400).json({ error: "Could not extract a valid YouTube video ID from the provided URL." });
    return;
  }

  try {
    let playerData: PlayerResponse | null = null;
    let captionUrl: string | null = null;
    let sessionCookies: string | undefined;
    let lastBlockReason: string | null = null;

    // ── 1. Try Innertube API clients in sequence ─────────────────────────────
    for (const client of INNERTUBE_CLIENTS) {
      let resp: Response;
      try {
        resp = await fetch(INNERTUBE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", "User-Agent": client.userAgent },
          body: JSON.stringify({ context: client.context, videoId }),
        });
      } catch { continue; }

      if (!resp.ok) continue;

      const data = (await resp.json()) as PlayerResponse;
      const status = data.playabilityStatus?.status;

      // Any non-OK status is a per-client soft failure — try next client.
      // ERROR/UNPLAYABLE can be client-specific (not necessarily the video being unavailable).
      if (status !== "OK" && status !== "CONTENT_CHECK_REQUIRED") {
        lastBlockReason = data.playabilityStatus?.reason ?? status ?? "unknown";
        req.log.warn({ videoId, client: client.name, status, reason: lastBlockReason }, "Client blocked, trying next");
        continue;
      }

      const tracks = data.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (!Array.isArray(tracks) || tracks.length === 0) continue;

      playerData = data;
      req.log.info({ videoId, client: client.name }, "Innertube client succeeded");
      break;
    }

    // ── 2. HTML scraping fallback (bypasses Innertube IP blocks) ─────────────
    if (!playerData) {
      req.log.info({ videoId }, "All Innertube clients failed, trying HTML scraping");
      const scraped = await fetchViaHtmlScraping(videoId);

      if (scraped) {
        const tracks = scraped.playerData.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        if (Array.isArray(tracks) && tracks.length > 0) {
          playerData = scraped.playerData;
          sessionCookies = scraped.sessionCookies;
          req.log.info({ videoId }, "HTML scraping succeeded");
        }
      }
    }

    if (!playerData) {
      if (lastBlockReason) {
        res.status(503).json({
          error: "YouTube is temporarily blocking transcript access from this server. Please try again in a few minutes.",
        });
      } else {
        res.status(404).json({
          error: "This video does not have captions or transcripts available. Try a video with auto-generated or manual subtitles.",
        });
      }
      return;
    }

    // ── 3. Select the best English caption track ──────────────────────────────
    const captionTracks = playerData.captions!.playerCaptionsTracklistRenderer!.captionTracks!;
    const title = playerData.videoDetails?.title ?? `YouTube Video ${videoId}`;
    const durationSec = parseInt(playerData.videoDetails?.lengthSeconds ?? "0", 10);

    const track =
      captionTracks.find((t) => t.languageCode?.startsWith("en") && !t.kind) ??
      captionTracks.find((t) => t.languageCode?.startsWith("en")) ??
      captionTracks[0]!;

    if (!track.baseUrl) {
      res.status(404).json({ error: "Caption track has no URL." });
      return;
    }

    captionUrl = track.baseUrl;

    // ── 4. Fetch caption XML ─────────────────────────────────────────────────
    const captionXml = await fetchCaptionXml(captionUrl, videoId, sessionCookies);

    if (!captionXml) {
      res.status(503).json({
        error: "Could not retrieve the transcript content. YouTube may be temporarily blocking this server. Please try again in a moment.",
      });
      return;
    }

    // ── 5. Parse and respond ─────────────────────────────────────────────────
    const segments = parseTranscriptXml(captionXml, track.languageCode ?? "en");

    if (segments.length === 0) {
      res.status(404).json({ error: "No transcript content found for this video." });
      return;
    }

    const transcript = segments.map((s) => s.text).join(" ").replace(/\s+/g, " ").trim();
    const wordCount = transcript.split(/\s+/).filter(Boolean).length;
    const lastSeg = segments[segments.length - 1]!;
    const duration = durationSec > 0 ? durationSec : lastSeg.start + lastSeg.duration;

    const data = FetchTranscriptResponse.parse({ videoId, title, transcript, segments, wordCount, duration });
    res.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    req.log.error({ err, videoId }, "Failed to fetch transcript");

    if (message.toLowerCase().includes("unavailable")) {
      res.status(404).json({ error: message });
      return;
    }

    res.status(500).json({
      error: "Failed to fetch transcript. The video may be private, age-restricted, or unavailable.",
    });
  }
});

export default router;
