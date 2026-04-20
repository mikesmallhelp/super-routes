"use client";

import type { Leg } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fi-FI", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

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

interface UpcomingTripCardProps {
  leg: Leg;
}

export function UpcomingTripCard({ leg }: UpcomingTripCardProps) {
  const shortName = leg.trip?.routeShortName;
  const headsign = leg.trip?.tripHeadsign;

  const stops: { name: string; code: string }[] = [];
  if (leg.from.stop) stops.push({ name: leg.from.stop.name, code: leg.from.stop.code });
  if (leg.intermediateStops) {
    for (const s of leg.intermediateStops) stops.push({ name: s.name, code: s.code });
  }
  if (leg.to.stop) stops.push({ name: leg.to.stop.name, code: leg.to.stop.code });

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
          <span className="ml-auto text-xs tabular-nums text-muted-foreground">
            {formatTime(leg.start.scheduledTime)}–{formatTime(leg.end.scheduledTime)}
          </span>
        </div>

        <div className="relative ml-3">
          <div className="absolute left-[5px] top-2 bottom-2 w-0.5 bg-muted-foreground/30" />

          <div className="space-y-0">
            {stops.map((stop, i) => (
              <div
                key={`${stop.code}-${i}`}
                className="flex items-center gap-3 py-1.5 relative"
              >
                <div className="w-3 h-3 rounded-full border-2 bg-background border-muted-foreground shrink-0 z-10" />

                <div className="flex-1 min-w-0">
                  <span className="text-sm truncate block">{stop.name}</span>
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
