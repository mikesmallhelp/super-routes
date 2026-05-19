import { NextRequest, NextResponse } from "next/server";
import { fetchStopDepartures } from "@/lib/digitransit";
import { auth } from "@/lib/auth";
import { recordDigitransitApiCall } from "@/lib/user-usage";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const stopGtfsId = searchParams.get("stopGtfsId");
  const after = searchParams.get("after");
  const includeRoutes = searchParams.get("includeRoutes")?.split(",").filter(Boolean) ?? [];
  const excludeRoutes = searchParams.get("excludeRoutes")?.split(",").filter(Boolean) ?? [];
  const headsign = searchParams.get("headsign") || undefined;

  if (!stopGtfsId || !after) {
    return NextResponse.json(
      { error: "stopGtfsId and after parameters required" },
      { status: 400 }
    );
  }

  try {
    const session = await auth();
    await recordDigitransitApiCall(session?.user?.id);
    const departures = await fetchStopDepartures(
      stopGtfsId,
      after,
      includeRoutes,
      excludeRoutes,
      headsign
    );
    return NextResponse.json({ departures });
  } catch (error) {
    console.error("stop-departures error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch stop departures" },
      { status: 500 }
    );
  }
}

