"use client";

import type { UpcomingArrival } from "@/lib/route-detection";
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

interface UpcomingArrivalsProps {
  arrivals: UpcomingArrival[];
}

export function UpcomingArrivals({ arrivals }: UpcomingArrivalsProps) {
  if (arrivals.length === 0) return null;

  // Group by stop
  const byStop = new Map<string, UpcomingArrival[]>();
  for (const a of arrivals) {
    const key = `${a.stopCode}-${a.stopName}`;
    if (!byStop.has(key)) byStop.set(key, []);
    byStop.get(key)!.push(a);
  }

  return (
    <Card className="w-full border-green-400 border-2">
      <CardContent className="p-4">
        <div className="text-sm font-semibold text-green-700 mb-3">
          Saapuvat pysäkille
        </div>

        {Array.from(byStop.entries()).map(([key, stopArrivals]) => (
          <div key={key} className="mb-3 last:mb-0">
            <div className="text-xs text-muted-foreground mb-1">
              {stopArrivals[0].stopName} ({stopArrivals[0].stopCode})
            </div>
            <div className="space-y-1">
              {stopArrivals.map((a, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span>{modeIcon(a.mode)}</span>
                  <Badge variant="secondary" className="text-xs">
                    {a.routeShortName}
                  </Badge>
                  <span className="text-muted-foreground text-xs truncate flex-1">
                    → {a.headsign}
                  </span>
                  <span className="font-bold tabular-nums shrink-0">
                    {a.minutesUntil} min
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
