import { Coordinates, Connection } from "./types";

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
            stop { code name }
          }
          to {
            name
            lat
            lon
            stop { code name }
          }
          start { scheduledTime }
          end { scheduledTime }
          intermediateStops { name code lat lon }
          trip {
            tripHeadsign
            routeShortName
            gtfsId
          }
        }
      }
    }
  }
}
`;

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
  return edges.map((edge: { node: Connection }) => edge.node);
}
