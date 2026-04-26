"use client";

import type { ActiveLeg } from "@/lib/route-detection";
import type { StopOnRoute } from "@/lib/route-detection";
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

type VisibleEntry =
  | { type: "stop"; stop: StopOnRoute; index: number }
  | { type: "gap"; hiddenCount: number; section: "passed" | "upcoming" };

/**
 * Build a compact view:
 * - First passed stop + ... + two previous + current + two next + ... + final stop
 */
function buildVisibleEntries(stops: StopOnRoute[]): VisibleEntry[] {
  const currentIdx = stops.findIndex((s) => s.status === "current");
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
}

export function StopList({ activeLeg }: StopListProps) {
  const { leg, stops } = activeLeg;
  const shortName = leg.trip?.routeShortName;
  const headsign = leg.trip?.tripHeadsign;
  const entries = buildVisibleEntries(stops);
  const currentStop = stops.find((s) => s.status === "current");
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
              return (
                <div
                  key={`stop-${index}`}
                  className={`flex items-center gap-3 py-1.5 relative ${
                    stop.status === "passed" ? "opacity-40" : ""
                  }`}
                >
                  <div
                    className={`w-3 h-3 rounded-full border-2 shrink-0 z-10 ${
                      stop.status === "current"
                        ? "bg-green-500 border-green-600 ring-2 ring-green-300"
                        : stop.status === "passed"
                        ? "bg-muted-foreground border-muted-foreground"
                        : "bg-background border-muted-foreground"
                    }`}
                  />

                  <div className="flex-1 min-w-0">
                    <span
                      className={`text-sm truncate block ${
                        stop.status === "current" ? "font-bold text-green-700" : ""
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
