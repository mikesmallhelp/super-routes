import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const trips = await getPrisma().trip.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });

  const mapped = trips.map((t) => ({
    id: t.id,
    originLabel: t.originLabel,
    destinationLabel: t.destinationLabel,
    originCoords: { latitude: t.originLat, longitude: t.originLon },
    destinationCoords: { latitude: t.destLat, longitude: t.destLon },
    selectedVehicles: t.selectedVehicles,
    excludedVehicles: t.excludedVehicles,
    vehicleFilterMode: t.vehicleFilterMode as "and" | "or",
  }));

  return NextResponse.json(mapped);
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  const trip = await getPrisma().trip.create({
    data: {
      userId: session.user.id,
      originLabel: body.originLabel,
      destinationLabel: body.destinationLabel,
      originLat: body.originCoords.latitude,
      originLon: body.originCoords.longitude,
      destLat: body.destinationCoords.latitude,
      destLon: body.destinationCoords.longitude,
      selectedVehicles: body.selectedVehicles,
      excludedVehicles: body.excludedVehicles ?? [],
      vehicleFilterMode: body.vehicleFilterMode ?? "and",
    },
  });

  return NextResponse.json({
    id: trip.id,
    originLabel: trip.originLabel,
    destinationLabel: trip.destinationLabel,
    originCoords: { latitude: trip.originLat, longitude: trip.originLon },
    destinationCoords: { latitude: trip.destLat, longitude: trip.destLon },
    selectedVehicles: trip.selectedVehicles,
    excludedVehicles: trip.excludedVehicles,
    vehicleFilterMode: trip.vehicleFilterMode as "and" | "or",
  });
}
