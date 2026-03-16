"use client";

import useSWR from "swr";
import type { Connection, SavedTrip, VehicleFilterMode } from "@/lib/types";

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
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    }
  );

  const filtered = data
    ? filterConnections(
        data,
        trip.selectedVehicles,
        trip.excludedVehicles ?? [],
        trip.vehicleFilterMode ?? "and"
      )
    : [];

  return { connections: filtered, allConnections: data || [], error, isLoading, isValidating, mutate };
}
