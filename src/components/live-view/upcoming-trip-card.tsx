"use client";

import type { Leg } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { buildStopList } from "@/lib/route-detection";
import { usePreviousDeparture } from "@/hooks/use-previous-departure";
import { useNow } from "@/hooks/use-now";
import { useStopDepartures } from "@/hooks/use-stop-departures";
import { VehicleIcon } from "@/components/vehicle-icon";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fi-FI", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface UpcomingTripCardProps {
  leg: Leg;
  showPreviousDeparture?: boolean;
  earliestCatchTime?: string;
  syncFromStop?: {
    stopGtfsId?: string;
    includeRoutes?: string[];
    excludeRoutes?: string[];
    headsign?: string;
  };
}

export function UpcomingTripCard({
  leg,
  showPreviousDeparture = false,
  earliestCatchTime,
  syncFromStop,
}: UpcomingTripCardProps) {
  const shortName = leg.trip?.routeShortName;
  const headsign = leg.trip?.tripHeadsign;
  const stops = buildStopList(leg);
  const now = useNow();
  const syncAfterTime =
    earliestCatchTime && new Date(earliestCatchTime).getTime() > now
      ? earliestCatchTime
      : now > 0
      ? new Date(now).toISOString()
      : undefined;
  const stopDepartures = useStopDepartures(
    syncFromStop?.stopGtfsId,
    syncFromStop?.stopGtfsId ? syncAfterTime : undefined,
    syncFromStop?.includeRoutes ?? [],
    syncFromStop?.excludeRoutes ?? [],
    syncFromStop?.headsign
  );
  const syncedDeparture = stopDepartures[0];
  const legStartReferenceTime = leg.start.estimated?.time ?? leg.start.scheduledTime;
  const syncedStartTime = syncedDeparture?.realtimeTime ?? syncedDeparture?.scheduledTime;
  const timeShiftMs =
    syncedStartTime !== undefined
      ? new Date(syncedStartTime).getTime() - new Date(legStartReferenceTime).getTime()
      : 0;
  const shiftTime = (iso: string) =>
    timeShiftMs === 0
      ? iso
      : new Date(new Date(iso).getTime() + timeShiftMs).toISOString();
  const startDelayMin = leg.start.estimated?.time
    ? Math.round(
        (new Date(leg.start.estimated.time).getTime() -
          new Date(leg.start.scheduledTime).getTime()) /
          60_000
      )
    : null;
  let headerDelayMin =
    syncedDeparture?.delaySeconds !== undefined
      ? Math.round(syncedDeparture.delaySeconds / 60)
      : startDelayMin;
  if (headerDelayMin === null || headerDelayMin === 0) {
    headerDelayMin = null;
    for (const stop of stops) {
      const stopDelayMin =
        stop.delaySeconds !== undefined
          ? Math.round(stop.delaySeconds / 60)
          : null;
      if (stopDelayMin !== null && stopDelayMin !== 0) {
        headerDelayMin = stopDelayMin;
        break;
      }
    }
  }

  const prevDep = usePreviousDeparture(
    showPreviousDeparture ? leg.from.stop?.gtfsId : undefined,
    showPreviousDeparture ? leg.trip?.routeShortName : undefined,
    showPreviousDeparture ? leg.start.scheduledTime : undefined
  );
  const prevTime = prevDep.realtimeTime ?? prevDep.scheduledTime;
  const canCatchPreviousDeparture =
    showPreviousDeparture &&
    prevTime &&
    (!earliestCatchTime || new Date(prevTime).getTime() >= new Date(earliestCatchTime).getTime()) &&
    new Date(prevTime).getTime() >= now;

  return (
    <Card className="w-full border-blue-400 border-2">
      <CardContent className="p-4">
        {canCatchPreviousDeparture && (
          <div className="mb-3 w-fit rounded-md border border-green-300 bg-green-50 px-2.5 py-1.5 text-xs font-medium text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-200">
            Edellinen lähtö: {formatTime(prevTime)}
          </div>
        )}

        <div className="flex items-center gap-2 mb-2">
          <VehicleIcon mode={leg.mode} />
          {shortName && (
            <Badge variant="secondary" className="text-sm font-bold">
              {shortName}
            </Badge>
          )}
          {headsign && (
            <span className="text-sm text-muted-foreground">→ {headsign}</span>
          )}
          <span className="ml-auto text-xs tabular-nums text-muted-foreground">
            {formatTime(shiftTime(leg.start.scheduledTime))}–{formatTime(shiftTime(leg.end.scheduledTime))}
          </span>
        </div>

        {headerDelayMin !== null && headerDelayMin >= 1 && (
          <div className="mb-2 text-right text-xs text-red-600 font-medium">
            {headerDelayMin} min myöhässä
          </div>
        )}
        {headerDelayMin !== null && headerDelayMin <= -1 && (
          <div className="mb-2 text-right text-xs text-green-700 font-medium">
            {Math.abs(headerDelayMin)} min etuajassa
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
                          ? "text-green-700 font-medium"
                          : "text-muted-foreground"
                      }
                    >
                      {formatTime(shiftTime(stop.realtimeTime ?? stop.scheduledTime))}
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
