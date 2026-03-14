import { NextRequest, NextResponse } from "next/server";
import { autocompleteAddress } from "@/lib/digitransit";

export async function GET(request: NextRequest) {
  const text = request.nextUrl.searchParams.get("text");
  if (!text) {
    return NextResponse.json({ error: "text parameter required" }, { status: 400 });
  }

  const results = await autocompleteAddress(text);
  return NextResponse.json(results);
}
