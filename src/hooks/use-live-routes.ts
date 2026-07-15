"use client";

import useSWR from "swr";
import type { Connection, SavedTrip, VehicleFilterMode } from "@/lib/types";

const REFRESH_INTERVAL_MS = 30_000;
const CURRENT_NUM_ITINERARIES = 20;
const PAST_OFFSETS_MINUTES = [120, 90, 60, 30];
const PAST_NUM_ITINERARIES = 30;

interface RoutesResponse {
  connections: Connection[];
}

function connectionKey(connection: Connection): string {
  const legs = connection.legs
    .map((leg) =>
      [
        leg.mode,
        leg.trip?.routeShortName ?? "",
        leg.trip?.tripHeadsign ?? "",
        leg.start.scheduledTime,
        leg.end.scheduledTime,
        leg.from.stop?.code ?? leg.from.name,
        leg.to.stop?.code ?? leg.to.name,
      ].join("|")
    )
    .join("::");
  return `${connection.start}|${connection.end}|${legs}`;
}

function dedupeConnections(connections: Connection[]): Connection[] {
  const seen = new Set<string>();
  const unique: Connection[] = [];
  for (const connection of connections) {
    const key = connectionKey(connection);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(connection);
  }
  return unique;
}

async function fetchRoutesAt(
  trip: SavedTrip,
  numItineraries: number,
  dateTime?: string
): Promise<Connection[]> {
  const res = await fetch("/api/routes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      origin: trip.originCoords,
      destination: trip.destinationCoords,
      numItineraries,
      ...(dateTime ? { dateTime } : {}),
    }),
  });
  if (!res.ok) throw new Error("Failed to fetch routes");
  const data: RoutesResponse = await res.json();
  return data.connections;
}

async function fetchTripRoutes(trip: SavedTrip): Promise<{ current: Connection[]; past: Connection[] }> {
  // Fetch current routes and multiple historical snapshots in parallel.
  // Historical snapshots improve active-leg detection when transit legs started earlier.
  const pastTimes = PAST_OFFSETS_MINUTES.map(
    (offsetMin) => new Date(Date.now() - offsetMin * 60 * 1000).toISOString()
  );

  const [currentConnections, ...pastBatches] = await Promise.all([
    fetchRoutesAt(trip, CURRENT_NUM_ITINERARIES),
    ...pastTimes.map((pastTime) => fetchRoutesAt(trip, PAST_NUM_ITINERARIES, pastTime)),
  ]);

  const pastConnections = dedupeConnections(pastBatches.flat());

  return { current: currentConnections, past: pastConnections };
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

function filterConnectionsForDetection(
  connections: Connection[],
  selectedVehicles: string[],
  excludedVehicles: string[]
): Connection[] {
  return connections.filter((conn) => {
    const vehiclesInConn = conn.legs
      .filter((leg) => leg.trip?.routeShortName)
      .map((leg) => leg.trip!.routeShortName);

    if (excludedVehicles.some((vehicle) => vehiclesInConn.includes(vehicle))) {
      return false;
    }
    return (
      selectedVehicles.length === 0 ||
      selectedVehicles.some((vehicle) => vehiclesInConn.includes(vehicle))
    );
  });
}

export function useLiveRoutes(trip: SavedTrip) {
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    `live-routes-${trip.id}`,
    () => fetchTripRoutes(trip),
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

  // A user can be on one selected vehicle before their later transfer begins.
  // Keep selected lines as an OR condition for state detection, while the
  // displayed route alternatives retain the saved AND/OR preference.
  const detectionConnections = data
    ? dedupeConnections(
        filterConnectionsForDetection(
          [...data.past, ...data.current],
          trip.selectedVehicles,
          trip.excludedVehicles ?? []
        )
      )
    : [];

  return {
    connections: filtered,
    pastConnections: pastFiltered,
    detectionConnections,
    allConnections: data?.current || [],
    error,
    isLoading,
    isValidating,
    mutate,
  };
}
