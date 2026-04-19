"use client";

import type { ActiveLeg } from "@/lib/route-detection";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

function modeIcon(mode: string) {
  switch (mode) {
    case "BUS": return "🚌";
    case "TRAM": return "🚃";
    case "RAIL": return "🚆";
    case "SUBWAY": return "🚇";
    case "FERRY": return "⛴️";
    default: return "🚍";
  }
}

interface StopListProps {
  activeLeg: ActiveLeg;
}

export function StopList({ activeLeg }: StopListProps) {
  const { leg, stops } = activeLeg;
  const shortName = leg.trip?.routeShortName;
  const headsign = leg.trip?.tripHeadsign;

  return (
    <Card className="w-full border-blue-400 border-2">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <span>{modeIcon(leg.mode)}</span>
          {shortName && (
            <Badge variant="secondary" className="text-sm font-bold">
              {shortName}
            </Badge>
          )}
          {headsign && (
            <span className="text-sm text-muted-foreground">→ {headsign}</span>
          )}
          <span className="ml-auto text-xs text-blue-600 font-medium">Matkalla</span>
        </div>

        <div className="relative ml-3">
          {/* Vertical line */}
          <div className="absolute left-[5px] top-2 bottom-2 w-0.5 bg-muted-foreground/30" />

          <div className="space-y-0">
            {stops.map((stop, i) => (
              <div
                key={`${stop.code}-${i}`}
                className={`flex items-center gap-3 py-1.5 relative ${
                  stop.status === "passed" ? "opacity-40" : ""
                }`}
              >
                {/* Stop dot */}
                <div
                  className={`w-3 h-3 rounded-full border-2 shrink-0 z-10 ${
                    stop.status === "current"
                      ? "bg-blue-500 border-blue-600 ring-2 ring-blue-300"
                      : stop.status === "passed"
                      ? "bg-muted-foreground border-muted-foreground"
                      : "bg-background border-muted-foreground"
                  }`}
                />

                {/* Stop info */}
                <div className="flex-1 min-w-0">
                  <span
                    className={`text-sm truncate block ${
                      stop.status === "current" ? "font-bold text-blue-600" : ""
                    }`}
                  >
                    {stop.name}
                  </span>
                </div>

                <span className="text-xs text-muted-foreground shrink-0">
                  {stop.code}
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
