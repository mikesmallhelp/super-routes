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
    case "WALK": return "🚶";
    case "BUS": return "🚌";
    case "TRAM": return "🚃";
    case "RAIL": return "🚆";
    case "SUBWAY": return "🚇";
    case "FERRY": return "⛴️";
    default: return "🚍";
  }
}

function legLabel(leg: Leg): string {
  if (leg.mode === "WALK") {
    return `Kävely: ${leg.from.name} → ${leg.to.name}`;
  }
  const from = leg.from.stop?.name || leg.from.name;
  const to = leg.to.stop?.name || leg.to.name;
  return `${from} → ${to}`;
}

interface LegCardProps {
  leg: Leg;
  variant: "past" | "future";
}

export function LegCard({ leg, variant }: LegCardProps) {
  const isPast = variant === "past";
  const shortName = leg.trip?.routeShortName;

  return (
    <Card
      className={
        isPast
          ? "w-full border-2 border-muted bg-muted/40"
          : "w-full border-2 border-slate-300 dark:border-slate-700"
      }
    >
      <CardContent className="p-3">
        <div className="flex items-center gap-2">
          <span className={isPast ? "grayscale opacity-60" : ""}>
            {modeIcon(leg.mode)}
          </span>
          {shortName && (
            <Badge
              variant="secondary"
              className={`text-xs font-semibold ${isPast ? "opacity-60" : ""}`}
            >
              {shortName}
            </Badge>
          )}
          <span
            className={`text-sm truncate flex-1 ${
              isPast ? "text-muted-foreground line-through decoration-muted-foreground/50" : ""
            }`}
          >
            {legLabel(leg)}
          </span>
          <span
            className={`text-xs tabular-nums shrink-0 ${
              isPast ? "text-muted-foreground" : ""
            }`}
          >
            {formatTime(leg.start.scheduledTime)}–{formatTime(leg.end.scheduledTime)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
