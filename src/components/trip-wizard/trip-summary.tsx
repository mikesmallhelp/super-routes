"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { SavedTrip } from "@/lib/types";

interface TripSummaryProps {
  trip: SavedTrip;
}

export function TripSummary({ trip }: TripSummaryProps) {
  return (
    <Card className="w-full bg-primary/5 border-primary/20">
      <CardContent className="p-4">
        <p className="font-semibold text-sm">
          {trip.originLabel} → {trip.destinationLabel}
        </p>
        {trip.selectedVehicles.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
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
