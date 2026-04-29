"use client";

import { useMemo } from "react";
import type { ActiveLeg } from "@/lib/route-detection";
import type { StopOnRoute } from "@/lib/route-detection";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { distanceMeters } from "@/hooks/use-geolocation";
import { useNow } from "@/hooks/use-now";

const APPROACHING_STOP_DISTANCE_M = 200;
const AT_STOP_DISTANCE_M = 80;

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

type VisibleEntry =
  | { type: "stop"; stop: StopOnRoute; index: number }
  | { type: "gap"; hiddenCount: number; section: "passed" | "upcoming" };

type StopHighlightMode = "static" | "approaching";

interface UserPosition {
  latitude: number;
  longitude: number;
}

interface StopHighlight {
  index: number;
  mode: StopHighlightMode;
}

interface LockedStopHighlight extends StopHighlight {
  legKey: string;
}

const lockedHighlights = new Map<string, LockedStopHighlight>();

function getStopReferenceTimeMs(stop: StopOnRoute): number | null {
  const referenceTime = stop.realtimeTime ?? stop.scheduledTime;
  return referenceTime ? new Date(referenceTime).getTime() : null;
}

function getStopDistance(stop: StopOnRoute, userPosition: UserPosition): number {
  return distanceMeters(
    userPosition.latitude,
    userPosition.longitude,
    stop.lat,
    stop.lon
  );
}

function resolveStopHighlight(
  stops: StopOnRoute[],
  userPosition: UserPosition | null,
  nowMs: number
): StopHighlight {
  const detectedIndex = Math.max(0, stops.findIndex((s) => s.status === "current"));
  if (!userPosition) return { index: detectedIndex, mode: "static" };

  const detectedStop = stops[detectedIndex];
  const detectedDistance = getStopDistance(detectedStop, userPosition);
  const detectedTimeMs = getStopReferenceTimeMs(detectedStop);
  const isBeforeDetectedStop =
    detectedTimeMs === null || nowMs < detectedTimeMs;

  if (detectedIndex > 0 && isBeforeDetectedStop) {
    if (detectedDistance <= AT_STOP_DISTANCE_M) {
      return { index: detectedIndex, mode: "static" };
    }

    if (detectedDistance <= APPROACHING_STOP_DISTANCE_M) {
      return { index: detectedIndex, mode: "approaching" };
    }

    return { index: detectedIndex - 1, mode: "static" };
  }

  const nextIndex = detectedIndex + 1;
  if (nextIndex < stops.length) {
    const nextStop = stops[nextIndex];
    const nextDistance = getStopDistance(nextStop, userPosition);
    const nextTimeMs = getStopReferenceTimeMs(nextStop);
    const isBeforeNextStop = nextTimeMs === null || nowMs < nextTimeMs;

    if (nextDistance <= AT_STOP_DISTANCE_M) {
      return { index: nextIndex, mode: "static" };
    }

    if (isBeforeNextStop && nextDistance <= APPROACHING_STOP_DISTANCE_M) {
      return { index: nextIndex, mode: "approaching" };
    }
  }

  return { index: detectedIndex, mode: "static" };
}

function getLegKey(activeLeg: ActiveLeg): string {
  const { leg } = activeLeg;
  return [
    leg.trip?.gtfsId ?? leg.trip?.routeShortName ?? leg.mode,
    leg.start.scheduledTime,
    leg.end.scheduledTime,
  ].join("|");
}

function lockStopHighlight(
  candidate: StopHighlight,
  legKey: string
): LockedStopHighlight {
  const previous = lockedHighlights.get(legKey);
  if (!previous || previous.legKey !== legKey) {
    const next = { ...candidate, legKey };
    lockedHighlights.set(legKey, next);
    return next;
  }

  if (candidate.index > previous.index) {
    const next = { ...candidate, legKey };
    lockedHighlights.set(legKey, next);
    return next;
  }

  if (candidate.index === previous.index && candidate.mode !== previous.mode) {
    const next = { ...candidate, legKey };
    lockedHighlights.set(legKey, next);
    return next;
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
  userPosition: UserPosition | null;
}

export function StopList({ activeLeg, userPosition }: StopListProps) {
  const { leg, stops } = activeLeg;
  const shortName = leg.trip?.routeShortName;
  const headsign = leg.trip?.tripHeadsign;
  const now = useNow();
  const legKey = getLegKey(activeLeg);
  const candidateHighlight = useMemo(
    () => resolveStopHighlight(stops, userPosition, now),
    [now, stops, userPosition]
  );
  const highlight = lockStopHighlight(candidateHighlight, legKey);

  const entries = buildVisibleEntries(stops, highlight.index);
  const currentStop = stops[highlight.index];
  const delayMin =
    currentStop?.delaySeconds !== undefined
      ? Math.round(currentStop.delaySeconds / 60)
      : null;

  return (
    <Card className="w-full border-green-400 border-2">
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
          <span className="ml-auto text-xs text-green-700 font-medium">
            Matkalla
            {delayMin !== null && delayMin >= 1 && (
              <span className="ml-2 text-red-600">+{delayMin} min myöhässä</span>
            )}
            {delayMin !== null && delayMin <= -1 && (
              <span className="ml-2 text-amber-600">{delayMin} min edellä</span>
            )}
          </span>
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
                index < highlight.index
                  ? "passed"
                  : index === highlight.index
                  ? "current"
                  : "upcoming";
              const isApproaching = index === highlight.index && highlight.mode === "approaching";
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
                        ? "animate-pulse bg-green-400 border-green-500 ring-2 ring-green-200"
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
                    <div className={stop.delaySeconds !== undefined && stop.delaySeconds > 0 ? "text-red-600 font-medium" : stop.delaySeconds !== undefined && stop.delaySeconds < 0 ? "text-amber-600 font-medium" : "text-muted-foreground"}>
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
