# 和合本原文查經

繁體中文聖經閱讀、原文對照、Gemini 查經解釋工具。預設顯示 `ChiUn` 和合本繁體，舊約原文用 `WLC`，新約原文用 `Byz`，並保留 `TR` / `StatResGNT` 對照。

## Features

- 和合本繁體閱讀器，支援書卷及章節切換
- 每節經文有「原文解釋」及「原文對照」
- 繁中、希伯來文、希臘文搜尋
- Gemini API server-side route，預設 model 為 `gemini-3.1-flash-lite`
- 可直接部署到 Vercel

## Data Source

Bible data is synced from [scrollmapper/bible_databases](https://github.com/scrollmapper/bible_databases).

Included translations:

- `ChiUn`: 和合本（繁體）
- `WLC`: Westminster Leningrad Codex
- `Byz`: Byzantine Textform 2013
- `TR`: Textus Receptus
- `StatResGNT`: Statistical Restoration Greek NT

## Local Development

```bash
npm install
npm run sync:data
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

```env
GEMINI_API_KEY=your_google_ai_studio_key
GEMINI_MODEL=gemini-3.1-flash-lite
```

Do not use `NEXT_PUBLIC_` for `GEMINI_API_KEY`; it must stay server-side.

## Deploy To Vercel

1. Push this folder to GitHub.
2. Import the GitHub repository in Vercel.
3. Add `GEMINI_API_KEY` and `GEMINI_MODEL` in Vercel Project Settings.
4. Deploy.

Vercel build command can stay as:

```bash
npm run build
```

The synced Bible JSON is committed in `data/bible/library.json`, so Vercel does not need to download the source data during build.
