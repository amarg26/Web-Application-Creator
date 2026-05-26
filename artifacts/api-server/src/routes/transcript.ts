import { Router, type IRouter } from "express";
import { YoutubeTranscript } from "youtube-transcript";
import { FetchTranscriptBody, FetchTranscriptResponse } from "@workspace/api-zod";

const router: IRouter = Router();

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

/** Fetch video title via YouTube's public oEmbed endpoint (no auth required). */
async function fetchVideoTitle(videoId: string): Promise<string> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; transcript-fetcher/1.0)",
        },
      }
    );
    if (!res.ok) return `YouTube Video ${videoId}`;
    const data = (await res.json()) as { title?: string };
    return data.title ?? `YouTube Video ${videoId}`;
  } catch {
    return `YouTube Video ${videoId}`;
  }
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
    // Fetch transcript and title in parallel
    const [rawSegments, title] = await Promise.all([
      YoutubeTranscript.fetchTranscript(videoId, { lang: "en" }),
      fetchVideoTitle(videoId),
    ]);

    if (!rawSegments?.length) {
      res.status(404).json({
        error:
          "This video does not have captions or transcripts available. Try a video with auto-generated or manual subtitles.",
      });
      return;
    }

    // youtube-transcript returns offset/duration in milliseconds
    const segments = rawSegments.map((s) => ({
      text: s.text.replace(/\s+/g, " ").trim(),
      start: s.offset / 1000,
      duration: s.duration / 1000,
    }));

    const transcript = segments
      .map((s) => s.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    const wordCount = transcript.split(/\s+/).filter(Boolean).length;
    const lastSeg = segments[segments.length - 1]!;
    const duration = lastSeg.start + lastSeg.duration;

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
    req.log.warn({ err, videoId }, "Transcript fetch failed");

    if (
      message.toLowerCase().includes("disabled") ||
      message.toLowerCase().includes("no transcript") ||
      message.toLowerCase().includes("could not find")
    ) {
      res.status(404).json({
        error:
          "This video does not have transcripts available. Try a video with auto-generated or manual subtitles.",
      });
      return;
    }

    if (message.toLowerCase().includes("private") || message.toLowerCase().includes("unavailable")) {
      res.status(404).json({
        error: "Video not found or is private. Please check the URL and try again.",
      });
      return;
    }

    res.status(500).json({
      error:
        "Failed to fetch transcript. The video may be private, age-restricted, or unavailable.",
    });
  }
});

export default router;
