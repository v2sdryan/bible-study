import { NextResponse } from "next/server";
import { z } from "zod";
import { searchBible } from "@/lib/bible";

const querySchema = z.object({
  q: z.string().min(1),
  translation: z.enum(["ChiUn", "WLC", "Byz", "TR", "StatResGNT"]).default("ChiUn"),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse(Object.fromEntries(searchParams));

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid search query" }, { status: 400 });
  }

  return NextResponse.json({
    query: parsed.data.q,
    results: searchBible(parsed.data.q, parsed.data.translation),
  });
}
