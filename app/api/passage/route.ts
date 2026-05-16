import { NextResponse } from "next/server";
import { z } from "zod";
import { getBooks, getPassage } from "@/lib/bible";

const querySchema = z.object({
  book: z.string().default("Matthew"),
  chapter: z.coerce.number().int().positive().default(1),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid passage query" }, { status: 400 });
  }

  const passage = getPassage(parsed.data.book, parsed.data.chapter);
  if (!passage) {
    return NextResponse.json({ error: "Passage not found" }, { status: 404 });
  }

  return NextResponse.json({
    books: getBooks(),
    passage,
  });
}
