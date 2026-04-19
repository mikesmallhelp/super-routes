"use client";

import useSWR from "swr";
import type { Connection, SavedTrip, VehicleFilterMode } from "@/lib/types";
import { generateMockConnections } from "@/lib/mock-data";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

interface RoutesResponse {
  connections: Connection[];
}

async function fetchTripRoutes(trip: SavedTrip): Promise<{ current: Connection[]; past: Connection[] }> {
  if (USE_MOCK) {
    const mock = generateMockConnections();
    return { current: mock, past: mock };
  }

  // Fetch current routes and past routes (90 min ago) in parallel
  const pastTime = new Date(Date.now() - 90 * 60 * 1000).toISOString();

  const [currentRes, pastRes] = await Promise.all([
    fetch("/api/routes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin: trip.originCoords,
        destination: trip.destinationCoords,
        numItineraries: 5,
      }),
    }),
    fetch("/api/routes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        origin: trip.originCoords,
        destination: trip.destinationCoords,
        numItineraries: 10,
        dateTime: pastTime,
      }),
    }),
  ]);

  if (!currentRes.ok) throw new Error("Failed to fetch routes");

  const currentData: RoutesResponse = await currentRes.json();
  const pastData: RoutesResponse = pastRes.ok ? await pastRes.json() : { connections: [] };

  return { current: currentData.connections, past: pastData.connections };
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
  const { data, error, isLoading, isValidating, mutate } = useSWR(
    `live-routes-${trip.id}`,
    () => fetchTripRoutes(trip),
    {
      refreshInterval: 30_000,
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
