import { NextResponse } from "next/server";
import { z } from "zod";
import { getVerse } from "@/lib/bible";

const requestSchema = z.object({
  book: z.string(),
  chapter: z.number().int().positive(),
  verse: z.number().int().positive(),
});

function fallbackExplanation(verse: NonNullable<ReturnType<typeof getVerse>>) {
  const source =
    verse.originalTranslation === "WLC"
      ? "舊約原文以希伯來文為主；但以理書、以斯拉記等部分段落含亞蘭文。"
      : "新約文本以通用希臘文為主；福音書處於猶太及亞蘭語背景，經文本身保留亞蘭詞時會特別留意。";

  return [
    `【${verse.book.displayName} ${verse.chapter}:${verse.verse}】`,
    "",
    `和合本：${verse.chinese}`,
    verse.original ? `原文：${verse.original}` : "原文：此節暫未有對應原文資料。",
    "",
    source,
    "Gemini API key 未設定，所以暫時顯示基本原文對照。設定 GEMINI_API_KEY 後，這裡會產生查經語氣的繁體中文解釋。",
  ].join("\n");
}

async function generateWithGemini(verse: NonNullable<ReturnType<typeof getVerse>>) {
  const apiKey = process.env.GEMINI_API_KEY;
  const model = process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite";

  if (!apiKey) return fallbackExplanation(verse);

  const prompt = `
請用繁體中文、查經語氣解釋以下經文，保持謹慎，不要作過度斷言。

要求：
1. 先簡短說明經文主旨。
2. 解釋原文中 2-5 個重要字詞，包含原文字詞、簡短音譯或讀音提示、字義。
3. 如屬舊約，指出希伯來文/亞蘭文背景；如屬新約，指出希臘文背景，有亞蘭語境時只作背景提醒。
4. 最後給一段查經反思，避免直接代替講章。

經文：${verse.book.displayName} ${verse.chapter}:${verse.verse}
和合本：${verse.chinese}
原文版本：${verse.originalTranslation}
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
    return `${fallbackExplanation(verse)}\n\nGemini 回應失敗：${response.status}`;
  }

  const data = await response.json();
  return (
    data?.candidates?.[0]?.content?.parts
      ?.map((part: { text?: string }) => part.text ?? "")
      .join("")
      .trim() || fallbackExplanation(verse)
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid explanation request" }, { status: 400 });
  }

  const verse = getVerse(parsed.data.book, parsed.data.chapter, parsed.data.verse);
  if (!verse) {
    return NextResponse.json({ error: "Verse not found" }, { status: 404 });
  }

  const explanation = await generateWithGemini(verse);
  return NextResponse.json({ explanation });
}
