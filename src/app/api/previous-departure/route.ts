import { NextRequest, NextResponse } from "next/server";
import { fetchPreviousDeparture } from "@/lib/digitransit";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const stopGtfsId = searchParams.get("stopGtfsId");
  const route = searchParams.get("route");
  const before = searchParams.get("before");

  if (!stopGtfsId || !route || !before) {
    return NextResponse.json(
      { error: "stopGtfsId, route, and before parameters required" },
      { status: 400 }
    );
  }

  try {
    const result = await fetchPreviousDeparture(stopGtfsId, route, before);
    return NextResponse.json(result || { scheduledTime: null });
  } catch (error) {
    console.error("previous-departure error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed" },
      { status: 500 }
    );
  }
}
