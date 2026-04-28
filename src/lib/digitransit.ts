import { Coordinates, Connection, Leg, VehiclePosition } from "./types";

const API_KEY = process.env.DIGITRANSIT_API_KEY!;
const GEOCODE_URL = "https://api.digitransit.fi/geocoding/v1/search";
const ROUTING_URL = "https://api.digitransit.fi/routing/v2/hsl/gtfs/v1";

function log(label: string, data: unknown) {
  if (process.env.DIGITRANSIT_LOG === "true") {
    console.log(`[Digitransit] ${label}:`, JSON.stringify(data, null, 2));
  }
}

const AUTOCOMPLETE_URL = "https://api.digitransit.fi/geocoding/v1/autocomplete";

const HSL_MUNICIPALITIES = new Set([
  "Helsinki",
  "Espoo",
  "Vantaa",
  "Kauniainen",
  "Siuntio",
  "Kirkkonummi",
  "Sipoo",
  "Kerava",
  "Tuusula",
]);

export async function autocompleteAddress(
  text: string
): Promise<{ label: string; lat: number; lon: number }[]> {
  if (!text || text.length < 2) return [];

  const url = `${AUTOCOMPLETE_URL}?text=${encodeURIComponent(text)}&size=20&lang=fi&boundary.rect.min_lat=60.0&boundary.rect.max_lat=60.6&boundary.rect.min_lon=24.0&boundary.rect.max_lon=25.2`;
  log("Autocomplete request", { text, url });

  const res = await fetch(url, {
    headers: { "digitransit-subscription-key": API_KEY },
  });
  const data = await res.json();
  log("Autocomplete response", data);

  const features = data.features || [];
  return features
    .filter(
      (f: { properties: { localadmin?: string; locality?: string } }) => {
        const municipality = f.properties.localadmin || f.properties.locality;
        return municipality && HSL_MUNICIPALITIES.has(municipality);
      }
    )
    .slice(0, 5)
    .map(
      (f: { properties: { label: string }; geometry: { coordinates: number[] } }) => {
        const [lon, lat] = f.geometry.coordinates;
        return { label: f.properties.label, lat, lon };
      }
    );
}

export async function geocodeAddress(
  text: string
): Promise<{ label: string; lat: number; lon: number } | null> {
  const url = `${GEOCODE_URL}?text=${encodeURIComponent(text)}&size=1&lang=fi`;
  log("Geocode request", { text, url });

  const res = await fetch(url, {
    headers: { "digitransit-subscription-key": API_KEY },
  });
  const data = await res.json();
  log("Geocode response", data);

  const feature = data.features?.[0];
  if (!feature) return null;

  const [lon, lat] = feature.geometry.coordinates;
  return {
    label: feature.properties.label || text,
    lat,
    lon,
  };
}

const PLAN_QUERY = `
query PlanConnection(
  $originLat: CoordinateValue!,
  $originLon: CoordinateValue!,
  $destLat: CoordinateValue!,
  $destLon: CoordinateValue!,
  $numItineraries: Int!,
  $dateTime: OffsetDateTime
) {
  planConnection(
    origin: { location: { coordinate: { latitude: $originLat, longitude: $originLon } } }
    destination: { location: { coordinate: { latitude: $destLat, longitude: $destLon } } }
    first: $numItineraries
    dateTime: { earliestDeparture: $dateTime }
  ) {
    edges {
      node {
        start
        end
        legs {
          mode
          duration
          distance
          realtimeState
          from {
            name
            lat
            lon
            stop { code name gtfsId }
          }
          to {
            name
            lat
            lon
            stop { code name gtfsId }
          }
          start { scheduledTime estimated { time delay } }
          end { scheduledTime estimated { time delay } }
          intermediateStops { name code lat lon }
          trip {
            tripHeadsign
            routeShortName
            gtfsId
            pattern {
              vehiclePositions {
                lat
                lon
                heading
                speed
                lastUpdate
                vehicleId
                trip { gtfsId }
              }
            }
          }
        }
      }
    }
  }
}
`;

type GraphqlVehiclePosition = VehiclePosition & {
  trip?: { gtfsId?: string | null } | null;
};

type GraphqlTrip = NonNullable<Leg["trip"]> & {
  pattern?: {
    vehiclePositions?: GraphqlVehiclePosition[] | null;
  } | null;
};

type GraphqlLeg = Omit<Leg, "trip"> & {
  trip: GraphqlTrip | null;
};

type GraphqlConnection = Omit<Connection, "legs"> & {
  legs: GraphqlLeg[];
};

function pickVehiclePositionForTrip(trip: GraphqlTrip | null): VehiclePosition | null {
  if (!trip?.gtfsId || !trip.pattern?.vehiclePositions?.length) return null;

  const matchingPositions = trip.pattern.vehiclePositions.filter(
    (position) => position.trip?.gtfsId === trip.gtfsId
  );
  if (matchingPositions.length === 0) return null;

  const latestPosition = matchingPositions.reduce((best, current) => {
    const bestTs = best.lastUpdate ? new Date(best.lastUpdate).getTime() : 0;
    const currentTs = current.lastUpdate ? new Date(current.lastUpdate).getTime() : 0;
    return currentTs > bestTs ? current : best;
  });

  return {
    lat: latestPosition.lat,
    lon: latestPosition.lon,
    heading: latestPosition.heading,
    speed: latestPosition.speed,
    lastUpdate: latestPosition.lastUpdate,
    vehicleId: latestPosition.vehicleId,
  };
}

function mapConnection(edgeNode: GraphqlConnection): Connection {
  return {
    ...edgeNode,
    legs: edgeNode.legs.map((leg) => ({
      ...leg,
      trip: leg.trip
        ? {
            tripHeadsign: leg.trip.tripHeadsign,
            routeShortName: leg.trip.routeShortName,
            gtfsId: leg.trip.gtfsId,
            vehiclePosition: pickVehiclePositionForTrip(leg.trip),
          }
        : null,
    })),
  };
}

const PREV_DEPARTURE_QUERY = `
query PrevDeparture($stopId: String!, $date: String!) {
  stop(id: $stopId) {
    name
    code
    stoptimesForServiceDate(date: $date, omitNonPickups: true) {
      pattern {
        route { shortName }
        headsign
      }
      stoptimes {
        scheduledDeparture
        realtimeDeparture
        serviceDay
        realtime
      }
    }
  }
}
`;

/**
 * Fetch the scheduled departure time of the PREVIOUS vehicle of a given route
 * from a specific stop, relative to a target time.
 *
 * Returns null if no previous departure found in the service day's schedule.
 */
export async function fetchPreviousDeparture(
  stopGtfsId: string,
  routeShortName: string,
  beforeTime: string
): Promise<{ scheduledTime: string; realtimeTime?: string } | null> {
  const before = new Date(beforeTime);
  // Use Helsinki-local date for the service date lookup
  const hdate = new Date(before.toLocaleString("en-US", { timeZone: "Europe/Helsinki" }));
  const date = `${hdate.getFullYear()}${String(hdate.getMonth() + 1).padStart(2, "0")}${String(hdate.getDate()).padStart(2, "0")}`;

  const res = await fetch(ROUTING_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "digitransit-subscription-key": API_KEY,
    },
    body: JSON.stringify({
      query: PREV_DEPARTURE_QUERY,
      variables: { stopId: stopGtfsId, date },
    }),
  });
  const data = await res.json();
  log("PrevDeparture response", data);
  if (data.errors) {
    console.error("[Digitransit] PrevDeparture errors:", data.errors);
    return null;
  }

  const stop = data.data?.stop;
  if (!stop) return null;

  const beforeMs = before.getTime();
  type ST = { scheduledDeparture: number; realtimeDeparture?: number; serviceDay: number; realtime: boolean };
  let best: { schedMs: number; realtMs: number | null } | null = null;

  for (const p of stop.stoptimesForServiceDate || []) {
    if (p.pattern?.route?.shortName !== routeShortName) continue;
    for (const st of p.stoptimes as ST[]) {
      const schedMs = (st.serviceDay + st.scheduledDeparture) * 1000;
      if (schedMs >= beforeMs) continue;
      if (!best || schedMs > best.schedMs) {
        const realtMs = st.realtime && st.realtimeDeparture != null
          ? (st.serviceDay + st.realtimeDeparture) * 1000
          : null;
        best = { schedMs, realtMs };
      }
    }
  }

  if (!best) return null;
  return {
    scheduledTime: new Date(best.schedMs).toISOString(),
    realtimeTime: best.realtMs != null ? new Date(best.realtMs).toISOString() : undefined,
  };
}

export async function fetchRoutes(
  origin: Coordinates,
  destination: Coordinates,
  numItineraries: number = 5,
  dateTime?: string
): Promise<Connection[]> {
  const now = dateTime || new Date().toISOString();
  const variables = {
    originLat: origin.latitude,
    originLon: origin.longitude,
    destLat: destination.latitude,
    destLon: destination.longitude,
    numItineraries,
    dateTime: now,
  };

  log("Routes request", { variables });

  const res = await fetch(ROUTING_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "digitransit-subscription-key": API_KEY,
    },
    body: JSON.stringify({ query: PLAN_QUERY, variables }),
  });

  const data = await res.json();
  log("Routes response", data);

  if (data.errors) {
    console.error("[Digitransit] GraphQL errors:", data.errors);
    throw new Error(data.errors[0]?.message || "GraphQL error");
  }

  const edges = data.data?.planConnection?.edges || [];
  return edges.map((edge: { node: GraphqlConnection }) => mapConnection(edge.node));
}
