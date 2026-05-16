import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";
import { displayBookName } from "./book-names";

export type Testament = "old" | "new";

export type TranslationId = "ChiUn" | "WLC" | "Byz" | "TR" | "StatResGNT";

export type BookMeta = {
  order: number;
  id: string;
  name: string;
  chapters: number;
  testament: Testament;
};

export type VerseRow = {
  translation: TranslationId;
  book: string;
  chapter: number;
  verse: number;
  text: string;
};

type BibleLibrary = {
  source: string;
  syncedAt: string;
  books: BookMeta[];
  verses: VerseRow[];
};

type PassageVerse = {
  verse: number;
  chinese: string;
  original: string;
  originalTranslation: TranslationId;
  alternates: Partial<Record<TranslationId, string>>;
};

let cachedLibrary: BibleLibrary | undefined;

function getLibrary() {
  if (!cachedLibrary) {
    const filePath = path.join(process.cwd(), "data", "bible", "library.json");
    cachedLibrary = JSON.parse(readFileSync(filePath, "utf8")) as BibleLibrary;
  }
  return cachedLibrary;
}

function sameReference(row: VerseRow, book: string, chapter: number, verse?: number) {
  return (
    row.book === book &&
    row.chapter === chapter &&
    (verse === undefined || row.verse === verse)
  );
}

function stripMarks(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f\u0591-\u05C7]/g, "")
    .normalize("NFC");
}

export function normalizeSearchText(input: string) {
  return stripMarks(input)
    .toLowerCase()
    .replace(/[，。、「」『』：；？！,.!?;:"'()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getBooks() {
  return getLibrary().books.map((book) => ({
    ...book,
    displayName: displayBookName(book.name),
  }));
}

export function getBook(bookId: string) {
  return getLibrary().books.find((book) => book.id === bookId);
}

export function getOriginalTranslation(book: BookMeta): TranslationId {
  return book.testament === "old" ? "WLC" : "Byz";
}

export function getPassage(bookId: string, chapter: number) {
  const library = getLibrary();
  const book = library.books.find((item) => item.id === bookId);
  if (!book) return null;

  const chineseRows = library.verses
    .filter(
      (row) =>
        row.translation === "ChiUn" &&
        row.book === bookId &&
        row.chapter === chapter,
    )
    .sort((a, b) => a.verse - b.verse);

  const originalTranslation = getOriginalTranslation(book);

  const verses: PassageVerse[] = chineseRows.map((row) => {
    const alternates: Partial<Record<TranslationId, string>> = {};
    for (const translation of ["WLC", "Byz", "TR", "StatResGNT"] as const) {
      const alternate = library.verses.find(
        (candidate) =>
          candidate.translation === translation &&
          sameReference(candidate, row.book, row.chapter, row.verse),
      );
      if (alternate?.text) alternates[translation] = alternate.text;
    }

    return {
      verse: row.verse,
      chinese: row.text,
      original: alternates[originalTranslation] ?? "",
      originalTranslation,
      alternates,
    };
  });

  return {
    book: {
      ...book,
      displayName: displayBookName(book.name),
    },
    chapter,
    verses,
  };
}

export function getVerse(bookId: string, chapter: number, verse: number) {
  const passage = getPassage(bookId, chapter);
  if (!passage) return null;
  const matchedVerse = passage.verses.find((item) => item.verse === verse);
  if (!matchedVerse) return null;
  return {
    book: passage.book,
    chapter,
    ...matchedVerse,
  };
}

export function searchBible(query: string, translation: TranslationId = "ChiUn") {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return [];

  const rows = getLibrary().verses;
  const exactChinese = /[\u3400-\u9fff]/.test(query);

  return rows
    .filter((row) => row.translation === translation)
    .map((row) => ({
      row,
      normalized: normalizeSearchText(row.text),
    }))
    .filter(({ row, normalized }) =>
      exactChinese ? row.text.includes(query.trim()) : normalized.includes(normalizedQuery),
    )
    .slice(0, 80)
    .map(({ row }) => ({
      book: row.book,
      displayBook: displayBookName(row.book),
      chapter: row.chapter,
      verse: row.verse,
      text: row.text,
      translation: row.translation,
    }));
}
