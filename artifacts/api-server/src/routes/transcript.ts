import { Router, type IRouter } from "express";
import { YoutubeTranscript } from "youtube-transcript";
import { FetchTranscriptBody, FetchTranscriptResponse } from "@workspace/api-zod";

const router: IRouter = Router();

function extractVideoId(input: string): string | null {
  const trimmed = input.trim();

  // Plain video ID (11 chars, alphanumeric + - _)
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);

    // youtube.com/watch?v=...
    const v = url.searchParams.get("v");
    if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;

    // youtu.be/...
    if (url.hostname === "youtu.be") {
      const id = url.pathname.slice(1).split("/")[0];
      if (/^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }

    // youtube.com/shorts/... or /embed/...
    const pathMatch = url.pathname.match(/\/(?:shorts|embed|v)\/([a-zA-Z0-9_-]{11})/);
    if (pathMatch) return pathMatch[1];
  } catch {
    // not a URL — already handled plain ID above
  }

  return null;
}

async function fetchVideoTitle(videoId: string): Promise<string> {
  try {
    const res = await fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
    );
    if (res.ok) {
      const data = (await res.json()) as { title?: string };
      return data.title ?? `YouTube Video ${videoId}`;
    }
  } catch {
    // ignore
  }
  return `YouTube Video ${videoId}`;
}

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

  let segments: Array<{ text: string; start: number; duration: number }>;
  try {
    const raw = await YoutubeTranscript.fetchTranscript(videoId);
    segments = raw.map((s) => ({
      text: s.text,
      start: s.offset / 1000,
      duration: s.duration / 1000,
    }));
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("disabled") || message.includes("No transcript")) {
      res.status(404).json({ error: "This video does not have captions or transcripts available." });
      return;
    }
    req.log.error({ err, videoId }, "Failed to fetch transcript");
    res.status(500).json({ error: "Failed to fetch transcript. The video may be private or unavailable." });
    return;
  }

  if (segments.length === 0) {
    res.status(404).json({ error: "No transcript content found for this video." });
    return;
  }

  const transcript = segments.map((s) => s.text).join(" ").replace(/\s+/g, " ").trim();
  const wordCount = transcript.split(/\s+/).filter(Boolean).length;
  const lastSeg = segments[segments.length - 1];
  const duration = lastSeg.start + lastSeg.duration;
  const title = await fetchVideoTitle(videoId);

  const result = FetchTranscriptResponse.parse({
    videoId,
    title,
    transcript,
    segments,
    wordCount,
    duration,
  });

  res.json(result);
});

export default router;
