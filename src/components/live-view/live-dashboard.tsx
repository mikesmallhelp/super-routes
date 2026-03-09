"use client";

import { useTrips } from "@/components/providers/trips-provider";
import { LiveTripCard } from "./live-trip-card";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export function LiveDashboard() {
  const { trips, removeTrip, goBackToSetup } = useTrips();
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Reaaliaikaiset reitit</h2>
          <p className="text-xs text-muted-foreground">
            Päivitetty {now.toLocaleTimeString("fi-FI", { hour: "2-digit", minute: "2-digit" })}
            {" · "}Päivittyy 30s välein
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={goBackToSetup}>
          Muokkaa
        </Button>
      </div>

      {trips.map((trip) => (
        <LiveTripCard key={trip.id} trip={trip} onRemove={removeTrip} />
      ))}
    </div>
  );
}
