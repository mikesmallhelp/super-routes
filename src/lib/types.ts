export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface GeocodedAddress {
  label: string;
  coordinates: Coordinates;
}

export interface LegStop {
  name: string;
  lat: number;
  lon: number;
  stop?: {
    code: string;
    name: string;
  } | null;
}

export interface Leg {
  mode: string;
  duration: number;
  distance: number;
  realtimeState: string;
  from: LegStop;
  to: LegStop;
  start: { scheduledTime: string };
  end: { scheduledTime: string };
  trip: {
    tripHeadsign: string;
    routeShortName: string;
  } | null;
}

export interface Connection {
  start: string;
  end: string;
  legs: Leg[];
}

export interface SavedTrip {
  id: string;
  originLabel: string;
  destinationLabel: string;
  originCoords: Coordinates;
  destinationCoords: Coordinates;
  selectedVehicles: string[];
}
