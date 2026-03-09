"use client";

import useSWR from "swr";
import type { Connection, SavedTrip } from "@/lib/types";

interface RoutesResponse {
  connections: Connection[];
}

async function fetchTripRoutes(trip: SavedTrip): Promise<Connection[]> {
  const res = await fetch("/api/routes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      origin: trip.originCoords,
      destination: trip.destinationCoords,
      numItineraries: 5,
    }),
  });
  if (!res.ok) throw new Error("Failed to fetch routes");
  const data: RoutesResponse = await res.json();
  return data.connections;
}

function filterConnections(
  connections: Connection[],
  selectedVehicles: string[]
): Connection[] {
  if (selectedVehicles.length === 0) return connections;
  return connections.filter((conn) => {
    const vehiclesInConn = conn.legs
      .filter((leg) => leg.trip?.routeShortName)
      .map((leg) => leg.trip!.routeShortName);
    return selectedVehicles.every((v) => vehiclesInConn.includes(v));
  });
}

export function useLiveRoutes(trip: SavedTrip) {
  const { data, error, isLoading } = useSWR(
    `live-routes-${trip.id}`,
    () => fetchTripRoutes(trip),
    {
      refreshInterval: 30000,
      revalidateOnFocus: true,
      dedupingInterval: 10000,
    }
  );

  const filtered = data ? filterConnections(data, trip.selectedVehicles) : [];

  return { connections: filtered, allConnections: data || [], error, isLoading };
}
