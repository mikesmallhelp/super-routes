"use client";

import { useTrips } from "@/components/providers/trips-provider";
import { LiveTripCard } from "./live-trip-card";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";
import { useGeolocation, distanceMeters } from "@/hooks/use-geolocation";

export function LiveDashboard() {
  const { trips, removeTrip, goBackToSetup } = useTrips();
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const userPos = useGeolocation();

  // Track auto-refresh timestamp (matches SWR 30s interval)
  useEffect(() => {
    const interval = setInterval(() => setLastUpdated(new Date()), 30_000);
    return () => clearInterval(interval);
  }, []);

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
            Päivitetty {lastUpdated.toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={goBackToSetup}>
          Muokkaa
        </Button>
      </div>

      {sortedTrips.map((trip) => (
        <LiveTripCard key={trip.id} trip={trip} onRemove={removeTrip} />
      ))}
    </div>
  );
}
