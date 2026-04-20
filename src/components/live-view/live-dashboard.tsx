"use client";

import { useTrips } from "@/components/providers/trips-provider";
import { LiveTripCard } from "./live-trip-card";
import { Button } from "@/components/ui/button";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useGeolocation, distanceMeters } from "@/hooks/use-geolocation";
import { SCENARIO_INTERVAL_MS, pauseMock, resumeMock, isMockPaused } from "@/lib/mock-data";
import { useSWRConfig } from "swr";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";
const REFRESH_INTERVAL_MS = USE_MOCK ? SCENARIO_INTERVAL_MS : 30_000;

export function LiveDashboard() {
  const { trips, removeTrip, goBackToSetup } = useTrips();
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isPaused, setIsPaused] = useState(() => (USE_MOCK ? isMockPaused() : false));
  const userPos = useGeolocation();
  const { mutate } = useSWRConfig();

  // Track auto-refresh timestamp; skip when paused
  useEffect(() => {
    if (isPaused) return;
    const interval = setInterval(() => setLastUpdated(new Date()), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isPaused]);

  const togglePause = useCallback(() => {
    if (isPaused) {
      resumeMock();
      setIsPaused(false);
    } else {
      pauseMock();
      setIsPaused(true);
    }
    // Force immediate refresh so display reflects new state
    mutate((key: string) => typeof key === "string" && key.startsWith("live-routes-"));
    setLastUpdated(new Date());
  }, [isPaused, mutate]);

  const sortedTrips = useMemo(() => {
    if (!userPos) {
      console.log("[LiveDashboard] Ei sijaintia saatavilla, ei järjestetä");
      return trips;
    }
    console.log("[LiveDashboard] Käyttäjän sijainti:", {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Reitit</h2>
          <p className="text-xs text-muted-foreground">
            {isPaused ? "Pysäytetty " : "Päivitetty "}
            {lastUpdated.toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </p>
        </div>
        <div className="flex gap-2">
          {USE_MOCK && (
            <Button
              variant="outline"
              size="sm"
              onClick={togglePause}
              className="border-2 border-amber-500 bg-amber-100 text-amber-900 hover:bg-amber-200 hover:text-amber-900 dark:bg-amber-950 dark:text-amber-200 dark:hover:bg-amber-900"
            >
              {isPaused ? "▶ Jatka" : "⏸ Pysäytä"}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={goBackToSetup}>
            Muokkaa
          </Button>
        </div>
      </div>

      {sortedTrips.map((trip) => (
        <LiveTripCard key={trip.id} trip={trip} onRemove={removeTrip} />
      ))}
    </div>
  );
}
