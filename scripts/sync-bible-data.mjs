import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "data", "bible");
const BASE =
  "https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/json";

const TRANSLATIONS = [
  { id: "ChiUn", file: "ChiUn.json", label: "和合本（繁體）", language: "zh-Hant" },
  { id: "WLC", file: "WLC.json", label: "Westminster Leningrad Codex", language: "he" },
  { id: "Byz", file: "Byz.json", label: "Byzantine Textform 2013", language: "grc" },
  { id: "TR", file: "TR.json", label: "Textus Receptus", language: "grc" },
  { id: "StatResGNT", file: "StatResGNT.json", label: "Statistical Restoration Greek NT", language: "grc" },
];

async function downloadJson(file) {
  const url = `${BASE}/${file}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download ${url}: ${response.status}`);
  }
  return response.json();
}

function flattenTranslation(source, translation) {
  const verses = [];
  for (const book of source.books) {
    for (const chapter of book.chapters) {
      for (const verse of chapter.verses) {
        const text = String(verse.text ?? "").trim();
        if (!text) continue;
        verses.push({
          translation: translation.id,
          book: book.name,
          chapter: Number(chapter.chapter),
          verse: Number(verse.verse),
          text,
        });
      }
    }
  }
  return verses;
}

function buildBookMeta(chineseSource) {
  return chineseSource.books.map((book, index) => ({
    order: index + 1,
    id: book.name,
    name: book.name,
    chapters: book.chapters.length,
    testament: index < 39 ? "old" : "new",
  }));
}

await mkdir(OUT_DIR, { recursive: true });

const library = {
  source: "scrollmapper/bible_databases",
  syncedAt: new Date().toISOString(),
  translations: TRANSLATIONS,
  books: [],
  verses: [],
};

for (const translation of TRANSLATIONS) {
  console.log(`Downloading ${translation.file}...`);
  const source = await downloadJson(translation.file);
  if (translation.id === "ChiUn") {
    library.books = buildBookMeta(source);
  }
  library.verses.push(...flattenTranslation(source, translation));
}

await writeFile(
  path.join(OUT_DIR, "library.json"),
  `${JSON.stringify(library)}\n`,
  "utf8",
);

console.log(
  `Wrote ${library.verses.length.toLocaleString()} verse rows across ${
    library.books.length
  } books.`,
);
