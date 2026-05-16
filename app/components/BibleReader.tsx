"use client";

import { FormEvent, useMemo, useState } from "react";
import {
  BookOpen,
  Languages,
  LibraryBig,
  Loader2,
  Search,
  Sparkles,
} from "lucide-react";

type Testament = "old" | "new";
type TranslationId = "ChiUn" | "WLC" | "Byz" | "TR" | "StatResGNT";

type BookOption = {
  id: string;
  name: string;
  displayName: string;
  chapters: number;
  testament: Testament;
};

type PassageVerse = {
  verse: number;
  chinese: string;
  original: string;
  originalTranslation: TranslationId;
  alternates: Partial<Record<TranslationId, string>>;
};

type Passage = {
  book: BookOption;
  chapter: number;
  verses: PassageVerse[];
};

type SearchResult = {
  book: string;
  displayBook: string;
  chapter: number;
  verse: number;
  text: string;
  translation: TranslationId;
};

const originalLabels: Record<TranslationId, string> = {
  ChiUn: "和合本",
  WLC: "WLC 希伯來文",
  Byz: "Byz 希臘文",
  TR: "TR 希臘文",
  StatResGNT: "StatResGNT 希臘文",
};

export function BibleReader({
  initialBooks,
  initialPassage,
}: {
  initialBooks: BookOption[];
  initialPassage: Passage;
}) {
  const [books] = useState(initialBooks);
  const [passage, setPassage] = useState(initialPassage);
  const [selectedBook, setSelectedBook] = useState(initialPassage.book.id);
  const [selectedChapter, setSelectedChapter] = useState(initialPassage.chapter);
  const [activeVerse, setActiveVerse] = useState<PassageVerse | null>(
    initialPassage.verses[0] ?? null,
  );
  const [panelMode, setPanelMode] = useState<"explain" | "compare">("compare");
  const [explanation, setExplanation] = useState("");
  const [isExplaining, setIsExplaining] = useState(false);
  const [isLoadingPassage, setIsLoadingPassage] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchTranslation, setSearchTranslation] = useState<TranslationId>("ChiUn");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const currentBook = useMemo(
    () => books.find((book) => book.id === selectedBook) ?? books[0],
    [books, selectedBook],
  );

  async function loadPassage(book = selectedBook, chapter = selectedChapter) {
    setIsLoadingPassage(true);
    const response = await fetch(
      `/api/passage?book=${encodeURIComponent(book)}&chapter=${chapter}`,
    );
    const data = await response.json();
    setPassage(data.passage);
    setSelectedBook(data.passage.book.id);
    setSelectedChapter(data.passage.chapter);
    setActiveVerse(data.passage.verses[0] ?? null);
    setExplanation("");
    setPanelMode("compare");
    setIsLoadingPassage(false);
  }

  async function explainVerse(verse: PassageVerse) {
    setActiveVerse(verse);
    setPanelMode("explain");
    setIsExplaining(true);
    setExplanation("");

    const response = await fetch("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        book: passage.book.id,
        chapter: passage.chapter,
        verse: verse.verse,
      }),
    });
    const data = await response.json();
    setExplanation(data.explanation ?? "暫時未能產生解釋。");
    setIsExplaining(false);
  }

  async function search(event: FormEvent) {
    event.preventDefault();
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    const response = await fetch(
      `/api/search?q=${encodeURIComponent(searchQuery)}&translation=${searchTranslation}`,
    );
    const data = await response.json();
    setResults(data.results ?? []);
    setIsSearching(false);
  }

  async function jumpToResult(result: SearchResult) {
    await loadPassage(result.book, result.chapter);
    setTimeout(() => {
      document
        .querySelector(`[data-verse="${result.book}-${result.chapter}-${result.verse}"]`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
  }

  return (
    <main className="reader-shell">
      <section className="reader-toolbar" aria-label="經文工具列">
        <div className="brand-block">
          <span className="brand-mark">書</span>
          <div>
            <p className="eyebrow">繁體中文查經工具</p>
            <h1>和合本原文對照</h1>
          </div>
        </div>

        <div className="selectors">
          <label>
            <span>書卷</span>
            <select
              value={selectedBook}
              onChange={(event) => {
                const book = books.find((item) => item.id === event.target.value);
                if (!book) return;
                setSelectedBook(book.id);
                setSelectedChapter(1);
                void loadPassage(book.id, 1);
              }}
            >
              {books.map((book) => (
                <option key={book.id} value={book.id}>
                  {book.displayName} {book.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>章</span>
            <select
              value={selectedChapter}
              onChange={(event) => {
                const chapter = Number(event.target.value);
                setSelectedChapter(chapter);
                void loadPassage(selectedBook, chapter);
              }}
            >
              {Array.from({ length: currentBook.chapters }, (_, index) => index + 1).map(
                (chapter) => (
                  <option key={chapter} value={chapter}>
                    {chapter}
                  </option>
                ),
              )}
            </select>
          </label>
        </div>
      </section>

      <section className="search-band" aria-label="聖經搜尋">
        <form onSubmit={search} className="search-form">
          <Search size={18} aria-hidden="true" />
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="搜尋和合本、希伯來文或希臘文..."
          />
          <select
            aria-label="搜尋版本"
            value={searchTranslation}
            onChange={(event) => setSearchTranslation(event.target.value as TranslationId)}
          >
            <option value="ChiUn">和合本</option>
            <option value="WLC">WLC</option>
            <option value="Byz">Byz</option>
            <option value="TR">TR</option>
            <option value="StatResGNT">StatResGNT</option>
          </select>
          <button type="submit" disabled={isSearching}>
            {isSearching ? <Loader2 className="spin" size={16} /> : <Search size={16} />}
            搜尋
          </button>
        </form>

        {results.length > 0 && (
          <div className="search-results">
            {results.slice(0, 8).map((result) => (
              <button
                key={`${result.translation}-${result.book}-${result.chapter}-${result.verse}`}
                onClick={() => void jumpToResult(result)}
              >
                <strong>
                  {result.displayBook} {result.chapter}:{result.verse}
                </strong>
                <span>{result.text}</span>
              </button>
            ))}
          </div>
        )}
      </section>

      <div className="content-grid">
        <section className="passage-pane" aria-label="經文">
          <div className="passage-heading">
            <div>
              <p>{passage.book.testament === "old" ? "舊約" : "新約"}</p>
              <h2>
                {passage.book.displayName} {passage.chapter}
              </h2>
            </div>
            <span>{isLoadingPassage ? "讀取中" : "ChiUn 和合本"}</span>
          </div>

          <div className="verses">
            {passage.verses.map((verse) => (
              <article
                key={verse.verse}
                data-verse={`${passage.book.id}-${passage.chapter}-${verse.verse}`}
                className={activeVerse?.verse === verse.verse ? "verse active" : "verse"}
              >
                <button
                  className="verse-number"
                  onClick={() => {
                    setActiveVerse(verse);
                    setPanelMode("compare");
                  }}
                >
                  {verse.verse}
                </button>
                <p>{verse.chinese}</p>
                <div className="verse-actions">
                  <button onClick={() => void explainVerse(verse)} title="原文解釋">
                    <Sparkles size={15} />
                    原文解釋
                  </button>
                  <button
                    onClick={() => {
                      setActiveVerse(verse);
                      setPanelMode("compare");
                    }}
                    title="原文對照"
                  >
                    <Languages size={15} />
                    原文對照
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="study-pane" aria-label="原文查經面板">
          <div className="panel-tabs">
            <button
              className={panelMode === "compare" ? "selected" : ""}
              onClick={() => setPanelMode("compare")}
            >
              <LibraryBig size={16} />
              對照
            </button>
            <button
              className={panelMode === "explain" ? "selected" : ""}
              onClick={() => activeVerse && void explainVerse(activeVerse)}
            >
              <BookOpen size={16} />
              解釋
            </button>
          </div>

          {activeVerse ? (
            <div className="panel-body">
              <p className="reference">
                {passage.book.displayName} {passage.chapter}:{activeVerse.verse}
              </p>

              {panelMode === "compare" ? (
                <div className="comparison">
                  <div>
                    <span>和合本</span>
                    <p>{activeVerse.chinese}</p>
                  </div>
                  {Object.entries(activeVerse.alternates).map(([translation, text]) => (
                    <div key={translation}>
                      <span>{originalLabels[translation as TranslationId]}</span>
                      <p dir={translation === "WLC" ? "rtl" : "ltr"}>{text}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="explanation">
                  {isExplaining ? (
                    <div className="loading-line">
                      <Loader2 className="spin" size={18} />
                      正在整理原文查經筆記...
                    </div>
                  ) : (
                    <pre>{explanation || "按「原文解釋」開始產生查經筆記。"}</pre>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="empty-state">選擇一節經文開始查考。</p>
          )}
        </aside>
      </div>
    </main>
  );
}
