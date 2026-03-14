"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SavedTrip } from "@/lib/types";

interface TripSummaryProps {
  trip: SavedTrip;
  onRemove?: (id: string) => void;
}

export function TripSummary({ trip, onRemove }: TripSummaryProps) {
  return (
    <Card className="w-full bg-primary/5 border-primary/20">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-sm">
            {trip.originLabel} → {trip.destinationLabel}
          </p>
          {onRemove && (
            <button
              onClick={() => onRemove(trip.id)}
              className="text-muted-foreground hover:text-destructive text-lg leading-none px-1"
              aria-label="Poista matka"
            >
              ×
            </button>
          )}
        </div>
        {trip.selectedVehicles.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 mt-2">
            <span className="text-xs text-muted-foreground">Valitut liikennevälineet:</span>
            {trip.selectedVehicles.map((v) => (
              <Badge key={v} variant="default" className="text-xs">
                {v}
              </Badge>
            ))}
          </div>
        )}
        {trip.selectedVehicles.length === 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            Kaikki liikennevälineet
          </p>
        )}
      </CardContent>
    </Card>
  );
}
