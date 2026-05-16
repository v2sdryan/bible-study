"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  BookOpen,
  CircleHelp,
  Languages,
  LibraryBig,
  Loader2,
  RotateCcw,
  Save,
  Search,
  Settings,
  Sparkles,
  X,
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

type ReaderSettings = {
  fontSize: number;
  pageBackground: string;
  paperBackground: string;
  panelBackground: string;
  textColor: string;
  softTextColor: string;
  accentColor: string;
  lineColor: string;
  apiKey: string;
  oldOriginalSource: Extract<TranslationId, "WLC">;
  newOriginalSource: Extract<TranslationId, "Byz" | "TR" | "StatResGNT">;
  originalSourceRequest: string;
  originalSourceSuggestion: string;
};

const defaultSettings: ReaderSettings = {
  fontSize: 20,
  pageBackground: "#f7edc8",
  paperBackground: "#fff8dd",
  panelBackground: "#faefc2",
  textColor: "#2d1b0e",
  softTextColor: "#71513a",
  accentColor: "#8c2f12",
  lineColor: "#b86a1e",
  apiKey: "",
  oldOriginalSource: "WLC",
  newOriginalSource: "Byz",
  originalSourceRequest: "",
  originalSourceSuggestion: "",
};

const settingStorageKey = "bible-study-reader-settings";

const originalLabels: Record<TranslationId, string> = {
  ChiUn: "和合本",
  WLC: "《威斯敏斯特列寧格勒抄本》",
  Byz: "《拜占庭文本形態二零一三》",
  TR: "《公認文本》",
  StatResGNT: "《統計復原希臘文新約》",
};

function matchOriginalSource(request: string) {
  const text = request.trim().toLowerCase();
  if (!text) return "";
  if (/舊約|希伯來|亞蘭|馬所拉|masoretic|wlc|列寧格勒/.test(text)) {
    return "已配對：舊約用《威斯敏斯特列寧格勒抄本》。";
  }
  if (/公認|欽定|受納|received|receptus|tr|kjv/.test(text)) {
    return "已配對：新約用《公認文本》。";
  }
  if (/統計|復原|現代|批判|critical|nestle|aland|ubs|stat/.test(text)) {
    return "已配對：新約用《統計復原希臘文新約》。";
  }
  if (/拜占庭|多數|教會傳統|byz|majority|byzantine/.test(text)) {
    return "已配對：新約用《拜占庭文本形態二零一三》。";
  }
  return "暫時未能肯定配對。可試輸入：拜占庭、公認文本、現代復原、舊約希伯來文。";
}

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
  const [selectedVerses, setSelectedVerses] = useState<number[]>(
    initialPassage.verses[0] ? [initialPassage.verses[0].verse] : [],
  );
  const [panelMode, setPanelMode] = useState<"explain" | "compare" | "ask" | "closed">(
    "compare",
  );
  const [explanation, setExplanation] = useState("");
  const [isExplaining, setIsExplaining] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [isAnswering, setIsAnswering] = useState(false);
  const [isLoadingPassage, setIsLoadingPassage] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchTranslation, setSearchTranslation] = useState<TranslationId>("ChiUn");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<ReaderSettings>(defaultSettings);
  const [savedMessage, setSavedMessage] = useState("");
  const studyPaneRef = useRef<HTMLElement | null>(null);

  const currentBook = useMemo(
    () => books.find((book) => book.id === selectedBook) ?? books[0],
    [books, selectedBook],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = window.localStorage.getItem(settingStorageKey);
      if (!saved) return;
      try {
        setSettings({ ...defaultSettings, ...JSON.parse(saved) });
      } catch {
        window.localStorage.removeItem(settingStorageKey);
      }
    }, 0);

    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty("--background", settings.pageBackground);
    root.style.setProperty("--foreground", settings.textColor);
    root.style.setProperty("--ink-soft", settings.softTextColor);
    root.style.setProperty("--paper", settings.paperBackground);
    root.style.setProperty("--paper-deep", settings.panelBackground);
    root.style.setProperty("--line", settings.lineColor);
    root.style.setProperty("--accent", settings.accentColor);
    root.style.setProperty("--accent-strong", settings.accentColor);
    root.style.setProperty("--verse-font-size", `${settings.fontSize}px`);
  }, [settings]);

  function updateSetting<Key extends keyof ReaderSettings>(
    key: Key,
    value: ReaderSettings[Key],
  ) {
    setSettings((current) => ({ ...current, [key]: value }));
    setSavedMessage("");
  }

  function saveSettings(event?: FormEvent) {
    event?.preventDefault();
    window.localStorage.setItem(settingStorageKey, JSON.stringify(settings));
    setSavedMessage("已儲存到此瀏覽器");
  }

  function resetSettings() {
    setSettings(defaultSettings);
    window.localStorage.removeItem(settingStorageKey);
    setSavedMessage("已重設");
  }

  function selectedOriginalSource() {
    return passage.book.testament === "old"
      ? settings.oldOriginalSource
      : settings.newOriginalSource;
  }

  const selectedVerseList = useMemo(
    () =>
      passage.verses.filter((verse) =>
        selectedVerses.includes(verse.verse),
      ),
    [passage.verses, selectedVerses],
  );

  function selectedReference() {
    if (!selectedVerseList.length) {
      return `${passage.book.displayName} ${passage.chapter}`;
    }
    return `${passage.book.displayName} ${passage.chapter}:${selectedVerseList
      .map((verse) => verse.verse)
      .join("、")}`;
  }

  function scrollToStudyPane() {
    window.setTimeout(() => {
      studyPaneRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  function openPanel(mode: "explain" | "compare" | "ask") {
    setPanelMode(mode);
    scrollToStudyPane();
  }

  function toggleVerseSelection(verse: PassageVerse) {
    setSelectedVerses((current) => {
      const exists = current.includes(verse.verse);
      const next = exists
        ? current.filter((item) => item !== verse.verse)
        : [...current, verse.verse];
      return next.sort((a, b) => a - b);
    });
  }

  function applyOriginalSourceRequest() {
    const suggestion = matchOriginalSource(settings.originalSourceRequest);
    let nextSettings = { ...settings, originalSourceSuggestion: suggestion };
    if (suggestion.includes("公認文本")) {
      nextSettings = { ...nextSettings, newOriginalSource: "TR" };
    } else if (suggestion.includes("統計復原")) {
      nextSettings = { ...nextSettings, newOriginalSource: "StatResGNT" };
    } else if (suggestion.includes("拜占庭")) {
      nextSettings = { ...nextSettings, newOriginalSource: "Byz" };
    } else if (suggestion.includes("威斯敏斯特")) {
      nextSettings = { ...nextSettings, oldOriginalSource: "WLC" };
    }
    setSettings(nextSettings);
    setSavedMessage("");
  }

  async function loadPassage(book = selectedBook, chapter = selectedChapter) {
    setIsLoadingPassage(true);
    const response = await fetch(
      `/api/passage?book=${encodeURIComponent(book)}&chapter=${chapter}`,
    );
    const data = await response.json();
    setPassage(data.passage);
    setSelectedBook(data.passage.book.id);
    setSelectedChapter(data.passage.chapter);
    setSelectedVerses(data.passage.verses[0] ? [data.passage.verses[0].verse] : []);
    setExplanation("");
    setAnswer("");
    setPanelMode("compare");
    setIsLoadingPassage(false);
  }

  async function explainSelection() {
    if (!selectedVerseList.length) return;
    openPanel("explain");
    setIsExplaining(true);
    setExplanation("");

    const response = await fetch("/api/explain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        book: passage.book.id,
        chapter: passage.chapter,
        verses: selectedVerseList.map((verse) => verse.verse),
        apiKey: settings.apiKey.trim() || undefined,
        originalTranslation: selectedOriginalSource(),
      }),
    });
    const data = await response.json();
    setExplanation(data.explanation ?? "暫時未能產生解釋。");
    setIsExplaining(false);
  }

  async function askVerseQuestion(event?: FormEvent) {
    event?.preventDefault();
    if (!selectedVerseList.length) return;
    if (!question.trim()) return;

    openPanel("ask");
    setIsAnswering(true);
    setAnswer("");

    const response = await fetch("/api/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        book: passage.book.id,
        chapter: passage.chapter,
        verses: selectedVerseList.map((verse) => verse.verse),
        question,
        apiKey: settings.apiKey.trim() || undefined,
        originalTranslation: selectedOriginalSource(),
      }),
    });
    const data = await response.json();
    setAnswer(data.answer ?? "暫時未能回答。");
    setIsAnswering(false);
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
                  {book.displayName}
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

          <button
            type="button"
            className="settings-trigger"
            onClick={() => setSettingsOpen(true)}
            title="設定"
            aria-label="設定"
          >
            <Settings size={19} />
          </button>
        </div>
      </section>

      {settingsOpen && (
        <div className="settings-layer" role="dialog" aria-modal="true" aria-label="閱讀設定">
          <form className="settings-panel" onSubmit={saveSettings}>
            <div className="settings-heading">
              <div>
                <p className="eyebrow">閱讀設定</p>
                <h2>字體、顏色、Gemini API</h2>
              </div>
              <button
                type="button"
                className="icon-button"
                onClick={() => setSettingsOpen(false)}
                aria-label="關閉設定"
                title="關閉"
              >
                <X size={19} />
              </button>
            </div>

            <label className="setting-row">
              <span>經文字體大小：{settings.fontSize}px</span>
              <input
                type="range"
                min="16"
                max="30"
                value={settings.fontSize}
                onChange={(event) => updateSetting("fontSize", Number(event.target.value))}
              />
            </label>

            <div className="source-settings">
              <p className="setting-title">原文源頭</p>
              <label className="setting-row">
                <span>舊約原文源頭</span>
                <select value={settings.oldOriginalSource} disabled>
                  <option value="WLC">《威斯敏斯特列寧格勒抄本》</option>
                </select>
              </label>
              <label className="setting-row">
                <span>新約原文源頭</span>
                <select
                  value={settings.newOriginalSource}
                  onChange={(event) =>
                    updateSetting(
                      "newOriginalSource",
                      event.target.value as ReaderSettings["newOriginalSource"],
                    )
                  }
                >
                  <option value="Byz">《拜占庭文本形態二零一三》</option>
                  <option value="TR">《公認文本》</option>
                  <option value="StatResGNT">《統計復原希臘文新約》</option>
                </select>
              </label>
              <label className="setting-row">
                <span>直接講你想要咩原文源頭</span>
                <input
                  value={settings.originalSourceRequest}
                  placeholder="例如：我想用公認文本 / 拜占庭 / 現代復原 / 舊約希伯來文"
                  onChange={(event) =>
                    updateSetting("originalSourceRequest", event.target.value)
                  }
                />
              </label>
              <button
                type="button"
                className="source-match-button"
                onClick={applyOriginalSourceRequest}
              >
                配對源頭
              </button>
              {settings.originalSourceSuggestion && (
                <p className="source-suggestion">{settings.originalSourceSuggestion}</p>
              )}
            </div>

            <div className="color-grid">
              <label>
                <span>頁面背景</span>
                <input
                  type="color"
                  value={settings.pageBackground}
                  onChange={(event) => updateSetting("pageBackground", event.target.value)}
                />
              </label>
              <label>
                <span>經文背景</span>
                <input
                  type="color"
                  value={settings.paperBackground}
                  onChange={(event) => updateSetting("paperBackground", event.target.value)}
                />
              </label>
              <label>
                <span>面板背景</span>
                <input
                  type="color"
                  value={settings.panelBackground}
                  onChange={(event) => updateSetting("panelBackground", event.target.value)}
                />
              </label>
              <label>
                <span>文字顏色</span>
                <input
                  type="color"
                  value={settings.textColor}
                  onChange={(event) => updateSetting("textColor", event.target.value)}
                />
              </label>
              <label>
                <span>輔助文字</span>
                <input
                  type="color"
                  value={settings.softTextColor}
                  onChange={(event) => updateSetting("softTextColor", event.target.value)}
                />
              </label>
              <label>
                <span>重點顏色</span>
                <input
                  type="color"
                  value={settings.accentColor}
                  onChange={(event) => updateSetting("accentColor", event.target.value)}
                />
              </label>
              <label>
                <span>線條顏色</span>
                <input
                  type="color"
                  value={settings.lineColor}
                  onChange={(event) => updateSetting("lineColor", event.target.value)}
                />
              </label>
            </div>

            <label className="setting-row">
                <span>Gemini API 金鑰</span>
              <input
                type="password"
                value={settings.apiKey}
                placeholder="AIza..."
                autoComplete="off"
                onChange={(event) => updateSetting("apiKey", event.target.value)}
              />
            </label>

            <p className="settings-note">
              API key 只會儲存在此瀏覽器，不會寫入 GitHub。公開電腦請不要儲存私人 key。
            </p>

            <div className="settings-actions">
              <button type="button" onClick={resetSettings}>
                <RotateCcw size={16} />
                重設
              </button>
              <button type="submit">
                <Save size={16} />
                儲存設定
              </button>
            </div>
            {savedMessage && <p className="saved-message">{savedMessage}</p>}
          </form>
        </div>
      )}

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
            <option value="WLC">威斯敏斯特列寧格勒抄本</option>
            <option value="Byz">拜占庭文本形態</option>
            <option value="TR">公認文本</option>
            <option value="StatResGNT">統計復原希臘文新約</option>
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
            <span>{isLoadingPassage ? "讀取中" : "《和合本》"}</span>
          </div>

          <div className="selection-toolbar" aria-label="所選經文操作">
            <div>
              <strong>已選 {selectedVerseList.length} 節</strong>
              <span>{selectedVerseList.length ? selectedReference() : "剔選經文後開始查考"}</span>
            </div>
            <div className="selection-actions">
              <button
                type="button"
                onClick={() => {
                  openPanel("compare");
                }}
                disabled={!selectedVerseList.length}
              >
                <Languages size={15} />
                原文對照
              </button>
              <button
                type="button"
                onClick={() => void explainSelection()}
                disabled={!selectedVerseList.length || isExplaining}
              >
                {isExplaining ? <Loader2 className="spin" size={15} /> : <Sparkles size={15} />}
                原文解釋
              </button>
              <button
                type="button"
                onClick={() => {
                  openPanel("ask");
                }}
                disabled={!selectedVerseList.length}
              >
                <CircleHelp size={15} />
                問經文
              </button>
              <button
                type="button"
                className="quiet-action"
                onClick={() => {
                  setSelectedVerses(passage.verses.map((verse) => verse.verse));
                }}
              >
                全選
              </button>
              <button
                type="button"
                className="quiet-action"
                onClick={() => {
                  setSelectedVerses([]);
                }}
              >
                清除
              </button>
            </div>
          </div>

          <div className="verses">
            {passage.verses.map((verse) => (
              <article
                key={verse.verse}
                data-verse={`${passage.book.id}-${passage.chapter}-${verse.verse}`}
                className={
                  selectedVerses.includes(verse.verse)
                    ? "verse active"
                    : "verse"
                }
              >
                <label className="verse-check">
                  <input
                    type="checkbox"
                    checked={selectedVerses.includes(verse.verse)}
                    onChange={() => toggleVerseSelection(verse)}
                    aria-label={`選擇第 ${verse.verse} 節`}
                  />
                  <span>{verse.verse}</span>
                </label>
                <p>{verse.chinese}</p>
              </article>
            ))}
          </div>
        </section>

        {panelMode !== "closed" && (
        <aside ref={studyPaneRef} className="study-pane" aria-label="原文查經面板">
          <div className="panel-tabs">
            <button
              className={panelMode === "compare" ? "selected" : ""}
              onClick={() => openPanel("compare")}
            >
              <LibraryBig size={16} />
              對照
            </button>
            <button
              className={panelMode === "explain" ? "selected" : ""}
              onClick={() => void explainSelection()}
              disabled={!selectedVerseList.length}
            >
              <BookOpen size={16} />
              解釋
            </button>
            <button
              className={panelMode === "ask" ? "selected" : ""}
              onClick={() => openPanel("ask")}
            >
              <CircleHelp size={16} />
              問經文
            </button>
            <button onClick={() => setPanelMode("closed")} title="關閉">
              <X size={16} />
              關閉
            </button>
          </div>

          {selectedVerseList.length ? (
            <div className="panel-body">
              <p className="reference">
                {selectedReference()}
              </p>

              {panelMode === "compare" ? (
                <div className="comparison">
                  {selectedVerseList.map((verse) => (
                    <section className="comparison-verse" key={verse.verse}>
                      <h3>第 {verse.verse} 節</h3>
                      <div>
                        <span>和合本</span>
                        <p>{verse.chinese}</p>
                      </div>
                      <div className="selected-source">
                        <span>目前原文源頭：{originalLabels[selectedOriginalSource()]}</span>
                        <p dir={selectedOriginalSource() === "WLC" ? "rtl" : "ltr"}>
                          {verse.alternates[selectedOriginalSource()] ||
                            verse.original ||
                            "此節暫未有對應原文資料。"}
                        </p>
                      </div>
                      {Object.entries(verse.alternates).map(([translation, text]) => (
                        translation === selectedOriginalSource() ? null : (
                        <div key={translation}>
                          <span>{originalLabels[translation as TranslationId]}</span>
                          <p dir={translation === "WLC" ? "rtl" : "ltr"}>{text}</p>
                        </div>
                        )
                      ))}
                    </section>
                  ))}
                </div>
              ) : panelMode === "explain" ? (
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
              ) : (
                <form className="question-box" onSubmit={askVerseQuestion}>
                  <label>
                    <span>問一條關於所選經文的問題</span>
                    <textarea
                      value={question}
                      onChange={(event) => setQuestion(event.target.value)}
                      placeholder="例如：這幾節經文主要怎樣描述基督？"
                    />
                  </label>
                  <button type="submit" disabled={isAnswering || !question.trim()}>
                    {isAnswering ? <Loader2 className="spin" size={16} /> : <CircleHelp size={16} />}
                    用 Gemini 回答
                  </button>
                  <div className="explanation answer-box">
                    {isAnswering ? (
                      <div className="loading-line">
                        <Loader2 className="spin" size={18} />
                        正在整理回答...
                      </div>
                    ) : (
                      <pre>{answer || "輸入問題後，會按所選經文、譯本與原文源頭回答。"}</pre>
                    )}
                  </div>
                </form>
              )}
            </div>
          ) : (
            <p className="empty-state">剔選一節或多節經文開始查考。</p>
          )}
        </aside>
        )}
      </div>
    </main>
  );
}
