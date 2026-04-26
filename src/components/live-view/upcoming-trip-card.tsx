"use client";

import type { Leg } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { buildStopList } from "@/lib/route-detection";
import { usePreviousDeparture } from "@/hooks/use-previous-departure";
import { useNow } from "@/hooks/use-now";

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
  showPreviousDeparture?: boolean;
  earliestCatchTime?: string;
}

export function UpcomingTripCard({
  leg,
  showPreviousDeparture = false,
  earliestCatchTime,
}: UpcomingTripCardProps) {
  const shortName = leg.trip?.routeShortName;
  const headsign = leg.trip?.tripHeadsign;
  const stops = buildStopList(leg);
  const startDelayMin = leg.start.estimated?.time
    ? Math.round(
        (new Date(leg.start.estimated.time).getTime() -
          new Date(leg.start.scheduledTime).getTime()) /
          60_000
      )
    : null;

  const prevDep = usePreviousDeparture(
    showPreviousDeparture ? leg.from.stop?.gtfsId : undefined,
    showPreviousDeparture ? leg.trip?.routeShortName : undefined,
    showPreviousDeparture ? leg.start.scheduledTime : undefined
  );
  const prevTime = prevDep.realtimeTime ?? prevDep.scheduledTime;
  const now = useNow();
  const canCatchPreviousDeparture =
    showPreviousDeparture &&
    prevTime &&
    (!earliestCatchTime || new Date(prevTime).getTime() >= new Date(earliestCatchTime).getTime()) &&
    new Date(prevTime).getTime() >= now;

  return (
    <Card className="w-full border-blue-400 border-2">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-2">
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
          {startDelayMin !== null && startDelayMin >= 1 && (
            <span className="ml-2 text-xs text-red-600 font-medium">+{startDelayMin} min myöhässä</span>
          )}
          {startDelayMin !== null && startDelayMin <= -1 && (
            <span className="ml-2 text-xs text-amber-600 font-medium">{startDelayMin} min edellä</span>
          )}
        </div>

        {canCatchPreviousDeparture && (
          <div className="mb-3 w-fit rounded-md border border-green-300 bg-green-50 px-2.5 py-1.5 text-xs font-medium text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-200">
            Edellinen lähtö: {formatTime(prevTime)}
          </div>
        )}

        <div className="relative ml-3">
          <div className="absolute left-[5px] top-2 bottom-2 w-0.5 bg-muted-foreground/30" />

          <div className="space-y-0">
            {stops.map((stop, i) => {
              const delayMin =
                stop.delaySeconds !== undefined
                  ? Math.round(stop.delaySeconds / 60)
                  : null;
              return (
                <div
                  key={`${stop.code}-${i}`}
                  className="flex items-center gap-3 py-1.5 relative"
                >
                  <div className="w-3 h-3 rounded-full border-2 bg-background border-muted-foreground shrink-0 z-10" />

                  <div className="flex-1 min-w-0">
                    <span className="text-sm truncate block">{stop.name}</span>
                  </div>

                  <div className="text-xs shrink-0 tabular-nums text-right">
                    <div
                      className={
                        delayMin !== null && delayMin >= 1
                          ? "text-red-600 font-medium"
                          : delayMin !== null && delayMin <= -1
                          ? "text-amber-600 font-medium"
                          : "text-muted-foreground"
                      }
                    >
                      {formatTime(stop.realtimeTime ?? stop.scheduledTime)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
