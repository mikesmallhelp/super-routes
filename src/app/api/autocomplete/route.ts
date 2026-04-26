import { NextRequest, NextResponse } from "next/server";
import { autocompleteAddress } from "@/lib/digitransit";
import { auth } from "@/lib/auth";
import { recordDigitransitApiCall } from "@/lib/user-usage";

export async function GET(request: NextRequest) {
  const text = request.nextUrl.searchParams.get("text");
  if (!text) {
    return NextResponse.json({ error: "text parameter required" }, { status: 400 });
  }

  const session = await auth();
  if (text.length >= 2) {
    await recordDigitransitApiCall(session?.user?.id);
  }

  const results = await autocompleteAddress(text);
  return NextResponse.json(results);
}
