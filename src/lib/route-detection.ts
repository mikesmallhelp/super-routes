import type { Connection, Leg } from "./types";
import { distanceMeters } from "@/hooks/use-geolocation";

export interface StopOnRoute {
  name: string;
  code: string;
  lat: number;
  lon: number;
  scheduledTime?: string;
  realtimeTime?: string;
  delaySeconds?: number;
  status: "passed" | "current" | "upcoming";
}

function computeDelaySeconds(
  scheduled: string,
  estimated?: { time: string } | null
): number | null {
  if (!estimated) return null;
  const sched = new Date(scheduled).getTime();
  const est = new Date(estimated.time).getTime();
  return Math.round((est - sched) / 1000);
}

export interface ActiveLeg {
  leg: Leg;
  stops: StopOnRoute[];
  connectionIndex: number;
  matchDistance: number;
}

const MAX_DISTANCE_M = 500;

export interface StopWithTimes {
  name: string;
  code: string;
  lat: number;
  lon: number;
  scheduledTime: string;
  realtimeTime?: string;
  delaySeconds?: number;
}

/** Build an ordered stop list for a transit leg with interpolated arrival and realtime times */
export function buildStopList(leg: Leg): StopWithTimes[] {
  const raw: { name: string; code: string; lat: number; lon: number }[] = [];

  if (leg.from.stop) {
    raw.push({
      name: leg.from.stop.name,
      code: leg.from.stop.code,
      lat: leg.from.lat,
      lon: leg.from.lon,
    });
  }

  if (leg.intermediateStops) {
    for (const s of leg.intermediateStops) raw.push(s);
  }

  if (leg.to.stop) {
    raw.push({
      name: leg.to.stop.name,
      code: leg.to.stop.code,
      lat: leg.to.lat,
      lon: leg.to.lon,
    });
  }

  const n = raw.length;
  if (n === 0) return [];

  const startMs = new Date(leg.start.scheduledTime).getTime();
  const endMs = new Date(leg.end.scheduledTime).getTime();

  // Interpolate times by distance along the stop chain for more accuracy.
  // Stops are rarely evenly spaced in time, so we weight by segment length.
  const segmentLengths: number[] = [];
  let totalLength = 0;
  for (let i = 0; i < n - 1; i++) {
    const d = distanceMeters(raw[i].lat, raw[i].lon, raw[i + 1].lat, raw[i + 1].lon);
    segmentLengths.push(d);
    totalLength += d;
  }

  const cumulative: number[] = [0];
  for (let i = 0; i < segmentLengths.length; i++) {
    cumulative.push(cumulative[i] + segmentLengths[i]);
  }

  const startDelay = computeDelaySeconds(leg.start.scheduledTime, leg.start.estimated);
  const endDelay = computeDelaySeconds(leg.end.scheduledTime, leg.end.estimated);

  return raw.map((s, i) => {
    const fraction = totalLength > 0 ? cumulative[i] / totalLength : (n > 1 ? i / (n - 1) : 0);
    const schedMs = startMs + fraction * (endMs - startMs);
    const scheduledTime = new Date(schedMs).toISOString();

    let delaySeconds: number | undefined;
    let realtimeTime: string | undefined;
    if (startDelay !== null || endDelay !== null) {
      const sd = startDelay ?? endDelay ?? 0;
      const ed = endDelay ?? startDelay ?? 0;
      delaySeconds = Math.round(sd + fraction * (ed - sd));
      realtimeTime = new Date(schedMs + delaySeconds * 1000).toISOString();
    }

    return { ...s, scheduledTime, realtimeTime, delaySeconds };
  });
}

/** Find the closest stop to the user among a stop list, return index and distance */
function findClosestStop(
  stops: { lat: number; lon: number }[],
  userLat: number,
  userLon: number
): { index: number; distance: number } {
  let minDist = Infinity;
  let minIdx = 0;
  for (let i = 0; i < stops.length; i++) {
    const d = distanceMeters(userLat, userLon, stops[i].lat, stops[i].lon);
    if (d < minDist) {
      minDist = d;
      minIdx = i;
    }
  }
  return { index: minIdx, distance: minDist };
}

/**
 * Detect if the user is currently on a transit leg.
 * Looks through connections that are currently in-progress and finds
 * the best match based on GPS proximity and time window.
 */
export function detectActiveLeg(
  connections: Connection[],
  userLat: number,
  userLon: number
): ActiveLeg | null {
  const now = new Date();

  let bestMatch: ActiveLeg | null = null;
  let bestDistance = Infinity;

  for (let ci = 0; ci < connections.length; ci++) {
    const conn = connections[ci];
    // (Connection-level time check removed — leg-level checks are sufficient
    // and more permissive for users who arrived before scheduled origin time.)

    for (const leg of conn.legs) {
      // Skip walking legs
      if (leg.mode === "WALK") continue;

      // Use realtime times when available so delayed buses are still matched.
      const legStart = leg.start.estimated?.time
        ? new Date(leg.start.estimated.time)
        : new Date(leg.start.scheduledTime);
      const legEnd = leg.end.estimated?.time
        ? new Date(leg.end.estimated.time)
        : new Date(leg.end.scheduledTime);

      // Only consider legs that are in progress
      if (now < legStart || now > legEnd) continue;

      const stops = buildStopList(leg);
      if (stops.length === 0) continue;

      const closest = findClosestStop(stops, userLat, userLon);

      if (closest.distance >= MAX_DISTANCE_M) continue;

      // Stale-leg guard: if the user is at the FROM stop and the leg started
      // more than 3 minutes ago, they almost certainly didn't board.
      // (The bus already left, user is still standing at the stop.)
      if (closest.index === 0) {
        const minutesSinceStart = (now.getTime() - legStart.getTime()) / 60000;
        if (minutesSinceStart > 3) {
          console.log(
            `[Detection] Skip stale leg ${leg.trip?.routeShortName}: user at FROM ` +
              `stop ${stops[0].name} but leg started ${minutesSinceStart.toFixed(1)} min ago`
          );
          continue;
        }
      }

      if (closest.distance < bestDistance) {
        bestDistance = closest.distance;

        const stopsWithStatus: StopOnRoute[] = stops.map((s, i) => ({
          ...s,
          status: i < closest.index ? "passed" : i === closest.index ? "current" : "upcoming",
        }));

        bestMatch = {
          leg,
          stops: stopsWithStatus,
          connectionIndex: ci,
          matchDistance: closest.distance,
        };
      }
    }
  }

  return bestMatch;
}

/**
 * Find upcoming arrivals at the nearest stop for a set of connections.
 * Returns legs arriving at a stop close to the user, with minutes until arrival.
 */
export interface UpcomingArrival {
  routeShortName: string;
  headsign: string;
  mode: string;
  stopName: string;
  stopCode: string;
  /** GTFS id of the departure stop, used to look up schedule info */
  stopGtfsId?: string;
  minutesUntil: number;
  scheduledTime: string;
  realtimeTime?: string;
  delaySeconds?: number;
  /** Scheduled departure of the previous bus of the same route from this stop */
  previousScheduledTime?: string;
  /** Realtime departure of the previous bus, if realtime data available */
  previousRealtimeTime?: string;
}

export interface JourneyState {
  connectionIndex: number;
  legIndex: number;
  mode: "on-vehicle" | "waiting" | "arrived";
  matchDistance: number;
  activeLeg?: ActiveLeg;
  upcomingArrival?: UpcomingArrival;
  remainingWalk?: Leg;
}

const ARRIVAL_GRACE_MS = 45 * 60 * 1000;

function isTransitLeg(leg: Leg): boolean {
  return leg.mode !== "WALK" && !!leg.trip;
}

function hasLaterTransitLeg(legs: Leg[], legIndex: number): boolean {
  return legs.slice(legIndex + 1).some(isTransitLeg);
}

function findRemainingWalk(legs: Leg[], legIndex: number): Leg | undefined {
  return legs.slice(legIndex + 1).find((leg) => leg.mode === "WALK");
}

function buildActiveLegAtStop(
  leg: Leg,
  connectionIndex: number,
  stopIndex: number
): ActiveLeg | null {
  const stops = buildStopList(leg);
  if (stops.length === 0 || stopIndex < 0 || stopIndex >= stops.length) return null;

  return {
    leg,
    connectionIndex,
    matchDistance: 0,
    stops: stops.map((stop, index) => ({
      ...stop,
      status: index < stopIndex ? "passed" : index === stopIndex ? "current" : "upcoming",
    })),
  };
}

/**
 * Determine the user's journey state: either on a vehicle, or waiting at a stop
 * for the next leg of a trip. Returns the connection + leg index so callers can
 * render past and future legs around the active state.
 */
export function detectJourneyState(
  connections: Connection[],
  userLat: number,
  userLon: number
): JourneyState | null {
  console.log(
    `[Detection] Detecting journey state: ${connections.length} connections, user @${userLat.toFixed(5)},${userLon.toFixed(5)}`
  );

  const active = detectActiveLeg(connections, userLat, userLon);
  if (active) {
    const legIndex = connections[active.connectionIndex].legs.indexOf(active.leg);
    const currentStop = active.stops.find((s) => s.status === "current");
    if (
      currentStop &&
      active.stops.indexOf(currentStop) === active.stops.length - 1 &&
      !hasLaterTransitLeg(connections[active.connectionIndex].legs, legIndex)
    ) {
      console.log(
        `[Detection] Arrived at final transit stop: ${active.leg.trip?.routeShortName} → ${currentStop.name}`
      );
      return {
        connectionIndex: active.connectionIndex,
        legIndex,
        mode: "arrived",
        matchDistance: active.matchDistance,
        activeLeg: active,
        remainingWalk: findRemainingWalk(connections[active.connectionIndex].legs, legIndex),
      };
    }

    console.log(
      `[Detection] On-vehicle: ${active.leg.trip?.routeShortName} → ${active.leg.trip?.tripHeadsign}, ` +
        `stop ${currentStop?.name}`
    );
    return {
      connectionIndex: active.connectionIndex,
      legIndex,
      mode: "on-vehicle",
      matchDistance: active.matchDistance,
      activeLeg: active,
    };
  }

  const now = new Date();
  for (let ci = 0; ci < connections.length; ci++) {
    const conn = connections[ci];
    for (let li = 0; li < conn.legs.length; li++) {
      const leg = conn.legs[li];
      if (!isTransitLeg(leg) || !leg.to.stop || hasLaterTransitLeg(conn.legs, li)) continue;

      const legEnd = leg.end.estimated?.time
        ? new Date(leg.end.estimated.time)
        : new Date(leg.end.scheduledTime);
      const ageMs = now.getTime() - legEnd.getTime();
      if (ageMs < 0 || ageMs > ARRIVAL_GRACE_MS) continue;

      const dist = distanceMeters(userLat, userLon, leg.to.lat, leg.to.lon);
      if (dist > MAX_DISTANCE_M) continue;

      const stops = buildStopList(leg);
      const activeAtFinalStop = buildActiveLegAtStop(leg, ci, stops.length - 1);
      if (!activeAtFinalStop) continue;

      console.log(
        `[Detection] Arrived at final transit stop after leg end: ${leg.trip?.routeShortName} → ${leg.to.stop.name}`
      );
      return {
        connectionIndex: ci,
        legIndex: li,
        mode: "arrived",
        matchDistance: dist,
        activeLeg: activeAtFinalStop,
        remainingWalk: findRemainingWalk(conn.legs, li),
      };
    }
  }

  let best: {
    connectionIndex: number;
    legIndex: number;
    arrival: UpcomingArrival;
    distance: number;
  } | null = null;

  for (let ci = 0; ci < connections.length; ci++) {
    const conn = connections[ci];
    const connEnd = new Date(conn.end);
    // Skip only fully-ended connections; users may be early before connStart
    if (now > connEnd) continue;

    for (let li = 0; li < conn.legs.length; li++) {
      const leg = conn.legs[li];
      if (leg.mode === "WALK" || !leg.trip || !leg.from.stop) continue;

      // Use realtime time when available — a delayed bus may still be upcoming
      // even though scheduledTime is in the past
      const legStart = leg.start.estimated?.time
        ? new Date(leg.start.estimated.time)
        : new Date(leg.start.scheduledTime);
      if (legStart <= now) continue;

      // Skip only if a previous TRANSIT leg is still in progress (user still on bus).
      // A walk leg "in progress" by schedule is fine — user may already be at the stop.
      if (li > 0) {
        const prev = conn.legs[li - 1];
        if (prev.mode !== "WALK") {
          const prevEnd = new Date(prev.end.scheduledTime);
          if (now < prevEnd) continue;
        }
      }

      const dist = distanceMeters(userLat, userLon, leg.from.lat, leg.from.lon);
      if (dist > MAX_DISTANCE_M) continue;

      if (!best || dist < best.distance) {
        const delaySec = computeDelaySeconds(leg.start.scheduledTime, leg.start.estimated);
        const effectiveStart = leg.start.estimated?.time
          ? new Date(leg.start.estimated.time)
          : legStart;
        const minutesUntil = Math.round(
          (effectiveStart.getTime() - now.getTime()) / 60000
        );
        best = {
          connectionIndex: ci,
          legIndex: li,
          distance: dist,
          arrival: {
            routeShortName: leg.trip.routeShortName,
            headsign: leg.trip.tripHeadsign,
            mode: leg.mode,
            stopName: leg.from.stop.name,
            stopCode: leg.from.stop.code,
            stopGtfsId: leg.from.stop.gtfsId,
            minutesUntil,
            scheduledTime: leg.start.scheduledTime,
            realtimeTime: leg.start.estimated?.time,
            delaySeconds: delaySec ?? undefined,
          },
        };
      }
    }
  }

  if (best) {
    console.log(
      `[Detection] Waiting: ${best.arrival.routeShortName} → ${best.arrival.headsign} ` +
        `at stop ${best.arrival.stopName}, ${best.arrival.minutesUntil} min`
    );
    return {
      connectionIndex: best.connectionIndex,
      legIndex: best.legIndex,
      mode: "waiting",
      matchDistance: best.distance,
      upcomingArrival: best.arrival,
    };
  }

  // Diagnostics: figure out why nothing matched
  const reasons: string[] = [];
  for (let ci = 0; ci < connections.length; ci++) {
    const conn = connections[ci];
    const cEnd = new Date(conn.end);
    if (now > cEnd) {
      reasons.push(`connection #${ci}: ended at ${cEnd.toLocaleTimeString("fi-FI")}`);
      continue;
    }
    for (let li = 0; li < conn.legs.length; li++) {
      const leg = conn.legs[li];
      if (leg.mode === "WALK" || !leg.trip || !leg.from.stop) continue;
      const legStart = leg.start.estimated?.time
        ? new Date(leg.start.estimated.time)
        : new Date(leg.start.scheduledTime);
      if (legStart <= now) continue;
      const dist = Math.round(
        distanceMeters(userLat, userLon, leg.from.lat, leg.from.lon)
      );
      reasons.push(
        `${leg.trip.routeShortName}@${leg.from.stop.name}: ${dist} m, ${Math.round((legStart.getTime() - now.getTime()) / 60000)} min`
      );
    }
  }
  console.log("[Detection] No match detected. Closest candidates:", reasons.slice(0, 10));

  return null;
}

export function findUpcomingArrivals(
  connections: Connection[],
  userLat: number,
  userLon: number
): UpcomingArrival[] {
  const now = new Date();
  const arrivals: UpcomingArrival[] = [];

  for (const conn of connections) {
    for (const leg of conn.legs) {
      if (leg.mode === "WALK" || !leg.trip) continue;

      const legStart = new Date(leg.start.scheduledTime);
      // Only future departures
      if (legStart <= now) continue;

      // Check if user is near the departure stop
      if (!leg.from.stop) continue;
      const dist = distanceMeters(userLat, userLon, leg.from.lat, leg.from.lon);
      if (dist > MAX_DISTANCE_M) continue;

      const delaySec = computeDelaySeconds(leg.start.scheduledTime, leg.start.estimated);
      const effectiveStart = leg.start.estimated?.time
        ? new Date(leg.start.estimated.time)
        : legStart;
      const minutesUntil = Math.round(
        (effectiveStart.getTime() - now.getTime()) / 60000
      );

      arrivals.push({
        routeShortName: leg.trip.routeShortName,
        headsign: leg.trip.tripHeadsign,
        mode: leg.mode,
        stopName: leg.from.stop.name,
        stopCode: leg.from.stop.code,
        stopGtfsId: leg.from.stop.gtfsId,
        minutesUntil,
        scheduledTime: leg.start.scheduledTime,
        realtimeTime: leg.start.estimated?.time,
        delaySeconds: delaySec ?? undefined,
      });
    }
  }

  // Sort by minutes until arrival
  arrivals.sort((a, b) => a.minutesUntil - b.minutesUntil);

  // Deduplicate by route + time
  const seen = new Set<string>();
  return arrivals.filter((a) => {
    const key = `${a.routeShortName}-${a.scheduledTime}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
