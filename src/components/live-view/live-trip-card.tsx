"use client";

import type { SavedTrip } from "@/lib/types";
import { useLiveRoutes } from "@/hooks/use-live-routes";
import { ConnectionCard } from "@/components/trip-wizard/connection-card";
import { Badge } from "@/components/ui/badge";

interface LiveTripCardProps {
  trip: SavedTrip;
  onRemove: (id: string) => void;
}

export function LiveTripCard({ trip, onRemove }: LiveTripCardProps) {
  const { connections, isLoading, isValidating, error } = useLiveRoutes(trip);
  const hasIncluded = trip.selectedVehicles.length > 0;
  const hasExcluded = (trip.excludedVehicles ?? []).length > 0;
  const mode = trip.vehicleFilterMode ?? "and";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm">
          {trip.originLabel} → {trip.destinationLabel}
        </h3>
        <button
          onClick={() => onRemove(trip.id)}
          className="text-muted-foreground hover:text-destructive text-lg leading-none px-1"
          aria-label="Poista matka"
        >
          ×
        </button>
      </div>
      {hasIncluded && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-xs text-muted-foreground">
            {mode === "and" ? "Kaikki:" : "Jokin:"}
          </span>
          {trip.selectedVehicles.map((v) => (
            <Badge key={v} variant="default" className="text-xs bg-green-600">
              {v}
            </Badge>
          ))}
        </div>
      )}
      {hasExcluded && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-xs text-muted-foreground">Ei sisällä:</span>
          {trip.excludedVehicles.map((v) => (
            <Badge key={v} variant="default" className="text-xs bg-red-600 line-through">
              {v}
            </Badge>
          ))}
        </div>
      )}
      {!hasIncluded && !hasExcluded && (
        <p className="text-xs text-muted-foreground">Kaikki liikennevälineet</p>
      )}

      {isLoading && (
        <p className="text-sm text-muted-foreground">Ladataan reittejä...</p>
      )}

      {!isLoading && isValidating && (
        <p className="text-sm text-muted-foreground">Päivitetään...</p>
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
