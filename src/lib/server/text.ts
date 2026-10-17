import type { ScriptLine } from "@/lib/shared/types";

/** Split text into roughly `target`-character sections at paragraph breaks. */
export function sectionText(text: string, target = 1000): string[] {
  const paras = text
    .replace(/\r\n?/g, "\n")
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);
  const out: string[] = [];
  let cur = "";
  for (const p of paras) {
    for (const piece of p.length > target * 1.6 ? splitSentences(p, target) : [p]) {
      if (cur && cur.length + piece.length + 2 > target) {
        out.push(cur);
        cur = piece;
      } else {
        cur = cur ? `${cur}\n\n${piece}` : piece;
      }
    }
  }
  if (cur) out.push(cur);
  return out;
}

function splitSentences(text: string, max: number): string[] {
  const sentences = text.match(/[^.!?…]+[.!?…]+["'”’)]*\s*|[^.!?…]+$/g) ?? [text];
  const out: string[] = [];
  let cur = "";
  for (const s of sentences) {
    if (cur && cur.length + s.length > max) {
      out.push(cur.trim());
      cur = s;
    } else cur += s;
  }
  if (cur.trim()) out.push(cur.trim());
  // A single enormous "sentence" still has to fit somewhere.
  return out.flatMap((s) => (s.length <= max ? [s] : s.match(new RegExp(`.{1,${max}}(\\s|$)`, "g")) ?? [s]));
}

/**
 * Group script lines into requests that respect the voice API's limit
 * (2,000 characters per dialogue request). Long lines are split by sentence.
 */
export function chunkLines(lines: ScriptLine[], max = 1800): ScriptLine[][] {
  const flat: ScriptLine[] = [];
  for (const l of lines) {
    if (l.text.length <= max) flat.push(l);
    else for (const piece of splitSentences(l.text, max)) flat.push({ speaker: l.speaker, text: piece });
  }
  const chunks: ScriptLine[][] = [];
  let cur: ScriptLine[] = [];
  let size = 0;
  for (const l of flat) {
    if (cur.length && size + l.text.length > max) {
      chunks.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(l);
    size += l.text.length;
  }
  if (cur.length) chunks.push(cur);
  return chunks;
}

/** Remove [delivery tags] for display and word timing. */
export function stripTags(text: string): string {
  return text.replace(/\[[^\]]{1,40}\]\s*/g, "").replace(/\s{2,}/g, " ").trim();
}

/** Remove delivery tags for voice models that would read them aloud. */
export function speakable(text: string): string {
  return stripTags(text);
}

// ------------------------------------------------------- Project Gutenberg

/** Keep only the book itself: drop the Project Gutenberg header and licence. */
export function cleanGutenberg(raw: string): string {
  let text = raw.replace(/\r\n?/g, "\n");
  const start = text.search(/\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG[^\n]*\n/i);
  if (start >= 0) text = text.slice(text.indexOf("\n", start) + 1);
  const end = text.search(/\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG/i);
  if (end >= 0) text = text.slice(0, end);
  return text
    .replace(/\[Illustration[^\]]*\]/gi, "")
    .replace(/_([^_\n]+)_/g, "$1")
    .replace(/\n{3,}/g, "\n\n\n")
    .trim();
}

export interface Chapter {
  title: string;
  text: string;
  words: number;
}

const HEADING =
  /^(?:(?:CHAPTER|Chapter|BOOK|STORY|PART)\s+[IVXLCDM\d]+\b.*|[IVXLC]+\.\s+[A-Z][A-Z' ,\-!?]+|[A-Z][A-Z' ,\-!?]{3,60})$/;

/**
 * Split a classic into chapters (or stories, for collections). Falls back to
 * evenly sized parts when no headings are found, and treats short books
 * like Peter Rabbit as a single chapter.
 */
export function chapterize(text: string): Chapter[] {
  const words = (s: string) => s.split(/\s+/).filter(Boolean).length;
  if (words(text) < 2500) return [{ title: "The whole story", text: text.trim(), words: words(text) }];

  const lines = text.split("\n");
  const marks: { index: number; title: string }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.length > 70 || !HEADING.test(line)) continue;
    const prevBlank = i === 0 || !lines[i - 1].trim();
    const nextBlank = i + 1 >= lines.length || !lines[i + 1].trim() || HEADING.test(lines[i + 1].trim());
    if (prevBlank && nextBlank) marks.push({ index: i, title: line });
  }

  // A chapter number followed by its name a line or two later
  // ("CHAPTER I" / "THE RIVER BANK") is one heading, not two.
  for (let m = 0; m + 1 < marks.length; m++) {
    if (/^(CHAPTER|Chapter)\s+[IVXLCDM\d]+\.?$/.test(marks[m].title) && marks[m + 1].index - marks[m].index <= 3) {
      marks[m] = { index: marks[m + 1].index, title: `${marks[m].title.replace(/\.$/, "")}: ${marks[m + 1].title}` };
      marks.splice(m + 1, 1);
    }
  }

  const chapters: Chapter[] = [];
  for (let m = 0; m < marks.length; m++) {
    const from = marks[m].index;
    const to = m + 1 < marks.length ? marks[m + 1].index : lines.length;
    const body = lines.slice(from + 1, to).join("\n").trim();
    if (words(body) >= 150) chapters.push({ title: tidyTitle(marks[m].title), text: body, words: words(body) });
  }

  if (chapters.length >= 2) return chapters;

  // No reliable headings: make evenly sized parts.
  const parts = sectionText(text, 9000);
  return parts.map((t, i) => ({ title: `Part ${i + 1}`, text: t, words: words(t) }));
}

function tidyTitle(t: string): string {
  const s = t.replace(/\s+/g, " ").trim();
  if (s !== s.toUpperCase()) return s;
  return s
    .toLowerCase()
    .replace(/\b([a-z])/g, (c) => c.toUpperCase())
    .replace(/(?<!^|:\s)\b(Of|The|And|A|An|In|On|To|With|For)\b/g, (w) => w.toLowerCase())
    .replace(/\b(Ii|Iii|Iv|Vi|Vii|Viii|Ix|Xi|Xii|Xiii|Xiv|Xv|Xvi|Xvii|Xviii|Xix|Xx)\b/g, (r) => r.toUpperCase());
}
