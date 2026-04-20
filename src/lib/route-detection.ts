import type { Connection, Leg, IntermediateStop } from "./types";
import { distanceMeters } from "@/hooks/use-geolocation";

export interface StopOnRoute {
  name: string;
  code: string;
  lat: number;
  lon: number;
  scheduledTime?: string;
  status: "passed" | "current" | "upcoming";
}

export interface ActiveLeg {
  leg: Leg;
  stops: StopOnRoute[];
  connectionIndex: number;
}

const MAX_DISTANCE_M = 500;

/** Build an ordered stop list for a transit leg (from + intermediates + to) */
function buildStopList(leg: Leg): { name: string; code: string; lat: number; lon: number }[] {
  const stops: { name: string; code: string; lat: number; lon: number }[] = [];

  if (leg.from.stop) {
    stops.push({
      name: leg.from.stop.name,
      code: leg.from.stop.code,
      lat: leg.from.lat,
      lon: leg.from.lon,
    });
  }

  if (leg.intermediateStops) {
    for (const s of leg.intermediateStops) {
      stops.push(s);
    }
  }

  if (leg.to.stop) {
    stops.push({
      name: leg.to.stop.name,
      code: leg.to.stop.code,
      lat: leg.to.lat,
      lon: leg.to.lon,
    });
  }

  return stops;
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
  minutesUntil: number;
  scheduledTime: string;
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
        const minutesUntil = Math.round((legStart.getTime() - now.getTime()) / 60000);
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
            minutesUntil,
            scheduledTime: leg.start.scheduledTime,
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

      const minutesUntil = Math.round((legStart.getTime() - now.getTime()) / 60000);

      arrivals.push({
        routeShortName: leg.trip.routeShortName,
        headsign: leg.trip.tripHeadsign,
        mode: leg.mode,
        stopName: leg.from.stop.name,
        stopCode: leg.from.stop.code,
        minutesUntil,
        scheduledTime: leg.start.scheduledTime,
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
