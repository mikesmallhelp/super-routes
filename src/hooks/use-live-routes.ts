"use client";

import useSWR from "swr";
import type { Connection, SavedTrip, VehicleFilterMode } from "@/lib/types";
import { generateMockConnections, SCENARIO_INTERVAL_MS } from "@/lib/mock-data";
import { distanceMeters, useGeolocation } from "@/hooks/use-geolocation";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";
const MOCK_REFRESH_INTERVAL_MS = Math.max(500, Math.min(5_000, Math.floor(SCENARIO_INTERVAL_MS / 6)));
const REFRESH_INTERVAL_MS = USE_MOCK ? MOCK_REFRESH_INTERVAL_MS : 30_000;
const LIVE_ORIGIN_MIN_DISTANCE_M = 100;

interface RoutesResponse {
  connections: Connection[];
}

function connectionKey(connection: Connection): string {
  return connection.legs
    .map((leg) =>
      [
        leg.mode,
        leg.trip?.routeShortName ?? "",
        leg.trip?.gtfsId ?? "",
        leg.from.stop?.code ?? leg.from.name,
        leg.to.stop?.code ?? leg.to.name,
        leg.start.scheduledTime,
        leg.end.scheduledTime,
      ].join("|")
    )
    .join(">");
}

function mergeConnections(...groups: Connection[][]): Connection[] {
  const merged = new Map<string, Connection>();
  for (const connections of groups) {
    for (const connection of connections) {
      const key = connectionKey(connection);
      if (!merged.has(key)) {
        merged.set(key, connection);
      }
    }
  }
  return Array.from(merged.values());
}

async function fetchRoutesForOrigin(
  origin: SavedTrip["originCoords"],
  destination: SavedTrip["destinationCoords"],
  numItineraries: number,
  dateTime?: string
): Promise<Connection[]> {
  const res = await fetch("/api/routes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      origin,
      destination,
      numItineraries,
      dateTime,
    }),
  });

  if (!res.ok) {
    throw new Error("Failed to fetch routes");
  }

  const data: RoutesResponse = await res.json();
  return data.connections;
}

async function fetchTripRoutes(
  trip: SavedTrip,
  liveOrigin?: SavedTrip["originCoords"]
): Promise<{ current: Connection[]; past: Connection[] }> {
  if (USE_MOCK) {
    const mock = generateMockConnections();
    return { current: mock, past: mock };
  }

  const pastTime = new Date(Date.now() - 90 * 60 * 1000).toISOString();
  const shouldFetchLiveOrigin =
    liveOrigin &&
    distanceMeters(
      trip.originCoords.latitude,
      trip.originCoords.longitude,
      liveOrigin.latitude,
      liveOrigin.longitude
    ) >= LIVE_ORIGIN_MIN_DISTANCE_M;

  const currentRequests: Promise<Connection[]>[] = [
    fetchRoutesForOrigin(trip.originCoords, trip.destinationCoords, 5),
  ];

  if (shouldFetchLiveOrigin) {
    currentRequests.push(fetchRoutesForOrigin(liveOrigin, trip.destinationCoords, 5));
  }

  const [currentGroups, pastConnections] = await Promise.all([
    Promise.all(currentRequests),
    fetchRoutesForOrigin(trip.originCoords, trip.destinationCoords, 10, pastTime).catch(() => []),
  ]);

  return {
    current: mergeConnections(...currentGroups),
    past: pastConnections,
  };
}

function filterConnections(
  connections: Connection[],
  selectedVehicles: string[],
  excludedVehicles: string[],
  mode: VehicleFilterMode
): Connection[] {
  if (selectedVehicles.length === 0 && excludedVehicles.length === 0)
    return connections;
  return connections.filter((conn) => {
    const vehiclesInConn = conn.legs
      .filter((leg) => leg.trip?.routeShortName)
      .map((leg) => leg.trip!.routeShortName);

    if (excludedVehicles.some((v) => vehiclesInConn.includes(v)))
      return false;

    if (selectedVehicles.length === 0) return true;
    if (mode === "and") {
      return selectedVehicles.every((v) => vehiclesInConn.includes(v));
    } else {
      return selectedVehicles.some((v) => vehiclesInConn.includes(v));
    }
  });
}

export function useLiveRoutes(trip: SavedTrip) {
  const userPos = useGeolocation();
  const liveOrigin = userPos
    ? { latitude: userPos.latitude, longitude: userPos.longitude }
    : undefined;
  const locationKey = liveOrigin
    ? `${liveOrigin.latitude.toFixed(4)}-${liveOrigin.longitude.toFixed(4)}`
    : "none";
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    `live-routes-${trip.id}-${locationKey}`,
    () => fetchTripRoutes(trip, liveOrigin),
    {
      refreshInterval: REFRESH_INTERVAL_MS,
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  const filtered = data
    ? filterConnections(
        data.current,
        trip.selectedVehicles,
        trip.excludedVehicles ?? [],
        trip.vehicleFilterMode ?? "and"
      )
    : [];

  // Past connections include all (for route detection), filtered by vehicle preferences
  const pastFiltered = data
    ? filterConnections(
        data.past,
        trip.selectedVehicles,
        trip.excludedVehicles ?? [],
        trip.vehicleFilterMode ?? "and"
      )
    : [];

  return {
    connections: filtered,
    pastConnections: pastFiltered,
    allConnections: data?.current || [],
    error,
    isLoading,
    isValidating,
    mutate,
  };
}
