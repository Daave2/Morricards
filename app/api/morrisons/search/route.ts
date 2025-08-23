// app/api/morrisons/search/route.ts
import { NextRequest, NextResponse } from "next/server";
import { morrisonsSearch } from "@/lib/morrisonsSearch";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const maxPageSize = Number(searchParams.get("maxPageSize") || "60");
  const maxProductsToDecorate = Number(searchParams.get("maxProductsToDecorate") || "30");

  if (!q.trim()) {
    return NextResponse.json({ hits: [], raw: null, error: "Missing q" }, { status: 400 });
  }

  try {
    const data = await morrisonsSearch(q, {
      maxPageSize,
      maxProductsToDecorate,
      // cookie comes from process.env.MORRISONS_COOKIE if you set it
    });
    return NextResponse.json(data, { status: 200 });
  } catch (e: any) {
    return NextResponse.json(
      { hits: [], raw: null, error: String(e?.message ?? e) },
      { status: 502 }
    );
  }
}
