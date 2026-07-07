import { NextRequest, NextResponse } from "next/server";
import { fetchStopCoordsByCode } from "@/lib/digitransit";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "code required" }, { status: 400 });
  }

  const stop = await fetchStopCoordsByCode(code);
  if (!stop) {
    return NextResponse.json({ error: "Stop not found" }, { status: 404 });
  }

  return NextResponse.json(stop);
}
