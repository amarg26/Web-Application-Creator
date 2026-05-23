export function formatSeconds(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function extractVideoId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([^"&?\/\s]{11})/);
  return match ? match[1] : null;
}

export interface TranscriptSection {
  label: string;
  startSeconds: number;
  bullets: string[];
}

/**
 * Groups segments into ~2-minute sections, then splits each section's
 * text into individual sentences as bullet points.
 */
export function splitIntoSections(
  segments: Array<{ text: string; start: number; duration: number }>,
  chunkSeconds = 120,
): TranscriptSection[] {
  if (segments.length === 0) return [];

  const sections: TranscriptSection[] = [];
  let current: typeof segments = [];
  let sectionStart = segments[0].start;

  for (const seg of segments) {
    if (seg.start - sectionStart >= chunkSeconds && current.length > 0) {
      sections.push(buildSection(sectionStart, current));
      current = [];
      sectionStart = seg.start;
    }
    current.push(seg);
  }

  if (current.length > 0) {
    sections.push(buildSection(sectionStart, current));
  }

  return sections;
}

function buildSection(
  startSeconds: number,
  segs: Array<{ text: string; start: number; duration: number }>,
): TranscriptSection {
  const raw = segs.map((s) => s.text).join(" ").replace(/\s+/g, " ").trim();

  // Split into sentences at . ! ? boundaries
  const sentences = raw
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 8);

  return {
    label: formatSeconds(startSeconds),
    startSeconds,
    bullets: sentences.length > 0 ? sentences : [raw],
  };
}

/**
 * Breaks a flat transcript string into readable paragraphs of ~4 sentences.
 */
export function splitIntoParagraphs(text: string, sentencesPerParagraph = 4): string[] {
  const sentences = text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (sentences.length === 0) return [text];

  const paragraphs: string[] = [];
  for (let i = 0; i < sentences.length; i += sentencesPerParagraph) {
    paragraphs.push(sentences.slice(i, i + sentencesPerParagraph).join(" "));
  }
  return paragraphs;
}
