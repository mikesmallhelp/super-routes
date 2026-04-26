import { NextRequest, NextResponse } from "next/server";
import { geocodeAddress } from "@/lib/digitransit";
import { auth } from "@/lib/auth";
import { recordDigitransitApiCall } from "@/lib/user-usage";

export async function GET(request: NextRequest) {
  const text = request.nextUrl.searchParams.get("text");
  if (!text) {
    return NextResponse.json({ error: "text parameter required" }, { status: 400 });
  }

  const session = await auth();
  await recordDigitransitApiCall(session?.user?.id);

  const result = await geocodeAddress(text);
  if (!result) {
    return NextResponse.json({ error: "Address not found" }, { status: 404 });
  }

  return NextResponse.json(result);
}
