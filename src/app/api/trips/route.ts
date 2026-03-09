import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const trips = await getPrisma().trip.findMany({
    orderBy: { createdAt: "asc" },
  });

  const mapped = trips.map((t) => ({
    id: t.id,
    originLabel: t.originLabel,
    destinationLabel: t.destinationLabel,
    originCoords: { latitude: t.originLat, longitude: t.originLon },
    destinationCoords: { latitude: t.destLat, longitude: t.destLon },
    selectedVehicles: t.selectedVehicles,
  }));

  return NextResponse.json(mapped);
}

export async function POST(request: NextRequest) {
  const body = await request.json();

  const trip = await getPrisma().trip.create({
    data: {
      originLabel: body.originLabel,
      destinationLabel: body.destinationLabel,
      originLat: body.originCoords.latitude,
      originLon: body.originCoords.longitude,
      destLat: body.destinationCoords.latitude,
      destLon: body.destinationCoords.longitude,
      selectedVehicles: body.selectedVehicles,
    },
  });

  return NextResponse.json({
    id: trip.id,
    originLabel: trip.originLabel,
    destinationLabel: trip.destinationLabel,
    originCoords: { latitude: trip.originLat, longitude: trip.originLon },
    destinationCoords: { latitude: trip.destLat, longitude: trip.destLon },
    selectedVehicles: trip.selectedVehicles,
  });
}
