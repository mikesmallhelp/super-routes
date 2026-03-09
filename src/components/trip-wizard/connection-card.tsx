"use client";

import type { Connection } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

function formatTime(isoString: string) {
  return new Date(isoString).toLocaleTimeString("fi-FI", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function modeIcon(mode: string) {
  switch (mode) {
    case "WALK": return "🚶";
    case "BUS": return "🚌";
    case "TRAM": return "🚃";
    case "RAIL": return "🚆";
    case "SUBWAY": return "🚇";
    case "FERRY": return "⛴️";
    default: return "🚍";
  }
}

interface ConnectionCardProps {
  connection: Connection;
  index: number;
  highlightVehicles?: string[];
}

export function ConnectionCard({ connection, index, highlightVehicles = [] }: ConnectionCardProps) {
  return (
    <Card className="w-full">
      <CardContent className="p-4">
        <div className="text-sm font-semibold text-primary mb-3">
          {index}. Yhteys
        </div>
        <div className="space-y-1">
          {connection.legs.map((leg, i) => {
            const shortName = leg.trip?.routeShortName;
            const isHighlighted = shortName && highlightVehicles.includes(shortName);

            if (leg.mode === "WALK") {
              return (
                <div key={i} className="flex items-center gap-2 text-muted-foreground text-sm py-1">
                  <span>{modeIcon("WALK")}</span>
                  <span className="flex-1">
                    {i === 0 && leg.from.name}
                    {i === 0 ? " → " : ""}
                    Kävely
                    {i === connection.legs.length - 1 ? ` → ${leg.to.name}` : ""}
                  </span>
                  <span className="tabular-nums">
                    {i === 0 && formatTime(leg.start.scheduledTime)}
                    {i === connection.legs.length - 1 && formatTime(leg.end.scheduledTime)}
                  </span>
                </div>
              );
            }

            return (
              <div key={i} className="space-y-0.5">
                <div className="flex items-center gap-2 text-sm py-0.5">
                  <span>{modeIcon(leg.mode)}</span>
                  <span className="font-medium truncate">
                    {leg.from.stop?.code || leg.from.name} {leg.from.stop?.name || leg.from.name}
                  </span>
                  {shortName && (
                    <Badge
                      variant={isHighlighted ? "default" : "secondary"}
                      className="text-xs shrink-0"
                    >
                      {shortName}
                    </Badge>
                  )}
                  <span className="ml-auto tabular-nums shrink-0">
                    {formatTime(leg.start.scheduledTime)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-sm py-0.5 text-muted-foreground">
                  <span className="w-5" />
                  <span className="truncate">
                    {leg.to.stop?.code || leg.to.name} {leg.to.stop?.name || leg.to.name}
                  </span>
                  <span className="ml-auto tabular-nums shrink-0">
                    {formatTime(leg.end.scheduledTime)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
