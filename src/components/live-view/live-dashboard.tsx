"use client";

import { useTrips } from "@/components/providers/trips-provider";
import { LiveTripCard } from "./live-trip-card";
import { Button } from "@/components/ui/button";
import { useCallback, useMemo, useState } from "react";
import { useGeolocation, distanceMeters } from "@/hooks/use-geolocation";
import { useSWRConfig } from "swr";

export function LiveDashboard() {
  const { trips, removeTrip, goBackToSetup } = useTrips();
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const userPos = useGeolocation();
  const { mutate } = useSWRConfig();

  const refreshRoutes = useCallback(async () => {
    setIsRefreshing(true);
    await mutate((key: string) => typeof key === "string" && key.startsWith("live-routes-"));
    setLastUpdated(new Date());
    setIsRefreshing(false);
  }, [mutate]);

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
            Päivitetty {lastUpdated.toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={refreshRoutes} disabled={isRefreshing}>
            {isRefreshing ? "Päivitetään..." : "Päivitä reitit"}
          </Button>
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
