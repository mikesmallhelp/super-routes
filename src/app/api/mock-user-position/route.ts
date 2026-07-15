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

const LOCKED_VEHICLE_MAX_DISTANCE_FROM_CORRIDOR_M = 600;

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

function projectToMeters(lat: number, lon: number, refLat: number) {
  const metersPerDegLat = 111_320;
  const metersPerDegLon = Math.cos((refLat * Math.PI) / 180) * 111_320;
  return { x: lon * metersPerDegLon, y: lat * metersPerDegLat };
}

function distanceToSegmentMeters(
  pointLat: number,
  pointLon: number,
  startLat: number,
  startLon: number,
  endLat: number,
  endLon: number
): number {
  const refLat = (pointLat + startLat + endLat) / 3;
  const p = projectToMeters(pointLat, pointLon, refLat);
  const a = projectToMeters(startLat, startLon, refLat);
  const b = projectToMeters(endLat, endLon, refLat);
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const abLenSq = abx * abx + aby * aby;
  if (abLenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const apx = p.x - a.x;
  const apy = p.y - a.y;
  const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / abLenSq));
  const closestX = a.x + t * abx;
  const closestY = a.y + t * aby;
  return Math.hypot(p.x - closestX, p.y - closestY);
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
): string[] {
  const byVehicleId = new Map<
    string,
    { inProgress: boolean; timeDistanceMs: number }
  >();
  const nowMs = Date.now();

  for (const connection of connections) {
    for (const leg of connection.legs) {
      if (!isTransitLeg(leg)) continue;
      if (!legGoesFromFirstToLast(leg, firstCode, lastCode)) continue;

      const vehicleId = leg.trip?.vehiclePosition?.vehicleId;
      if (!vehicleId) continue;

      const normalizedId = normalizeVehicleId(vehicleId);
      const startMs = new Date(
        leg.start.estimated?.time ?? leg.start.scheduledTime
      ).getTime();
      const endMs = new Date(
        leg.end.estimated?.time ?? leg.end.scheduledTime
      ).getTime();
      const inProgress = nowMs >= startMs && nowMs <= endMs;
      const timeDistanceMs = inProgress
        ? 0
        : Math.min(Math.abs(nowMs - startMs), Math.abs(nowMs - endMs));

      const previous = byVehicleId.get(normalizedId);
      if (
        !previous ||
        (inProgress && !previous.inProgress) ||
        (inProgress === previous.inProgress &&
          timeDistanceMs < previous.timeDistanceMs)
      ) {
        byVehicleId.set(normalizedId, { inProgress, timeDistanceMs });
      }
    }
  }

  return [...byVehicleId.entries()]
    .filter(([, candidate]) => candidate.inProgress)
    .sort((a, b) => {
      return a[1].timeDistanceMs - b[1].timeDistanceMs;
    })
    .map(([vehicleId]) => vehicleId);
}

function findVehicleByLockedId(
  feedVehicles: FeedVehicle[],
  lockedVehicleId: string,
  corridorStart: { lat: number; lon: number },
  corridorEnd: { lat: number; lon: number }
): VehicleMatch | null {
  const normalized = normalizeVehicleId(lockedVehicleId);
  const found = feedVehicles.find((vehicle) => vehicle.vehicleId === normalized);
  if (!found) return null;
  const distanceFromCorridor = distanceToSegmentMeters(
    found.latitude,
    found.longitude,
    corridorStart.lat,
    corridorStart.lon,
    corridorEnd.lat,
    corridorEnd.lon
  );
  if (distanceFromCorridor > LOCKED_VEHICLE_MAX_DISTANCE_FROM_CORRIDOR_M) {
    return null;
  }
  return {
    latitude: found.latitude,
    longitude: found.longitude,
    vehicleId: `HSL:${found.vehicleId}`,
  };
}

function findVehicleByCandidates(
  feedVehicles: FeedVehicle[],
  candidateVehicleIds: string[]
): VehicleMatch | null {
  const feedByVehicleId = new Map(
    feedVehicles.map((vehicle) => [vehicle.vehicleId, vehicle])
  );
  for (const candidateVehicleId of candidateVehicleIds) {
    const vehicle = feedByVehicleId.get(candidateVehicleId);
    if (vehicle) {
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
        const [connections, feedVehicles] = await Promise.all([
          fetchVehicleSearchConnections(firstStop, lastStop),
          fetchRealtimeVehicles(),
        ]);
        const candidateVehicleIds = collectDirectionalCandidates(
          connections,
          vehicleStopFirst,
          vehicleStopLast
        );
        if (candidateVehicleIds.includes(normalizeVehicleId(lockedVehicleId))) {
          vehicle = findVehicleByLockedId(
            feedVehicles,
            lockedVehicleId,
            { lat: firstStop.lat, lon: firstStop.lon },
            { lat: lastStop.lat, lon: lastStop.lon }
          );
        }
        if (!vehicle) {
          vehicle = findVehicleByCandidates(feedVehicles, candidateVehicleIds);
          if (vehicle) {
            console.log(
              `[Mock] Replaced stale locked vehicle ${lockedVehicleId} with ${vehicle.vehicleId}`
            );
          }
        }
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
          `[Mock] Locked vehicle ${lockedVehicleId} not found and no replacement candidate was available.`
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
