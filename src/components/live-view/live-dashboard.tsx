"use client";

import { useTrips } from "@/components/providers/trips-provider";
import { LiveTripCard } from "./live-trip-card";
import { Button } from "@/components/ui/button";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useGeolocation, distanceMeters } from "@/hooks/use-geolocation";
import { useSWRConfig } from "swr";

const REFRESH_INTERVAL_MS = 30_000;

export function LiveDashboard() {
  const { trips, removeTrip, goBackToSetup } = useTrips();
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [, setTripMatches] = useState<Record<string, number | null>>({});
  const [activeTripId, setActiveTripId] = useState<string | null>(null);
  const userPos = useGeolocation();
  const { mutate } = useSWRConfig();

  useEffect(() => {
    const interval = setInterval(() => setLastUpdated(new Date()), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  const triggerRefresh = useCallback(() => {
    mutate((key: string) => typeof key === "string" && key.startsWith("live-routes-"));
    setLastUpdated(new Date());
  }, [mutate]);

  const sortedTrips = useMemo(() => {
    if (!userPos) {
      console.log("[LiveDashboard] No location available, skipping sorting");
      return trips;
    }
    console.log("[LiveDashboard] User location:", {
      lat: userPos.latitude,
      lon: userPos.longitude,
    });
    const withDistances = trips.map((trip) => {
      const dist = distanceMeters(
        userPos.latitude, userPos.longitude,
        trip.originCoords.latitude, trip.originCoords.longitude
      );
      console.log(`[LiveDashboard] ${trip.originLabel} → ${Math.round(dist)} m`);
      return { trip, dist };
    });
    withDistances.sort((a, b) => a.dist - b.dist);
    return withDistances.map((d) => d.trip);
  }, [trips, userPos]);

  const handleJourneyStateChange = useCallback((tripId: string, matchDistance: number | null) => {
    setTripMatches((prev) => {
      const next = prev[tripId] === matchDistance ? prev : { ...prev, [tripId]: matchDistance };

      setActiveTripId((currentActiveTripId) => {
        const activeTripStillExists = currentActiveTripId
          ? sortedTrips.some((trip) => trip.id === currentActiveTripId)
          : false;
        const activeTripStillMatches =
          currentActiveTripId !== null && next[currentActiveTripId] != null;

        if (activeTripStillExists && activeTripStillMatches) {
          return currentActiveTripId;
        }

        let bestTripId: string | null = null;
        let bestDistance = Infinity;

        for (const trip of sortedTrips) {
          const candidateDistance = next[trip.id];
          if (candidateDistance == null) continue;
          if (candidateDistance < bestDistance) {
            bestDistance = candidateDistance;
            bestTripId = trip.id;
          }
        }

        return bestTripId;
      });

      return next;
    });
  }, [sortedTrips]);

  const visibleTrips = useMemo(() => {
    if (!activeTripId) return sortedTrips;
    return sortedTrips.filter((trip) => trip.id === activeTripId);
  }, [activeTripId, sortedTrips]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Reitit</h2>
          <p className="text-xs text-muted-foreground">
            Päivitetty{" "}
            {lastUpdated.toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={goBackToSetup}>
            Muokkaa
          </Button>
        </div>
      </div>

      {visibleTrips.map((trip) => (
        <LiveTripCard
          key={trip.id}
          trip={trip}
          onRemove={removeTrip}
          isExpanded={activeTripId === trip.id}
          onJourneyStateChange={handleJourneyStateChange}
        />
      ))}
    </div>
  );
}
