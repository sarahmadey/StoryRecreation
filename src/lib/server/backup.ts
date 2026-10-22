import fs from "node:fs";
import path from "node:path";
import { getHousehold, keepsakeFiles, listBooks, listKeepsakes, listPageRows, listStoriesForBackup } from "./db";
import { resolveHouseholdPath } from "./files";
import { sizeOf, zipSize, type ZipEntry } from "./zip";

// "Download everything": one ZIP a family can keep forever, whatever happens
// to the app. Stories are MP3s filed by book, family recordings by person,
// photos by book, and a "Read me.html" to browse it all, words included.

export interface BackupSummary {
  stories: number;
  recordings: number;
  photos: number;
  bytes: number;
}

function safeName(s: string): string {
  return (
    s
      .replace(/[/\\:*?"<>|\u0000-\u001f]+/g, "-")
      .replace(/\s+/g, " ")
      .replace(/^[.\s-]+|[.\s]+$/g, "")
      .slice(0, 80) || "Untitled"
  );
}

/** Keeps two stories with the same title in one folder from overwriting each other. */
function uniquePaths() {
  const used = new Set<string>();
  return (folder: string, base: string, ext: string) => {
    let name = `${folder}/${base}${ext}`;
    for (let n = 2; used.has(name.toLowerCase()); n++) name = `${folder}/${base} (${n})${ext}`;
    used.add(name.toLowerCase());
    return name;
  };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const href = (p: string) => p.split("/").map(encodeURIComponent).join("/");
const spoken = (t: string) => t.replace(/\[[^\]]*\]\s*/g, "").trim(); // drop delivery cues like [whispers]
const day = (ms: number) => new Date(ms).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
const length = (sec: number | null) => (sec ? `${Math.floor(sec / 60)}:${String(Math.round(sec % 60)).padStart(2, "0")}` : "");

function existing(householdId: string, rel: string | null): string | null {
  if (!rel) return null;
  const full = resolveHouseholdPath(householdId, rel);
  return fs.existsSync(full) ? full : null;
}

export function familyBackup(householdId: string): { filename: string; root: string; entries: ZipEntry[]; summary: BackupSummary } {
  const family = getHousehold(householdId)?.name ?? "Our family";
  const stamp = new Date().toISOString().slice(0, 10);
  const root = safeName(`Storyhollow - ${family} - ${stamp}`);
  const unique = uniquePaths();
  const entries: ZipEntry[] = [];
  const add = (name: string, file: string) => entries.push({ name: `${root}/${name}`, file, mtime: fs.statSync(file).mtime });

  const books = listBooks(householdId);
  const bookTitle = new Map(books.map((b) => [b.id, safeName(b.title)]));
  const storyLinks = new Map<string, string>();
  const stories = listStoriesForBackup(householdId);
  for (const s of stories) {
    const file = existing(householdId, s.audioPath);
    if (!file) continue;
    const name = unique(`Stories/${bookTitle.get(s.bookId) ?? "Other stories"}`, safeName(s.title), ".mp3");
    add(name, file);
    storyLinks.set(s.id, name);
  }

  const keepsakes = listKeepsakes(householdId);
  const keepPaths = new Map(keepsakeFiles(householdId, keepsakes.map((k) => k.id)).map((k) => [k.id, k.audioPath]));
  const keepLinks = new Map<string, string>();
  for (const k of keepsakes) {
    const file = existing(householdId, keepPaths.get(k.id) ?? null);
    if (!file) continue;
    const name = unique(`Family voices/${safeName(k.person)}`, safeName(k.recordedOn ? `${k.title} (${k.recordedOn})` : k.title), ".mp3");
    add(name, file);
    keepLinks.set(k.id, name);
  }

  const photoLinks = new Map<string, string[]>();
  let photos = 0;
  for (const b of books) {
    const links: string[] = [];
    for (const p of listPageRows(b.id)) {
      const file = existing(householdId, p.image_path);
      if (!file) continue;
      const name = unique(`Book pages/${bookTitle.get(b.id)}`, `page-${String(p.page_number).padStart(2, "0")}`, path.extname(file).toLowerCase());
      add(name, file);
      links.push(name);
      photos++;
    }
    photoLinks.set(b.id, links);
  }

  // Picture books' own pictures (the real ones; stand-ins are left out), filed by story.
  for (const s of stories) {
    const pictures = [s.art?.cover ?? null, ...(s.art?.pages ?? [])];
    pictures.forEach((rel, i) => {
      const file = rel && !rel.endsWith(".svg") ? existing(householdId, rel) : null;
      if (!file) return;
      add(unique(`Story pictures/${safeName(s.title)}`, i === 0 ? "cover" : `page-${String(i).padStart(2, "0")}`, path.extname(file).toLowerCase()), file);
      photos++;
    });
  }

  // ---------------------------------------------------------------- Read me.html
  const storyHtml = books
    .filter((b) => stories.some((s) => s.bookId === b.id))
    .map((b) => {
      const items = stories
        .filter((s) => s.bookId === b.id)
        .map((s) => {
          const link = storyLinks.get(s.id);
          const cast = new Map((s.script?.cast ?? []).map((c) => [c.id, c.name]));
          const words = (s.script?.pages ?? [])
            .map(
              (pg) =>
                `<h5>Page ${pg.page}</h5>` +
                pg.lines
                  .map((l) => `<p>${s.script!.cast.length > 1 ? `<b>${esc(cast.get(l.speaker) ?? l.speaker)}</b> ` : ""}${esc(spoken(l.text))}</p>`)
                  .join(""),
            )
            .join("");
          return `<article><h4>${esc(s.title)}</h4><p class="meta">${[day(s.createdAt), length(s.duration), s.mode === "read" ? "read aloud" : ""].filter(Boolean).join(" · ")}</p>${
            s.synopsis ? `<p>${esc(s.synopsis)}</p>` : ""
          }${link ? `<audio controls preload="none" src="${href(link)}"></audio>` : `<p class="meta">Not recorded yet.</p>`}${
            words ? `<details><summary>The words</summary>${words}</details>` : ""
          }</article>`;
        })
        .join("");
      return `<section><h3>${esc(b.title)}</h3>${items}</section>`;
    })
    .join("");

  const people = [...new Set(keepsakes.map((k) => k.person))];
  const voicesHtml = people
    .map(
      (person) =>
        `<section><h3>${esc(person)}</h3>${keepsakes
          .filter((k) => k.person === person && keepLinks.has(k.id))
          .map(
            (k) =>
              `<article><h4>${esc(k.title)}</h4>${k.recordedOn ? `<p class="meta">${esc(k.recordedOn)}</p>` : ""}<audio controls preload="none" src="${href(keepLinks.get(k.id)!)}"></audio></article>`,
          )
          .join("")}</section>`,
    )
    .join("");

  const photosHtml = books
    .filter((b) => photoLinks.get(b.id)?.length)
    .map(
      (b) =>
        `<section><h3>${esc(b.title)}</h3><div class="pages">${photoLinks
          .get(b.id)!
          .map((p) => `<a href="${href(p)}"><img loading="lazy" src="${href(p)}" alt=""></a>`)
          .join("")}</div></section>`,
    )
    .join("");

  const readme = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Storyhollow · ${esc(family)}</title><style>
body{margin:0;background:#f4ead4;color:#2b1d12;font:17px/1.6 Georgia,"Times New Roman",serif}
main{max-width:760px;margin:0 auto;padding:32px 18px 64px}
h1{font-weight:400;font-size:2.2rem;margin:0}h2{font-weight:400;font-size:1.6rem;margin:44px 0 8px;border-bottom:1px solid #d8c39a;padding-bottom:6px}
h3{font-size:1.2rem;margin:26px 0 6px}h4{font-size:1.05rem;margin:0}h5{font-size:.85rem;letter-spacing:.08em;text-transform:uppercase;color:#8f5f17;margin:14px 0 4px}
article{background:#fcf7ea;border:1px solid #e0cfa8;border-radius:12px;padding:14px 16px;margin:10px 0}
.meta{color:#7a6248;font-size:.9rem;margin:2px 0 8px}audio{width:100%;margin:6px 0}details summary{cursor:pointer;color:#8f5f17}
.pages{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px}.pages img{width:100%;border-radius:8px;display:block}
</style></head><body><main>
<h1>Storyhollow</h1><p class="meta">${esc(family)} · saved ${day(Date.now())}</p>
<p>Everything from your family's Storyhollow library. Press play on any story below, or open the folders next to this page: <b>Stories</b>, <b>Family voices</b> and <b>Book pages</b>. The MP3s play anywhere: a phone, a speaker, the car, or a make-your-own Yoto card.</p>
${storyHtml ? `<h2>Stories</h2>${storyHtml}` : ""}
${voicesHtml ? `<h2>Family voices</h2>${voicesHtml}` : ""}
${photosHtml ? `<h2>Book pages</h2>${photosHtml}` : ""}
</main></body></html>`;
  entries.unshift({ name: `${root}/Read me.html`, data: Buffer.from(readme, "utf8") });

  const summary: BackupSummary = {
    stories: storyLinks.size,
    recordings: keepLinks.size,
    photos,
    bytes: zipSize(entries.map((e) => ({ name: e.name, size: sizeOf(e) }))),
  };
  return { filename: `${root}.zip`, root, entries, summary };
}
