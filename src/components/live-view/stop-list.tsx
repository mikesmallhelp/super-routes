"use client";

import type { ActiveLeg } from "@/lib/route-detection";
import type { StopOnRoute } from "@/lib/route-detection";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { VehicleIcon } from "@/components/vehicle-icon";

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fi-FI", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

type VisibleEntry =
  | { type: "stop"; stop: StopOnRoute; index: number }
  | { type: "gap"; hiddenCount: number; section: "passed" | "upcoming" };

interface UserPosition {
  latitude: number;
  longitude: number;
}

interface StopHighlight {
  index: number;
  approaching: boolean;
}

const AT_STOP_DISTANCE_M = 80;
const lockedStopHighlights = new Map<string, StopHighlight>();

function getLegKey(activeLeg: ActiveLeg): string {
  const { leg } = activeLeg;
  return [
    leg.trip?.gtfsId ?? leg.trip?.routeShortName ?? leg.mode,
    leg.start.scheduledTime,
    leg.end.scheduledTime,
  ].join("|");
}

function getSegmentProgress(
  start: StopOnRoute,
  end: StopOnRoute,
  position: UserPosition
): { progress: number; distanceToEnd: number } {
  const metersPerDegreeLatitude = 111_320;
  const metersPerDegreeLongitude =
    Math.cos((start.lat * Math.PI) / 180) * metersPerDegreeLatitude;
  const segmentX = (end.lon - start.lon) * metersPerDegreeLongitude;
  const segmentY = (end.lat - start.lat) * metersPerDegreeLatitude;
  const positionX = (position.longitude - start.lon) * metersPerDegreeLongitude;
  const positionY = (position.latitude - start.lat) * metersPerDegreeLatitude;
  const segmentLengthSquared = segmentX ** 2 + segmentY ** 2;
  const progress =
    segmentLengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, (positionX * segmentX + positionY * segmentY) / segmentLengthSquared)
        );
  const distanceToEnd = Math.hypot(positionX - segmentX, positionY - segmentY);

  return { progress, distanceToEnd };
}

function resolveStopHighlight(
  stops: StopOnRoute[],
  detectedIndex: number,
  position: UserPosition | null
): StopHighlight {
  if (!position || stops.length < 2) {
    return { index: detectedIndex, approaching: false };
  }

  let closestSegment: { index: number; progress: number; distanceToEnd: number; distance: number } | null = null;
  for (let index = 0; index < stops.length - 1; index++) {
    const { progress, distanceToEnd } = getSegmentProgress(stops[index], stops[index + 1], position);
    const segmentStart = stops[index];
    const metersPerDegreeLatitude = 111_320;
    const metersPerDegreeLongitude =
      Math.cos((segmentStart.lat * Math.PI) / 180) * metersPerDegreeLatitude;
    const pointX = (position.longitude - segmentStart.lon) * metersPerDegreeLongitude;
    const pointY = (position.latitude - segmentStart.lat) * metersPerDegreeLatitude;
    const segmentX = (stops[index + 1].lon - segmentStart.lon) * metersPerDegreeLongitude;
    const segmentY = (stops[index + 1].lat - segmentStart.lat) * metersPerDegreeLatitude;
    const nearestX = segmentX * progress;
    const nearestY = segmentY * progress;
    const distance = Math.hypot(pointX - nearestX, pointY - nearestY);

    if (!closestSegment || distance < closestSegment.distance) {
      closestSegment = { index, progress, distanceToEnd, distance };
    }
  }

  if (!closestSegment) return { index: detectedIndex, approaching: false };
  if (closestSegment.progress < 0.5) {
    return { index: closestSegment.index, approaching: false };
  }

  return {
    index: closestSegment.index + 1,
    approaching: closestSegment.distanceToEnd > AT_STOP_DISTANCE_M,
  };
}

function lockStopHighlight(candidate: StopHighlight, legKey: string): StopHighlight {
  const previous = lockedStopHighlights.get(legKey);
  if (!previous || candidate.index > previous.index) {
    lockedStopHighlights.set(legKey, candidate);
    return candidate;
  }

  if (candidate.index === previous.index && previous.approaching && !candidate.approaching) {
    lockedStopHighlights.set(legKey, candidate);
    return candidate;
  }

  return previous;
}

/**
 * Build a compact view:
 * - First passed stop + ... + two previous + current + two next + ... + final stop
 */
function buildVisibleEntries(stops: StopOnRoute[], currentIdx: number): VisibleEntry[] {
  if (currentIdx === -1) {
    return stops.map((s, i) => ({ type: "stop", stop: s, index: i }));
  }

  const n = stops.length;
  const visible = new Set<number>();

  // First + two before current
  if (currentIdx > 0) {
    visible.add(0);
    if (currentIdx - 2 >= 0) visible.add(currentIdx - 2);
    if (currentIdx - 1 >= 0) visible.add(currentIdx - 1);
  }
  // Current
  visible.add(currentIdx);
  // Two after + final
  if (currentIdx < n - 1) {
    if (currentIdx + 1 < n) visible.add(currentIdx + 1);
    if (currentIdx + 2 < n) visible.add(currentIdx + 2);
    visible.add(n - 1);
  }

  const sorted = [...visible].sort((a, b) => a - b);
  const entries: VisibleEntry[] = [];
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0) {
      const gap = sorted[i] - sorted[i - 1] - 1;
      if (gap > 0) {
        const section: "passed" | "upcoming" =
          sorted[i] <= currentIdx ? "passed" : "upcoming";
        entries.push({ type: "gap", hiddenCount: gap, section });
      }
    }
    entries.push({ type: "stop", stop: stops[sorted[i]], index: sorted[i] });
  }
  return entries;
}

interface StopListProps {
  activeLeg: ActiveLeg;
  endStopCode?: string;
  position: UserPosition | null;
}

export function StopList({ activeLeg, endStopCode, position }: StopListProps) {
  const { leg, stops: allStops } = activeLeg;
  const shortName = leg.trip?.routeShortName;
  const headsign = leg.trip?.tripHeadsign;
  const legKey = getLegKey(activeLeg);
  const detectedIndex = Math.max(0, allStops.findIndex((s) => s.status === "current"));
  const endStopIndex = endStopCode
    ? allStops.findIndex((stop) => stop.code === endStopCode)
    : -1;
  const stops =
    endStopIndex >= detectedIndex ? allStops.slice(0, endStopIndex + 1) : allStops;
  const highlight = lockStopHighlight(
    resolveStopHighlight(stops, detectedIndex, position),
    legKey
  );
  const currentIndex = Math.min(highlight.index, stops.length - 1);

  const entries = buildVisibleEntries(stops, currentIndex);
  const currentStop = stops[currentIndex];
  const currentDelayMin =
    currentStop?.delaySeconds !== undefined
      ? Math.round(currentStop.delaySeconds / 60)
      : null;
  let headerDelayMin = currentDelayMin;
  if (headerDelayMin === null || headerDelayMin === 0) {
    headerDelayMin = null;
    for (let i = currentIndex + 1; i < stops.length; i++) {
      const stop = stops[i];
      const nextDelayMin =
        stop?.delaySeconds !== undefined
          ? Math.round(stop.delaySeconds / 60)
          : null;
      if (nextDelayMin !== null && nextDelayMin !== 0) {
        headerDelayMin = nextDelayMin;
        break;
      }
    }
  }

  return (
    <Card className="w-full border-green-400 border-2">
      <CardContent className="p-4">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <VehicleIcon mode={leg.mode} />
            {shortName && (
              <Badge variant="secondary" className="shrink-0 text-sm font-bold">
                {shortName}
              </Badge>
            )}
            {headsign && (
              <span className="min-w-0 truncate text-sm text-muted-foreground">
                → {headsign}
              </span>
            )}
          </div>
          <div className="shrink-0 text-right text-xs font-medium text-green-700">
            <div>Matkalla</div>
            {headerDelayMin !== null && headerDelayMin >= 1 && (
              <div className="text-red-600">{headerDelayMin} min myöhässä</div>
            )}
            {headerDelayMin !== null && headerDelayMin <= -1 && (
              <div className="text-green-700">{Math.abs(headerDelayMin)} min etuajassa</div>
            )}
          </div>
        </div>

        <div className="relative ml-3">
          <div className="absolute left-[5px] top-2 bottom-2 w-0.5 bg-muted-foreground/30" />

          <div className="space-y-0">
            {entries.map((entry, i) => {
              if (entry.type === "gap") {
                return (
                  <div
                    key={`gap-${i}`}
                    className="flex items-center gap-3 py-1.5 relative opacity-50"
                  >
                    <div className="w-3 flex flex-col items-center gap-0.5 z-10 bg-card">
                      <div className="w-1 h-1 rounded-full bg-muted-foreground" />
                      <div className="w-1 h-1 rounded-full bg-muted-foreground" />
                      <div className="w-1 h-1 rounded-full bg-muted-foreground" />
                    </div>
                    {entry.section === "upcoming" && (
                      <span className="text-xs text-muted-foreground italic">
                        {entry.hiddenCount} välipysäkkiä
                      </span>
                    )}
                  </div>
                );
              }

              const { stop, index } = entry;
              const visualStatus =
                index < currentIndex
                  ? "passed"
                  : index === currentIndex
                  ? "current"
                  : "upcoming";
              const isApproaching = index === currentIndex && highlight.approaching;
              return (
                <div
                  key={`stop-${index}`}
                  className={`flex items-center gap-3 py-1.5 relative ${
                    visualStatus === "passed" ? "opacity-40" : ""
                  }`}
                >
                  <div
                    className={`w-3 h-3 rounded-full border-2 shrink-0 z-10 ${
                      isApproaching
                        ? "stop-approaching-dot"
                        : visualStatus === "current"
                        ? "bg-green-500 border-green-600 ring-2 ring-green-300"
                        : visualStatus === "passed"
                        ? "bg-muted-foreground border-muted-foreground"
                        : "bg-background border-muted-foreground"
                    }`}
                  />

                  <div className="flex-1 min-w-0">
                    <span
                      className={`text-sm truncate block ${
                        visualStatus === "current" ? "font-bold text-green-700" : ""
                      }`}
                    >
                      {stop.name}
                    </span>
                  </div>

                  <div className="text-xs shrink-0 tabular-nums text-right">
                    <div className={stop.delaySeconds !== undefined && stop.delaySeconds > 0 ? "text-red-600 font-medium" : stop.delaySeconds !== undefined && stop.delaySeconds < 0 ? "text-green-700 font-medium" : "text-muted-foreground"}>
                      {stop.realtimeTime
                        ? formatTime(stop.realtimeTime)
                        : stop.scheduledTime && formatTime(stop.scheduledTime)}
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
