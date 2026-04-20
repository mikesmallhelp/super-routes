"use client";

import type { Leg } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { buildStopList } from "@/lib/route-detection";
import { usePreviousDeparture } from "@/hooks/use-previous-departure";

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
  const stops = buildStopList(leg);

  const prevDep = usePreviousDeparture(
    leg.from.stop?.gtfsId,
    leg.trip?.routeShortName,
    leg.start.scheduledTime
  );
  const prevTime = prevDep.realtimeTime ?? prevDep.scheduledTime;
  const prevMinutesAgo = prevTime
    ? Math.round((Date.now() - new Date(prevTime).getTime()) / 60_000)
    : null;

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
        </div>

        {prevTime && (
          <div className="text-xs text-muted-foreground italic mb-3">
            Edellinen lähtö: {formatTime(prevTime)}
            {prevDep.realtimeTime &&
              prevDep.scheduledTime &&
              prevDep.realtimeTime !== prevDep.scheduledTime && (
                <> (aikat. {formatTime(prevDep.scheduledTime)})</>
              )}
            {prevMinutesAgo !== null && prevMinutesAgo >= 0 && (
              <> — {prevMinutesAgo} min sitten</>
            )}
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
                    {delayMin !== null && Math.abs(delayMin) >= 1 && (
                      <div className={delayMin > 0 ? "text-red-600" : "text-amber-600"}>
                        {delayMin > 0 ? "+" : ""}
                        {delayMin} min
                      </div>
                    )}
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
