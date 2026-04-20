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
    const connStart = new Date(conn.start);
    const connEnd = new Date(conn.end);

    // Only consider connections that are in progress
    if (now < connStart || now > connEnd) continue;

    for (const leg of conn.legs) {
      // Skip walking legs
      if (leg.mode === "WALK") continue;

      const legStart = new Date(leg.start.scheduledTime);
      const legEnd = new Date(leg.end.scheduledTime);

      // Only consider legs that are in progress
      if (now < legStart || now > legEnd) continue;

      const stops = buildStopList(leg);
      if (stops.length === 0) continue;

      const closest = findClosestStop(stops, userLat, userLon);

      if (closest.distance < MAX_DISTANCE_M && closest.distance < bestDistance) {
        bestDistance = closest.distance;

        const stopsWithStatus: StopOnRoute[] = stops.map((s, i) => ({
          ...s,
          status: i < closest.index ? "passed" : i === closest.index ? "current" : "upcoming",
        }));

        bestMatch = {
          leg,
          stops: stopsWithStatus,
          connectionIndex: ci,
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
  mode: "on-vehicle" | "waiting";
  activeLeg?: ActiveLeg;
  upcomingArrival?: UpcomingArrival;
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
  const active = detectActiveLeg(connections, userLat, userLon);
  if (active) {
    const legIndex = connections[active.connectionIndex].legs.indexOf(active.leg);
    return {
      connectionIndex: active.connectionIndex,
      legIndex,
      mode: "on-vehicle",
      activeLeg: active,
    };
  }

  const now = new Date();
  let best: {
    connectionIndex: number;
    legIndex: number;
    arrival: UpcomingArrival;
    distance: number;
  } | null = null;

  for (let ci = 0; ci < connections.length; ci++) {
    const conn = connections[ci];
    const connStart = new Date(conn.start);
    const connEnd = new Date(conn.end);
    if (now < connStart || now > connEnd) continue;

    for (let li = 0; li < conn.legs.length; li++) {
      const leg = conn.legs[li];
      if (leg.mode === "WALK" || !leg.trip || !leg.from.stop) continue;

      const legStart = new Date(leg.start.scheduledTime);
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
    return {
      connectionIndex: best.connectionIndex,
      legIndex: best.legIndex,
      mode: "waiting",
      upcomingArrival: best.arrival,
    };
  }

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
