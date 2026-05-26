import { Router, type IRouter } from "express";
import { FetchTranscriptBody, FetchTranscriptResponse } from "@workspace/api-zod";

const router: IRouter = Router();

// YouTube ANDROID Innertube client — not IP-restricted like web clients
const ANDROID_CLIENT_VERSION = "20.10.38";
const ANDROID_USER_AGENT = `com.google.android.youtube/${ANDROID_CLIENT_VERSION} (Linux; U; Android 14)`;
const INNERTUBE_CONTEXT = {
  client: {
    clientName: "ANDROID",
    clientVersion: ANDROID_CLIENT_VERSION,
  },
};

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

/** Parse YouTube transcript XML — handles both classic and srv3 formats */
function parseTranscriptXml(xml: string, lang: string): Array<{ text: string; start: number; duration: number }> {
  const results: Array<{ text: string; start: number; duration: number }> = [];

  // srv3 format: <p t="ms" d="ms"><s>word</s>...</p>
  const pRegex = /<p\s+t="(\d+)"\s+d="(\d+)"[^>]*>([\s\S]*?)<\/p>/g;
  let m: RegExpExecArray | null;
  while ((m = pRegex.exec(xml)) !== null) {
    const text = m[3]!.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
    if (text) results.push({ text: decodeEntities(text), start: parseInt(m[1]!, 10) / 1000, duration: parseInt(m[2]!, 10) / 1000 });
  }
  if (results.length > 0) return results;

  // Classic format: <text start="s" dur="s">content</text>
  const classicRegex = /<text start="([^"]*)" dur="([^"]*)">([^<]*)<\/text>/g;
  while ((m = classicRegex.exec(xml)) !== null) {
    const text = decodeEntities(m[3]!).replace(/\s+/g, " ").trim();
    if (text) results.push({ text, start: parseFloat(m[1]!), duration: parseFloat(m[2]!) });
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
async function fetchCaptionXml(captionUrl: string, videoId: string): Promise<string | null> {
  const strategies = [
    // 1. Android client UA — matches the Innertube context we used to get the URL
    { "User-Agent": ANDROID_USER_AGENT },
    // 2. Browser UA with consent cookie — bypasses GDPR consent page
    {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      "Cookie": "CONSENT=YES+cb.20210328-17-p0.en+FX+667; SOCS=CAESEwgDEgk0NjI3OBI",
      "Referer": `https://www.youtube.com/watch?v=${videoId}`,
    },
    // 3. Browser UA, no cookie
    {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
      "Referer": `https://www.youtube.com/watch?v=${videoId}`,
    },
  ];

  for (const headers of strategies) {
    try {
      const res = await fetch(captionUrl, { headers });
      if (!res.ok) continue;
      const body = await res.text();
      // Reject if we got an HTML page instead of XML
      if (body && !body.trimStart().startsWith("<html") && !body.trimStart().startsWith("<!")) {
        return body;
      }
    } catch { /* try next strategy */ }
  }
  return null;
}

router.post("/transcript", async (req, res) => {
  const parsed = FetchTranscriptBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const videoId = extractVideoId(parsed.data.url);
  if (!videoId) {
    res.status(400).json({
      error: "Could not extract a valid YouTube video ID from the provided URL.",
    });
    return;
  }

  try {
    // ── 1. ANDROID Innertube /player API — not IP-restricted ─────────────────
    const playerRes = await fetch(
      "https://www.youtube.com/youtubei/v1/player?prettyPrint=false",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": ANDROID_USER_AGENT,
        },
        body: JSON.stringify({ context: INNERTUBE_CONTEXT, videoId }),
      }
    );

    if (!playerRes.ok) {
      throw new Error(`Innertube player API returned HTTP ${playerRes.status}`);
    }

    const playerData = (await playerRes.json()) as {
      videoDetails?: { title?: string; lengthSeconds?: string };
      captions?: {
        playerCaptionsTracklistRenderer?: { captionTracks?: CaptionTrack[] };
      };
      playabilityStatus?: { status?: string; reason?: string };
    };

    const status = playerData.playabilityStatus?.status;
    if (status && !["OK", "CONTENT_CHECK_REQUIRED"].includes(status)) {
      const reason = playerData.playabilityStatus?.reason ?? status;
      res.status(404).json({ error: `Video unavailable: ${reason}` });
      return;
    }

    const title = playerData.videoDetails?.title ?? `YouTube Video ${videoId}`;
    const durationSec = parseInt(playerData.videoDetails?.lengthSeconds ?? "0", 10);

    const captionTracks = playerData.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];

    if (captionTracks.length === 0) {
      res.status(404).json({
        error:
          "This video does not have captions or transcripts available. Try a video with auto-generated or manual subtitles.",
      });
      return;
    }

    // ── 2. Select the best English track ─────────────────────────────────────
    // Prefer manual English > auto-generated English > first available
    const track =
      captionTracks.find((t) => t.languageCode?.startsWith("en") && !t.kind) ??
      captionTracks.find((t) => t.languageCode?.startsWith("en")) ??
      captionTracks[0]!;

    if (!track.baseUrl) {
      res.status(404).json({ error: "Caption track has no URL." });
      return;
    }

    // ── 3. Fetch caption XML with multiple fallback strategies ────────────────
    const captionXml = await fetchCaptionXml(track.baseUrl, videoId);

    if (!captionXml) {
      res.status(503).json({
        error:
          "Could not retrieve the transcript content. YouTube may be temporarily blocking this server. Please try again in a moment.",
      });
      return;
    }

    // ── 4. Parse XML and build response ──────────────────────────────────────
    const segments = parseTranscriptXml(captionXml, track.languageCode ?? "en");

    if (segments.length === 0) {
      res.status(404).json({ error: "No transcript content found for this video." });
      return;
    }

    const transcript = segments
      .map((s) => s.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    const wordCount = transcript.split(/\s+/).filter(Boolean).length;
    const lastSeg = segments[segments.length - 1]!;
    const duration = durationSec > 0 ? durationSec : lastSeg.start + lastSeg.duration;

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
