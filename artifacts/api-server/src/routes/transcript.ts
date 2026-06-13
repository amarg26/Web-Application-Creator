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
  // ANDROID test suite — minimal client, rarely rate-limited from server IPs
  {
    name: "ANDROID_TESTSUITE",
    context: {
      client: {
        clientName: "ANDROID_TESTSUITE",
        clientVersion: "1.9",
        androidSdkVersion: 31,
      },
    },
    userAgent: "com.google.android.youtube/1.9 (Linux; U; Android 11)",
  },
  // IOS client — Apple mobile path, different bot-detection than Android
  {
    name: "IOS",
    context: {
      client: {
        clientName: "IOS",
        clientVersion: "19.45.4",
        deviceModel: "iPhone16,2",
        osVersion: "18.1.0.22B83",
      },
    },
    userAgent:
      "com.google.ios.youtube/19.45.4 (iPhone16,2; U; CPU iOS 18_1_0 like Mac OS X)",
  },
  // ANDROID — standard mobile client
  {
    name: "ANDROID",
    context: {
      client: {
        clientName: "ANDROID",
        clientVersion: "20.10.38",
      },
    },
    userAgent: "com.google.android.youtube/20.10.38 (Linux; U; Android 14)",
  },
  // WEB_EMBEDDED_PLAYER — embedded web player, different quota/tracking
  {
    name: "WEB_EMBEDDED_PLAYER",
    context: {
      client: {
        clientName: "WEB_EMBEDDED_PLAYER",
        clientVersion: "1.20240101",
        clientScreen: "EMBED",
      },
      thirdParty: { embedUrl: "https://www.youtube.com" },
    },
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  },
];

const INNERTUBE_URL =
  "https://www.youtube.com/youtubei/v1/player?prettyPrint=false";

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
    const pathMatch = url.pathname.match(
      /\/(?:shorts|embed|v)\/([a-zA-Z0-9_-]{11})/
    );
    if (pathMatch) return pathMatch[1]!;
  } catch {
    /* not a URL */
  }
  return null;
}

interface CaptionTrack {
  baseUrl?: string;
  languageCode?: string;
  kind?: string;
}

interface PlayerResponse {
  videoDetails?: { title?: string; lengthSeconds?: string };
  captions?: {
    playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] };
  };
  playabilityStatus?: { status?: string; reason?: string };
}

/** Parse YouTube transcript XML — handles both classic and srv3 formats */
function parseTranscriptXml(
  xml: string,
  lang: string
): Array<{ text: string; start: number; duration: number }> {
  const results: Array<{ text: string; start: number; duration: number }> = [];

  // srv3 format: <p t="ms" d="ms"><s>word</s>...</p>
  const pRegex = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
  let m: RegExpExecArray | null;
  while ((m = pRegex.exec(xml)) !== null) {
    const text = m[3]!
      .replace(/<[^>]+>/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (text)
      results.push({
        text: decodeEntities(text),
        start: parseInt(m[1]!, 10) / 1000,
        duration: parseInt(m[2]!, 10) / 1000,
      });
  }
  if (results.length > 0) return results;

  // Classic format: <text start="s" dur="s">content</text>
  const classicRegex =
    /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g;
  while ((m = classicRegex.exec(xml)) !== null) {
    const text = decodeEntities(m[3]!)
      .replace(/\s+/g, " ")
      .trim();
    if (text)
      results.push({
        text,
        start: parseFloat(m[1]!),
        duration: parseFloat(m[2]!),
      });
  }
  return results;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

/**
 * Fetch captions from a timedtext URL, trying multiple User-Agent strategies.
 * Returns the XML body string on success, or null if all attempts fail.
 */
async function fetchCaptionXml(
  captionUrl: string,
  videoId: string
): Promise<string | null> {
  const strategies = [
    // Android client UA — matches the Innertube context
    {
      "User-Agent":
        "com.google.android.youtube/20.10.38 (Linux; U; Android 14)",
    },
    // Browser UA with consent cookie
    {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      Cookie:
        "CONSENT=YES+cb.20210328-17-p0.en+FX+667; SOCS=CAESEwgDEgk0NjI3OBI",
      Referer: `https://www.youtube.com/watch?v=${videoId}`,
    },
    // Browser UA, no cookie
    {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      Referer: `https://www.youtube.com/watch?v=${videoId}`,
    },
  ];

  for (const headers of strategies) {
    try {
      const res = await fetch(captionUrl, { headers });
      if (!res.ok) continue;
      const body = await res.text();
      if (
        body &&
        !body.trimStart().startsWith("<html") &&
        !body.trimStart().startsWith("<!")
      ) {
        return body;
      }
    } catch {
      /* try next strategy */
    }
  }
  return null;
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
    res.status(400).json({
      error:
        "Could not extract a valid YouTube video ID from the provided URL.",
    });
    return;
  }

  try {
    // ── 1. Try Innertube clients in sequence until one returns captions ───────
    let playerData: PlayerResponse | null = null;
    let lastBlockReason: string | null = null;

    for (const client of INNERTUBE_CLIENTS) {
      let resp: Response;
      try {
        resp = await fetch(INNERTUBE_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": client.userAgent,
          },
          body: JSON.stringify({ context: client.context, videoId }),
        });
      } catch {
        continue;
      }

      if (!resp.ok) continue;

      const data = (await resp.json()) as PlayerResponse;
      const status = data.playabilityStatus?.status;

      // Hard failure: ERROR means video ID is invalid or video was deleted
      if (status === "ERROR") {
        const reason = data.playabilityStatus?.reason ?? status;
        res.status(404).json({ error: `Video unavailable: ${reason}` });
        return;
      }

      // Soft failure: client was blocked or unsupported — try next client
      // UNPLAYABLE can mean the *client app* is unsupported, not the video
      if (status !== "OK" && status !== "CONTENT_CHECK_REQUIRED") {
        lastBlockReason = data.playabilityStatus?.reason ?? status ?? "unknown";
        req.log.warn(
          { videoId, client: client.name, status, reason: lastBlockReason },
          "Client blocked or unsupported, trying next"
        );
        continue;
      }

      // Check we actually got caption tracks before accepting this response
      const tracks =
        data.captions?.playerCaptionsTracklistRenderer?.captionTracks;
      if (!Array.isArray(tracks) || tracks.length === 0) {
        // No captions with this client; try next (might have them)
        continue;
      }

      playerData = data;
      req.log.info(
        { videoId, client: client.name },
        "Innertube client succeeded"
      );
      break;
    }

    if (!playerData) {
      if (lastBlockReason) {
        res.status(503).json({
          error:
            "YouTube is requiring sign-in for this video from this server's IP. " +
            "This usually resolves itself — please try again in a few minutes.",
        });
      } else {
        res.status(404).json({
          error:
            "This video does not have captions or transcripts available. " +
            "Try a video with auto-generated or manual subtitles.",
        });
      }
      return;
    }

    // ── 2. Extract metadata ──────────────────────────────────────────────────
    const title =
      playerData.videoDetails?.title ?? `YouTube Video ${videoId}`;
    const durationSec = parseInt(
      playerData.videoDetails?.lengthSeconds ?? "0",
      10
    );
    const captionTracks =
      playerData.captions!.playerCaptionsTracklistRenderer!.captionTracks!;

    // ── 3. Select the best English track ────────────────────────────────────
    const track =
      captionTracks.find((t) => t.languageCode?.startsWith("en") && !t.kind) ??
      captionTracks.find((t) => t.languageCode?.startsWith("en")) ??
      captionTracks[0]!;

    if (!track.baseUrl) {
      res.status(404).json({ error: "Caption track has no URL." });
      return;
    }

    // ── 4. Fetch caption XML ─────────────────────────────────────────────────
    const captionXml = await fetchCaptionXml(track.baseUrl, videoId);

    if (!captionXml) {
      res.status(503).json({
        error:
          "Could not retrieve the transcript content. YouTube may be temporarily blocking this server. Please try again in a moment.",
      });
      return;
    }

    // ── 5. Parse and return ──────────────────────────────────────────────────
    const segments = parseTranscriptXml(captionXml, track.languageCode ?? "en");

    if (segments.length === 0) {
      res
        .status(404)
        .json({ error: "No transcript content found for this video." });
      return;
    }

    const transcript = segments
      .map((s) => s.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    const wordCount = transcript.split(/\s+/).filter(Boolean).length;
    const lastSeg = segments[segments.length - 1]!;
    const duration =
      durationSec > 0 ? durationSec : lastSeg.start + lastSeg.duration;

    const data = FetchTranscriptResponse.parse({
      videoId,
      title,
      transcript,
      segments,
      wordCount,
      duration,
    });

    res.json(data);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    req.log.error({ err, videoId }, "Failed to fetch transcript");

    if (message.toLowerCase().includes("unavailable")) {
      res.status(404).json({ error: message });
      return;
    }

    res.status(500).json({
      error:
        "Failed to fetch transcript. The video may be private, age-restricted, or unavailable.",
    });
  }
});

export default router;
