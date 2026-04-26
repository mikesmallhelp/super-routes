import { NextRequest, NextResponse } from "next/server";
import { fetchRoutes } from "@/lib/digitransit";
import { auth } from "@/lib/auth";
import { recordDigitransitApiCall } from "@/lib/user-usage";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { origin, destination, numItineraries, dateTime } = body;

  if (!origin || !destination) {
    return NextResponse.json(
      { error: "origin and destination required" },
      { status: 400 }
    );
  }

  try {
    const session = await auth();
    await recordDigitransitApiCall(session?.user?.id);
    const connections = await fetchRoutes(origin, destination, numItineraries || 5, dateTime);
    return NextResponse.json({ connections });
  } catch (error) {
    console.error("Route fetch error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch routes" },
      { status: 500 }
    );
  }
}
