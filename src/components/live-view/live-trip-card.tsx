"use client";

import type { SavedTrip } from "@/lib/types";
import { useLiveRoutes } from "@/hooks/use-live-routes";
import { ConnectionCard } from "@/components/trip-wizard/connection-card";
import { Badge } from "@/components/ui/badge";

interface LiveTripCardProps {
  trip: SavedTrip;
}

export function LiveTripCard({ trip }: LiveTripCardProps) {
  const { connections, isLoading, error } = useLiveRoutes(trip);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">
          {trip.originLabel} → {trip.destinationLabel}
        </h3>
      </div>
      {trip.selectedVehicles.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {trip.selectedVehicles.map((v) => (
            <Badge key={v} variant="default" className="text-xs">
              {v}
            </Badge>
          ))}
        </div>
      )}

      {isLoading && (
        <p className="text-sm text-muted-foreground">Ladataan reittejä...</p>
      )}

      {error && (
        <p className="text-destructive text-sm">Virhe ladattaessa reittejä.</p>
      )}

      {!isLoading && connections.length === 0 && !error && (
        <p className="text-sm text-muted-foreground">
          Ei reittivaihtoehtoja juuri nyt.
        </p>
      )}

      {connections.map((conn, i) => (
        <ConnectionCard
          key={`${conn.start}-${i}`}
          connection={conn}
          index={i + 1}
          highlightVehicles={trip.selectedVehicles}
        />
      ))}
    </div>
  );
}
