import { NextResponse } from "next/server";
import { z } from "zod";
import { getVerse } from "@/lib/bible";

const requestSchema = z.object({
  book: z.string(),
  chapter: z.number().int().positive(),
  verse: z.number().int().positive().optional(),
  verses: z.array(z.number().int().positive()).optional(),
  apiKey: z.string().trim().optional(),
  originalTranslation: z.enum(["WLC", "Byz", "TR", "StatResGNT"]).optional(),
});

type VerseRecord = NonNullable<ReturnType<typeof getVerse>>;

function geminiApiKeys(browserApiKey?: string) {
  return [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    browserApiKey,
  ]
    .map((key) => key?.trim())
    .filter((key): key is string => Boolean(key));
}

function shouldTryNextKey(status: number) {
  return status === 429;
}

function originalSourceName(translation: string) {
  if (translation === "WLC") return "《威斯敏斯特列寧格勒抄本》";
  if (translation === "Byz") return "《拜占庭文本形態二零一三》";
  if (translation === "TR") return "《公認文本》";
  if (translation === "StatResGNT") return "《統計復原希臘文新約》";
  return translation;
}

function sourceHeader(verse: VerseRecord) {
  const testamentNote =
    verse.originalTranslation === "WLC"
      ? "舊約原文底本。主要為希伯來文；但以理書、以斯拉記等部分段落含亞蘭文。"
      : "新約原文底本。主要為通用希臘文；福音書有猶太及亞蘭語背景，但文本底本按希臘文處理。";

  return [
    "【釋經來源】",
    "中文譯本：《和合本（繁體字）》",
    `原文底本：${originalSourceName(verse.originalTranslation)}`,
    "資料來源：GitHub「scrollmapper/bible_databases」聖經資料庫",
    `原文判斷：${testamentNote}`,
  ].join("\n");
}

function fallbackExplanation(verses: VerseRecord[]) {
  const firstVerse = verses[0];
  return [
    sourceHeader(firstVerse),
    "",
    `【${firstVerse.book.displayName} ${firstVerse.chapter}:${verses.map((verse) => verse.verse).join("、")}】`,
    "",
    ...verses.flatMap((verse) => [
      `第 ${verse.verse} 節和合本：${verse.chinese}`,
      verse.original
        ? `第 ${verse.verse} 節原文：${verse.original}`
        : `第 ${verse.verse} 節原文：此節暫未有對應原文資料。`,
      "",
    ]),
    "",
    "Gemini API key 未設定，所以暫時顯示基本原文對照。你可以在右上角設定輸入 API key，或在 Vercel 設定 GEMINI_API_KEY。",
  ].join("\n");
}

async function generateWithGemini(
  verses: VerseRecord[],
  browserApiKey?: string,
) {
  const apiKeys = geminiApiKeys(browserApiKey);
  const model = process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite";

  if (!apiKeys.length) return fallbackExplanation(verses);

  const firstVerse = verses[0];
  const passageText = verses
    .map((verse) =>
      [
        `${verse.book.displayName} ${verse.chapter}:${verse.verse}`,
        `和合本：${verse.chinese}`,
        `原文：${verse.original || "未有原文資料"}`,
      ].join("\n"),
    )
    .join("\n\n");

  const prompt = `
請用繁體中文、查經語氣解釋以下經文，保持謹慎，不要作過度斷言。

要求：
1. 回答開頭必須逐字保留以下「釋經來源」段落，不可刪走、不可改寫、不可省略。
2. 然後簡短說明經文主旨。
3. 解釋原文中 2-5 個重要字詞，包含原文字詞、簡短音譯或讀音提示、字義。
4. 如屬舊約，指出希伯來文/亞蘭文背景；如屬新約，指出希臘文背景，有亞蘭語境時只作背景提醒。
5. 最後給一段查經反思，避免直接代替講章。

${sourceHeader(firstVerse)}

所選經文：
${passageText}
原文底本：${originalSourceName(firstVerse.originalTranslation)}
`.trim();

  for (const [index, apiKey] of apiKeys.entries()) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.35,
            maxOutputTokens: 900,
          },
        }),
      },
    );

    if (!response.ok) {
      const hasNextKey = index < apiKeys.length - 1;
      if (hasNextKey && shouldTryNextKey(response.status)) continue;
      return `${fallbackExplanation(verses)}\n\nGemini 回應失敗：${response.status}`;
    }

    const data = await response.json();
    return (
      data?.candidates?.[0]?.content?.parts
        ?.map((part: { text?: string }) => part.text ?? "")
        .join("")
        .trim() || fallbackExplanation(verses)
    );
  }

  return `${fallbackExplanation(verses)}\n\nGemini 回應失敗：所有 API key 已達使用限制。`;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid explanation request" }, { status: 400 });
  }

  const verseNumbers = parsed.data.verses?.length
    ? parsed.data.verses
    : parsed.data.verse
      ? [parsed.data.verse]
      : [];

  if (!verseNumbers.length) {
    return NextResponse.json({ error: "請選擇經文" }, { status: 400 });
  }

  const verses = verseNumbers
    .slice(0, 12)
    .map((verseNumber) => getVerse(parsed.data.book, parsed.data.chapter, verseNumber));

  if (verses.some((verse) => !verse)) {
    return NextResponse.json({ error: "找不到經文" }, { status: 404 });
  }

  const requestedOriginal = parsed.data.originalTranslation;
  const explanationVerses = (verses as VerseRecord[]).map((verse) =>
    requestedOriginal && verse.alternates[requestedOriginal]
      ? {
          ...verse,
          originalTranslation: requestedOriginal,
          original: verse.alternates[requestedOriginal] ?? verse.original,
        }
      : verse,
  );

  const explanation = await generateWithGemini(explanationVerses, parsed.data.apiKey);
  return NextResponse.json({ explanation });
}
