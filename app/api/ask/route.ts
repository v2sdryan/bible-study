import { NextResponse } from "next/server";
import { z } from "zod";
import { getVerse } from "@/lib/bible";

const requestSchema = z.object({
  book: z.string(),
  chapter: z.number().int().positive(),
  verse: z.number().int().positive(),
  question: z.string().trim().min(1),
  apiKey: z.string().trim().optional(),
  originalTranslation: z.enum(["WLC", "Byz", "TR", "StatResGNT"]).optional(),
});

function originalSourceName(translation: string) {
  if (translation === "WLC") return "《威斯敏斯特列寧格勒抄本》";
  if (translation === "Byz") return "《拜占庭文本形態二零一三》";
  if (translation === "TR") return "《公認文本》";
  if (translation === "StatResGNT") return "《統計復原希臘文新約》";
  return translation;
}

function sourceHeader(verse: NonNullable<ReturnType<typeof getVerse>>) {
  const testamentNote =
    verse.originalTranslation === "WLC"
      ? "舊約原文底本。主要為希伯來文；但以理書、以斯拉記等部分段落含亞蘭文。"
      : "新約原文底本。主要為通用希臘文；福音書有猶太及亞蘭語背景，但文本底本按希臘文處理。";

  return [
    "【回答來源】",
    "中文譯本：《和合本（繁體字）》",
    `原文底本：${originalSourceName(verse.originalTranslation)}`,
    "資料來源：GitHub「scrollmapper/bible_databases」聖經資料庫",
    `原文判斷：${testamentNote}`,
  ].join("\n");
}

function fallbackAnswer(
  verse: NonNullable<ReturnType<typeof getVerse>>,
  question: string,
) {
  return [
    sourceHeader(verse),
    "",
    `問題：${question}`,
    "",
    `經文：${verse.book.displayName} ${verse.chapter}:${verse.verse}`,
    `和合本：${verse.chinese}`,
    verse.original ? `原文：${verse.original}` : "原文：此節暫未有對應原文資料。",
    "",
    "Gemini API key 未設定，所以暫時只能顯示經文與來源。請在設定輸入 Gemini API key 後再提問。",
  ].join("\n");
}

async function answerWithGemini(
  verse: NonNullable<ReturnType<typeof getVerse>>,
  question: string,
  browserApiKey?: string,
) {
  const apiKey = browserApiKey || process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite";

  if (!apiKey) return fallbackAnswer(verse, question);

  const prompt = `
請用繁體中文、查經語氣回答使用者關於經文的問題。請保持謹慎，不要作過度斷言。

要求：
1. 回答開頭必須逐字保留以下「回答來源」段落，不可刪走、不可改寫、不可省略。
2. 先直接回答問題。
3. 如有需要，引用和合本經文與原文底本，但不要拉太遠。
4. 如問題超出此經文可支持的範圍，請清楚說明「這節經文未能直接證明」。
5. 最後給一個簡短查經反思。

${sourceHeader(verse)}

使用者問題：${question}
經文：${verse.book.displayName} ${verse.chapter}:${verse.verse}
和合本：${verse.chinese}
原文底本：${originalSourceName(verse.originalTranslation)}
原文：${verse.original || "未有原文資料"}
`.trim();

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
    return `${fallbackAnswer(verse, question)}\n\nGemini 回應失敗：${response.status}`;
  }

  const data = await response.json();
  return (
    data?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? "")
      .join("")
      .trim() || fallbackAnswer(verse, question)
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "提問資料無效" }, { status: 400 });
  }

  const verse = getVerse(parsed.data.book, parsed.data.chapter, parsed.data.verse);
  if (!verse) {
    return NextResponse.json({ error: "找不到經文" }, { status: 404 });
  }

  const requestedOriginal = parsed.data.originalTranslation;
  const answerVerse =
    requestedOriginal && verse.alternates[requestedOriginal]
      ? {
          ...verse,
          originalTranslation: requestedOriginal,
          original: verse.alternates[requestedOriginal] ?? verse.original,
        }
      : verse;

  const answer = await answerWithGemini(
    answerVerse,
    parsed.data.question,
    parsed.data.apiKey,
  );
  return NextResponse.json({ answer });
}
