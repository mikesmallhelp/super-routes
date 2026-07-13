import { NextRequest, NextResponse } from "next/server";
import GtfsRealtimeBindings from "gtfs-realtime-bindings";
import type { Connection, Leg } from "@/lib/types";
import { fetchRoutes, fetchStopCoordsByCode } from "@/lib/digitransit";

interface VehicleMatch {
  latitude: number;
  longitude: number;
  vehicleId: string;
}

interface FeedVehicle {
  vehicleId: string;
  latitude: number;
  longitude: number;
}

function isTransitLeg(leg: Leg): boolean {
  return leg.mode !== "WALK" && !!leg.trip;
}

function stopSequenceForLeg(leg: Leg): string[] {
  const sequence: string[] = [];
  if (leg.from.stop?.code) sequence.push(leg.from.stop.code);
  if (leg.intermediateStops?.length) {
    for (const stop of leg.intermediateStops) {
      if (stop.code) sequence.push(stop.code);
    }
  }
  if (leg.to.stop?.code) sequence.push(leg.to.stop.code);
  return sequence;
}

function legGoesFromFirstToLast(leg: Leg, firstCode: string, lastCode: string): boolean {
  const sequence = stopSequenceForLeg(leg);
  if (sequence.length === 0) return false;
  const firstIdx = sequence.indexOf(firstCode);
  const lastIdx = sequence.indexOf(lastCode);
  return firstIdx !== -1 && lastIdx !== -1 && firstIdx < lastIdx;
}

function normalizeVehicleId(vehicleId: string): string {
  return vehicleId.startsWith("HSL:") ? vehicleId.slice(4) : vehicleId;
}

async function fetchRealtimeVehicles(): Promise<FeedVehicle[]> {
  const res = await fetch("https://realtime.hsl.fi/realtime/vehicle-positions/v2/hsl", {
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`GTFS-RT feed fetch failed (${res.status})`);
  }
  const raw = Buffer.from(await res.arrayBuffer());
  const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(raw) as {
    entity?: Array<{
      vehicle?: {
        trip?: { routeId?: string | null } | null;
        vehicle?: { id?: string | null } | null;
        position?: { latitude?: number | null; longitude?: number | null } | null;
      } | null;
    }>;
  };

  const vehicles: FeedVehicle[] = [];
  for (const entity of feed.entity ?? []) {
    const vehicle = entity.vehicle;
    const routeId = vehicle?.trip?.routeId ?? null;
    const vehicleId = vehicle?.vehicle?.id ?? null;
    const latitude = vehicle?.position?.latitude;
    const longitude = vehicle?.position?.longitude;
    if (
      !routeId ||
      !vehicleId ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      continue;
    }
    vehicles.push({
      vehicleId: normalizeVehicleId(vehicleId),
      latitude: Number(latitude),
      longitude: Number(longitude),
    });
  }

  return vehicles;
}

async function fetchVehicleSearchConnections(
  firstStop: { lat: number; lon: number },
  lastStop: { lat: number; lon: number }
): Promise<Connection[]> {
  const offsetsMin = [-20, -5, 0, 10, 20];
  const now = Date.now();

  const batches = await Promise.all(
    offsetsMin.map(async (offsetMin) => {
      const dateTime = new Date(now + offsetMin * 60_000).toISOString();
      try {
        return await fetchRoutes(
          { latitude: firstStop.lat, longitude: firstStop.lon },
          { latitude: lastStop.lat, longitude: lastStop.lon },
          30,
          dateTime
        );
      } catch (error) {
        console.error(
          `[Mock] Vehicle search route fetch failed for offset ${offsetMin} min:`,
          error
        );
        return [];
      }
    })
  );

  return batches.flat();
}

function collectDirectionalCandidates(
  connections: Connection[],
  firstCode: string,
  lastCode: string
): Set<string> {
  const vehicleIds = new Set<string>();

  for (const connection of connections) {
    for (const leg of connection.legs) {
      if (!isTransitLeg(leg)) continue;
      if (!legGoesFromFirstToLast(leg, firstCode, lastCode)) continue;

      const vehicleId = leg.trip?.vehiclePosition?.vehicleId;
      if (vehicleId) vehicleIds.add(normalizeVehicleId(vehicleId));
    }
  }

  return vehicleIds;
}

function findVehicleByLockedId(
  feedVehicles: FeedVehicle[],
  lockedVehicleId: string
): VehicleMatch | null {
  const normalized = normalizeVehicleId(lockedVehicleId);
  const found = feedVehicles.find((vehicle) => vehicle.vehicleId === normalized);
  if (!found) return null;
  return {
    latitude: found.latitude,
    longitude: found.longitude,
    vehicleId: `HSL:${found.vehicleId}`,
  };
}

function findVehicleByCandidates(
  feedVehicles: FeedVehicle[],
  candidateVehicleIds: Set<string>
): VehicleMatch | null {
  for (const vehicle of feedVehicles) {
    if (candidateVehicleIds.has(vehicle.vehicleId)) {
      return {
        latitude: vehicle.latitude,
        longitude: vehicle.longitude,
        vehicleId: `HSL:${vehicle.vehicleId}`,
      };
    }
  }
  return null;
}

function env(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export async function GET(request: NextRequest) {
  const lockedVehicleId = request.nextUrl.searchParams.get("lockedVehicleId");
  const vehicleStopFirst = env("NEXT_PUBLIC_MOCK_VEHICLE_STOP_FIRST");
  const vehicleStopLast = env("NEXT_PUBLIC_MOCK_VEHICLE_STOP_LAST");

  if (vehicleStopFirst && vehicleStopLast) {
    const firstStop = await fetchStopCoordsByCode(vehicleStopFirst);
    const lastStop = await fetchStopCoordsByCode(vehicleStopLast);

    if (!firstStop || !lastStop) {
      console.error(
        `[Mock] Vehicle stop code lookup failed: ${vehicleStopFirst} -> ${vehicleStopLast}`
      );
    } else {
      let vehicle: VehicleMatch | null = null;
      if (lockedVehicleId) {
        const feedVehicles = await fetchRealtimeVehicles();
        vehicle = findVehicleByLockedId(feedVehicles, lockedVehicleId);
      } else {
        const [connections, feedVehicles] = await Promise.all([
          fetchVehicleSearchConnections(firstStop, lastStop),
          fetchRealtimeVehicles(),
        ]);
        const candidateVehicleIds = collectDirectionalCandidates(
          connections,
          vehicleStopFirst,
          vehicleStopLast
        );
        vehicle = findVehicleByCandidates(feedVehicles, candidateVehicleIds);
      }
      if (vehicle) {
        return NextResponse.json({
          enabled: true,
          mode: "vehicle",
          latitude: vehicle.latitude,
          longitude: vehicle.longitude,
          vehicleId: vehicle.vehicleId,
        });
      }
      if (lockedVehicleId) {
        console.error(
          `[Mock] Locked vehicle ${lockedVehicleId} not found in current routing feed snapshot.`
        );
        return NextResponse.json({ enabled: false });
      }
      console.error(
        `[Mock] No vehicle found between ${vehicleStopFirst} -> ${vehicleStopLast}; ` +
          "vehicle mock is ignored for this request."
      );
    }
  }

  const mockStopCode = env("NEXT_PUBLIC_MOCK_STOP");
  if (mockStopCode) {
    const stop = await fetchStopCoordsByCode(mockStopCode);
    if (!stop) {
      return NextResponse.json(
        { error: `Stop not found: ${mockStopCode}` },
        { status: 404 }
      );
    }
    return NextResponse.json({
      enabled: true,
      mode: "stop",
      latitude: stop.lat,
      longitude: stop.lon,
      stopCode: mockStopCode,
      stopName: stop.name,
    });
  }

  return NextResponse.json({ enabled: false });
}
