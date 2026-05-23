export function formatSeconds(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function extractVideoId(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([^"&?\/\s]{11})/);
  return match ? match[1] : null;
}

export interface SubSection {
  heading: string | null;
  points: string[];
}

export interface TranscriptSection {
  label: string;
  startSeconds: number;
  bullets: string[];
  subSections: SubSection[];
}

const NUMBER_WORDS: Record<string, string> = {
  one: "1", two: "2", three: "3", four: "4", five: "5",
  six: "6", seven: "7", eight: "8", nine: "9", ten: "10",
  eleven: "11", twelve: "12", thirteen: "13", fourteen: "14", fifteen: "15",
  first: "1", second: "2", third: "3", fourth: "4", fifth: "5",
  sixth: "6", seventh: "7", eighth: "8", ninth: "9", tenth: "10",
};

/**
 * Detects spoken "Number one / Number two / Step one / Tip three" patterns
 * in a sentence and returns a normalised heading string, or null if none found.
 */
function extractNumberedHeading(sentence: string): string | null {
  const pattern =
    /^(?:number|step|tip|point|reason|rule|way|item|factor|thing|part|section|chapter|lesson|trick|strategy|mistake|habit|principle)\s+(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|\d+)/i;

  const match = sentence.match(pattern);
  if (!match) return null;

  const word = match[0];
  return word.replace(
    /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth)\b/gi,
    (w) => NUMBER_WORDS[w.toLowerCase()] ?? w,
  );
}

/**
 * Splits an array of bullet sentences into sub-sections whenever a
 * "Number N / Step N / …" heading is detected at the start of a sentence.
 */
function buildSubSections(bullets: string[]): SubSection[] {
  const result: SubSection[] = [];
  let current: SubSection = { heading: null, points: [] };

  for (const bullet of bullets) {
    const heading = extractNumberedHeading(bullet);
    if (heading) {
      if (current.heading !== null || current.points.length > 0) {
        result.push(current);
      }
      // The rest of the sentence (after the heading token) becomes the first point
      const remainder = bullet.slice(heading.length).replace(/^[,:\s]+/, "").trim();
      current = {
        heading: heading.charAt(0).toUpperCase() + heading.slice(1),
        points: remainder.length > 0 ? [remainder] : [],
      };
    } else {
      current.points.push(bullet);
    }
  }

  if (current.heading !== null || current.points.length > 0) {
    result.push(current);
  }

  return result.length > 0 ? result : [{ heading: null, points: bullets }];
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

  const bullets = sentences.length > 0 ? sentences : [raw];

  return {
    label: formatSeconds(startSeconds),
    startSeconds,
    bullets,
    subSections: buildSubSections(bullets),
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
