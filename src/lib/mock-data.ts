/**
 * Mock data for testing route tracking features.
 * Based on real Digitransit data: Kivilammentie 1, Espoo → Vetotie 3, Vantaa
 *
 * 10 scenarios that cycle every 30s, simulating the user progressing from
 * bus 530 through transfer at Iskostie onto bus 560.
 *
 * Enable via NEXT_PUBLIC_USE_MOCK_DATA=true in .env.local
 */

import type { Connection } from "./types";

interface MockScenario {
  /** How many minutes to shift the journey forward (user has progressed this far) */
  progressMin: number;
  /** User GPS position for this scenario */
  userLat: number;
  userLon: number;
  /** Debug label */
  label: string;
}

interface MockStop {
  progressMin: number;
  userLat: number;
  userLon: number;
  name: string;
}

const MOCK_APPROACH_DISTANCE_M = 200;

function mockDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function pointBeforeStop(from: MockStop, to: MockStop, metersBefore: number): Pick<MockScenario, "userLat" | "userLon"> {
  const distance = mockDistanceMeters(from.userLat, from.userLon, to.userLat, to.userLon);
  if (distance <= metersBefore) {
    return { userLat: from.userLat, userLon: from.userLon };
  }

  const fraction = (distance - metersBefore) / distance;
  return {
    userLat: from.userLat + (to.userLat - from.userLat) * fraction,
    userLon: from.userLon + (to.userLon - from.userLon) * fraction,
  };
}

function buildTransitScenarios(routeShortName: string, stops: MockStop[]): MockScenario[] {
  const scenarios: MockScenario[] = [];

  for (let i = 0; i < stops.length; i++) {
    const stop = stops[i];
    if (i > 0) {
      const previous = stops[i - 1];
      const gapMin = stop.progressMin - previous.progressMin;
      const approachOffsetMin = Math.min(0.2, Math.max(0.05, gapMin / 3));
      scenarios.push({
        progressMin: stop.progressMin - approachOffsetMin,
        ...pointBeforeStop(previous, stop, MOCK_APPROACH_DISTANCE_M),
        label: `${routeShortName}: approaching ${stop.name}`,
      });
    }

    scenarios.push({
      progressMin: stop.progressMin,
      userLat: stop.userLat,
      userLon: stop.userLon,
      label: `${routeShortName}: ${stop.name}`,
    });
  }

  return scenarios;
}

const SCENARIOS: MockScenario[] = [
  // Walk 1: Kivilammentie 1 → Kolmperänristi
  { progressMin: -47,   userLat: 60.260725, userLon: 24.506763, label: "Walking: Kivilammentie 1" },
  { progressMin: -40,   userLat: 60.25801,  userLon: 24.51255,  label: "Walking toward Kolmperänristi (1/3)" },
  { progressMin: -33,   userLat: 60.25529,  userLon: 24.51833,  label: "Walking toward Kolmperänristi (2/3)" },
  { progressMin: -27,   userLat: 60.25300,  userLon: 24.52300,  label: "Approaching Kolmperänristi" },

  // Bus 247: Kolmperänristi → Ikea Espoo (15 stops)
  ...buildTransitScenarios("247", [
    { progressMin: -24.5, userLat: 60.25249,  userLon: 24.52427,  name: "Kolmperänristi" },
    { progressMin: -23.6, userLat: 60.24904,  userLon: 24.53423,  name: "Kolmperä" },
    { progressMin: -22.7, userLat: 60.247725, userLon: 24.542425, name: "Ämmässuo" },
    { progressMin: -21.8, userLat: 60.24449,  userLon: 24.57063,  name: "Histansilta" },
    { progressMin: -20.9, userLat: 60.24355,  userLon: 24.57839,  name: "Rauhamäki" },
    { progressMin: -20.0, userLat: 60.23671,  userLon: 24.597885, name: "Nupurinristi" },
    { progressMin: -19.1, userLat: 60.23408,  userLon: 24.60218,  name: "Veikkaustie" },
    { progressMin: -18.2, userLat: 60.229864, userLon: 24.610592, name: "Hallava" },
    { progressMin: -17.3, userLat: 60.225916, userLon: 24.618982, name: "Karhuniityntie" },
    { progressMin: -16.4, userLat: 60.222895, userLon: 24.627954, name: "Kurutie" },
    { progressMin: -15.5, userLat: 60.22181,  userLon: 24.63336,  name: "Karhunkynsi" },
    { progressMin: -14.6, userLat: 60.22106,  userLon: 24.64406,  name: "Pitkäniitty" },
    { progressMin: -13.7, userLat: 60.22154,  userLon: 24.65273,  name: "Miilukorventie" },
    { progressMin: -12.8, userLat: 60.22298,  userLon: 24.66,     name: "Ylämyllyntie" },
    { progressMin: -11.9, userLat: 60.218001, userLon: 24.661122, name: "Ikea Espoo" },
  ]),

  // Walk 2: Ikea Espoo stop change
  { progressMin: -9, userLat: 60.21878, userLon: 24.66194, label: "Walking to the Ikea Espoo stop" },

  // Bus 530: Ikea Espoo → Iskostie (20 stops)
  { progressMin: -4.5, userLat: 60.21878,  userLon: 24.66194,  label: "530: Ikea Espoo" },
  ...buildTransitScenarios("530", [
    { progressMin: -3.0, userLat: 60.21878,  userLon: 24.66194,  name: "Ikea Espoo" },
    { progressMin: -2.4, userLat: 60.22162,  userLon: 24.671849, name: "Fallåker" },
    { progressMin: -1.8, userLat: 60.223356, userLon: 24.689578, name: "Jorvi" },
    { progressMin: -1.3, userLat: 60.22459,  userLon: 24.70664,  name: "Petas" },
    { progressMin: -0.7, userLat: 60.22812,  userLon: 24.71094,  name: "Kolkeranta" },
    { progressMin: -0.1, userLat: 60.232085, userLon: 24.716303, name: "Auroran koulu" },
    { progressMin: 0.5,  userLat: 60.23562,  userLon: 24.72505,  name: "Vilniemi" },
    { progressMin: 1.1,  userLat: 60.24064,  userLon: 24.74186,  name: "Lähderannanristi" },
    { progressMin: 1.6,  userLat: 60.24387,  userLon: 24.7488,   name: "Kuttulammentie" },
    { progressMin: 2.2,  userLat: 60.250577, userLon: 24.764382, name: "Huvilamäki" },
    { progressMin: 2.8,  userLat: 60.253682, userLon: 24.775001, name: "Jupperinympyrä" },
    { progressMin: 3.4,  userLat: 60.25474,  userLon: 24.78064,  name: "Linnaistentie" },
    { progressMin: 3.9,  userLat: 60.25537,  userLon: 24.80147,  name: "Terhotie" },
    { progressMin: 4.5,  userLat: 60.255369, userLon: 24.808008, name: "Pähkinärinteentie" },
    { progressMin: 5.1,  userLat: 60.254197, userLon: 24.815768, name: "Koivuvaarankuja" },
    { progressMin: 5.7,  userLat: 60.253851, userLon: 24.822685, name: "Köysikuja" },
    { progressMin: 6.3,  userLat: 60.25561,  userLon: 24.82723,  name: "Vapaalanpolku" },
    { progressMin: 6.8,  userLat: 60.258998, userLon: 24.836402, name: "Lastutie" },
    { progressMin: 7.4,  userLat: 60.25903,  userLon: 24.844529, name: "Raappavuorentie" },
    { progressMin: 8.0,  userLat: 60.25907,  userLon: 24.852743, name: "Iskostie" },
  ]),

  // Waiting at Iskostie for bus 560 (530 ended, 560 not yet started)
  { progressMin: 9, userLat: 60.25907, userLon: 24.852743, label: "Waiting for 560 at Iskostie" },

  // Bus 560: Iskostie → Silvola (5 stops)
  ...buildTransitScenarios("560", [
    { progressMin: 15, userLat: 60.25907,  userLon: 24.852743, name: "Iskostie" },
    { progressMin: 17, userLat: 60.260899, userLon: 24.8567,   name: "Myyrmäen asema" },
    { progressMin: 19, userLat: 60.263692, userLon: 24.859619, name: "Ojahaantie" },
    { progressMin: 21, userLat: 60.263299, userLon: 24.869046, name: "Vaskivuori" },
    { progressMin: 23, userLat: 60.265006, userLon: 24.883116, name: "Silvola" },
  ]),

  // Walk 3: Silvola → Vetotie 3
  { progressMin: 23.5, userLat: 60.265006, userLon: 24.883116, label: "Walking: Silvola" },
  { progressMin: 25.5, userLat: 60.26661,  userLon: 24.87968,  label: "Walking toward Vetotie" },
  { progressMin: 28,   userLat: 60.268214, userLon: 24.876241, label: "Approaching Vetotie 3" },
];

export const SCENARIO_INTERVAL_MS = (() => {
  const v = process.env.NEXT_PUBLIC_MOCK_INTERVAL_MS;
  const parsed = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30_000;
})();
let startTime: number | null = null;
let pausedElapsed: number | null = null;
const mockChangeSubscribers = new Set<() => void>();

function notifyMockChanged() {
  for (const callback of mockChangeSubscribers) callback();
}

export function subscribeMockChanges(callback: () => void): () => void {
  mockChangeSubscribers.add(callback);
  return () => {
    mockChangeSubscribers.delete(callback);
  };
}

function getElapsed(): number {
  if (startTime === null) startTime = Date.now();
  if (pausedElapsed !== null) return pausedElapsed;
  return Date.now() - startTime;
}

function getScenarioIndex(): number {
  return Math.floor(getElapsed() / SCENARIO_INTERVAL_MS) % SCENARIOS.length;
}

export function pauseMock(): void {
  if (pausedElapsed !== null) return;
  pausedElapsed = getElapsed();
  notifyMockChanged();
}

export function resumeMock(): void {
  if (pausedElapsed === null) return;
  startTime = Date.now() - pausedElapsed;
  pausedElapsed = null;
  notifyMockChanged();
}

export function isMockPaused(): boolean {
  return pausedElapsed !== null;
}

/** Step to next scenario (only works when paused) */
export function stepMockForward(): void {
  if (pausedElapsed === null) return;
  pausedElapsed += SCENARIO_INTERVAL_MS;
  notifyMockChanged();
}

/** Step to previous scenario (only works when paused) */
export function stepMockBackward(): void {
  if (pausedElapsed === null) return;
  pausedElapsed -= SCENARIO_INTERVAL_MS;
  // Keep non-negative by wrapping to end of cycle
  if (pausedElapsed < 0) {
    pausedElapsed += SCENARIOS.length * SCENARIO_INTERVAL_MS;
  }
  notifyMockChanged();
}

function getCurrentScenario(): MockScenario {
  return SCENARIOS[getScenarioIndex()];
}

/** Get mock user position for current scenario (used by useGeolocation) */
export function getMockUserPosition(): { latitude: number; longitude: number } {
  const s = getCurrentScenario();
  return { latitude: s.userLat, longitude: s.userLon };
}

/** Get current scenario label for debug logging */
export function getMockScenarioLabel(): string {
  const idx = getScenarioIndex();
  return `[${idx + 1}/${SCENARIOS.length}] ${SCENARIOS[idx].label}`;
}

function timeOffset(nowMs: number, baseMinutes: number, progressMin: number): string {
  return new Date(nowMs + (baseMinutes - progressMin) * 60_000).toISOString();
}

/**
 * Generate mock connections for the current scenario.
 * Times shift based on progressMin so the user appears at the right point in the journey.
 */
export function generateMockConnections(): Connection[] {
  const nowMs = Date.now();
  const { progressMin } = getCurrentScenario();
  console.log(`[Mock] Scenario: ${getMockScenarioLabel()}, progress: ${progressMin} min`);

  const t = (min: number) => timeOffset(nowMs, min, progressMin);

  /**
   * Build an "estimated" field simulating real-time data with a given delay.
   * delayMin: positive = late, negative = early.
   */
  const est = (baseMin: number, delayMin: number) => ({
    time: timeOffset(nowMs, baseMin + delayMin, progressMin),
    delay: `PT${Math.round(delayMin * 60)}S`,
  });

  // Mock delays to exercise the UI:
  //   247 on time, 530 two minutes late, 560 three minutes late
  const DELAY_247 = 0;
  const DELAY_530 = 2;
  const DELAY_560 = 3;

  const connection: Connection = {
    start: t(-50),
    end: t(29),
    legs: [
      // Leg 1: Walk to first bus stop
      {
        mode: "WALK",
        duration: 1500,
        distance: 1939,
        realtimeState: "SCHEDULED",
        from: {
          name: "Kivilammentie 1, Espoo",
          lat: 60.260725,
          lon: 24.506763,
          stop: null,
        },
        to: {
          name: "Kolmperänristi",
          lat: 60.25249,
          lon: 24.52427,
          stop: { code: "E6413", name: "Kolmperänristi", gtfsId: "HSL:2641218" },
        },
        start: { scheduledTime: t(-50) },
        end: { scheduledTime: t(-25) },
        intermediateStops: null,
        trip: null,
      },
      // Leg 2: Bus 247 Kolmperänristi → Ikea Espoo
      {
        mode: "BUS",
        duration: 840,
        distance: 9689,
        realtimeState: "SCHEDULED",
        from: {
          name: "Kolmperänristi",
          lat: 60.25249,
          lon: 24.52427,
          stop: { code: "E6413", name: "Kolmperänristi", gtfsId: "HSL:2641218" },
        },
        to: {
          name: "Ikea Espoo",
          lat: 60.218001,
          lon: 24.661122,
          stop: { code: "E6309", name: "Ikea Espoo", gtfsId: "HSL:2631219" },
        },
        start: { scheduledTime: t(-25), estimated: est(-25, DELAY_247) },
        end: { scheduledTime: t(-11), estimated: est(-11, DELAY_247) },
        intermediateStops: [
          { name: "Kolmperä", code: "E6407", lat: 60.24904, lon: 24.53423 },
          { name: "Ämmässuo", code: "E6965", lat: 60.247725, lon: 24.542425 },
          { name: "Histansilta", code: "E6424", lat: 60.24449, lon: 24.57063 },
          { name: "Rauhamäki", code: "E6422", lat: 60.24355, lon: 24.57839 },
          { name: "Nupurinristi", code: "E6420", lat: 60.23671, lon: 24.597885 },
          { name: "Veikkaustie", code: "E6418", lat: 60.23408, lon: 24.60218 },
          { name: "Hallava", code: "E6416", lat: 60.229864, lon: 24.610592 },
          { name: "Karhuniityntie", code: "E6817", lat: 60.225916, lon: 24.618982 },
          { name: "Kurutie", code: "E6815", lat: 60.222895, lon: 24.627954 },
          { name: "Karhunkynsi", code: "E6813", lat: 60.22181, lon: 24.63336 },
          { name: "Pitkäniitty", code: "E6811", lat: 60.22106, lon: 24.64406 },
          { name: "Miilukorventie", code: "E6306", lat: 60.22154, lon: 24.65273 },
          { name: "Ylämyllyntie", code: "E6802", lat: 60.22298, lon: 24.66 },
        ],
        trip: {
          tripHeadsign: "Espoon keskus",
          routeShortName: "247",
          gtfsId: "HSL:2247_20260409_Pe_2_1856",
        },
      },
      // Leg 3: Walk between Ikea Espoo stops
      {
        mode: "WALK",
        duration: 176,
        distance: 133,
        realtimeState: "SCHEDULED",
        from: {
          name: "Ikea Espoo",
          lat: 60.218001,
          lon: 24.661122,
          stop: { code: "E6309", name: "Ikea Espoo", gtfsId: "HSL:2631219" },
        },
        to: {
          name: "Ikea Espoo",
          lat: 60.21878,
          lon: 24.66194,
          stop: { code: "E6307", name: "Ikea Espoo", gtfsId: "HSL:2631217" },
        },
        start: { scheduledTime: t(-11) },
        end: { scheduledTime: t(-8) },
        intermediateStops: null,
        trip: null,
      },
      // Leg 4: Bus 530 Ikea Espoo → Iskostie
      {
        mode: "BUS",
        duration: 660,
        distance: 13000,
        realtimeState: "SCHEDULED",
        from: {
          name: "Ikea Espoo",
          lat: 60.21878,
          lon: 24.66194,
          stop: { code: "E6307", name: "Ikea Espoo", gtfsId: "HSL:2631217" },
        },
        to: {
          name: "Iskostie",
          lat: 60.25907,
          lon: 24.852743,
          stop: { code: "V1597", name: "Iskostie", gtfsId: "HSL:4150297" },
        },
        start: { scheduledTime: t(-5), estimated: est(-5, DELAY_530) },
        end: { scheduledTime: t(6), estimated: est(6, DELAY_530) },
        intermediateStops: [
          { name: "Fallåker", code: "E6311", lat: 60.22162, lon: 24.671849 },
          { name: "Jorvi", code: "E6302", lat: 60.223356, lon: 24.689578 },
          { name: "Petas", code: "E1540", lat: 60.22459, lon: 24.70664 },
          { name: "Kolkeranta", code: "E1529", lat: 60.22812, lon: 24.71094 },
          { name: "Auroran koulu", code: "E1533", lat: 60.232085, lon: 24.716303 },
          { name: "Vilniemi", code: "E1538", lat: 60.23562, lon: 24.72505 },
          { name: "Lähderannanristi", code: "E1404", lat: 60.24064, lon: 24.74186 },
          { name: "Kuttulammentie", code: "E1405", lat: 60.24387, lon: 24.7488 },
          { name: "Huvilamäki", code: "E1435", lat: 60.250577, lon: 24.764382 },
          { name: "Jupperinympyrä", code: "E1439", lat: 60.253682, lon: 24.775001 },
          { name: "Linnaistentie", code: "V1010", lat: 60.25474, lon: 24.78064 },
          { name: "Terhotie", code: "V1288", lat: 60.25537, lon: 24.80147 },
          { name: "Pähkinärinteentie", code: "V1206", lat: 60.255369, lon: 24.808008 },
          { name: "Koivuvaarankuja", code: "V1204", lat: 60.254197, lon: 24.815768 },
          { name: "Köysikuja", code: "V1202", lat: 60.253851, lon: 24.822685 },
          { name: "Vapaalanpolku", code: "V1307", lat: 60.25561, lon: 24.82723 },
          { name: "Lastutie", code: "V1309", lat: 60.258998, lon: 24.836402 },
          { name: "Raappavuorentie", code: "V1577", lat: 60.25903, lon: 24.844529 },
        ],
        trip: {
          tripHeadsign: "Myyrmäki",
          routeShortName: "530",
          gtfsId: "HSL:5530_20260409_Pe_1_1905",
        },
      },
      // Leg 5: Bus 560 Iskostie → Silvola
      {
        mode: "BUS",
        duration: 480,
        distance: 2924,
        realtimeState: "SCHEDULED",
        from: {
          name: "Iskostie",
          lat: 60.25907,
          lon: 24.852743,
          stop: { code: "V1597", name: "Iskostie", gtfsId: "HSL:4150297" },
        },
        to: {
          name: "Silvola",
          lat: 60.265006,
          lon: 24.883116,
          stop: { code: "V1632", name: "Silvola" },
        },
        start: { scheduledTime: t(12), estimated: est(12, DELAY_560) },
        end: { scheduledTime: t(20), estimated: est(20, DELAY_560) },
        intermediateStops: [
          { name: "Myyrmäen asema", code: "V1565", lat: 60.260899, lon: 24.8567 },
          { name: "Ojahaantie", code: "V1520", lat: 60.263692, lon: 24.859619 },
          { name: "Vaskivuori", code: "V1612", lat: 60.263299, lon: 24.869046 },
        ],
        trip: {
          tripHeadsign: "Rastila (M)",
          routeShortName: "560",
          gtfsId: "HSL:4560_20260409_Pe_2_2006",
        },
      },
      // Leg 6: Walk to destination
      {
        mode: "WALK",
        duration: 560,
        distance: 697,
        realtimeState: "SCHEDULED",
        from: {
          name: "Silvola",
          lat: 60.265006,
          lon: 24.883116,
          stop: { code: "V1632", name: "Silvola" },
        },
        to: {
          name: "Vetotie 3, Vantaa",
          lat: 60.268214,
          lon: 24.876241,
          stop: null,
        },
        start: { scheduledTime: t(20) },
        end: { scheduledTime: t(29) },
        intermediateStops: null,
        trip: null,
      },
    ],
  };

  return [connection];
}

export function getMockPreviousDeparture(
  stopGtfsId: string | undefined,
  routeShortName: string | undefined,
  beforeTime: string | undefined
): { scheduledTime: string | null; realtimeTime?: string } {
  if (!stopGtfsId || !routeShortName || !beforeTime) return { scheduledTime: null };

  const { progressMin } = getCurrentScenario();
  const nowMs = Date.now();
  const previousDepartures: Record<string, { scheduledBaseMin: number; realtimeBaseMin?: number }> = {
    // Previous 530 after the 247 arrival at Ikea Espoo, so the transfer is possible.
    "HSL:2631217:530": { scheduledBaseMin: -10, realtimeBaseMin: -10 },
    // Previous 560 before the delayed 530 arrival at Iskostie, so the transfer is not possible.
    "HSL:4150297:560": { scheduledBaseMin: 7, realtimeBaseMin: 7 },
  };

  const departure = previousDepartures[`${stopGtfsId}:${routeShortName}`];
  if (!departure) return { scheduledTime: null };

  const scheduledTime = timeOffset(nowMs, departure.scheduledBaseMin, progressMin);
  if (new Date(scheduledTime).getTime() >= new Date(beforeTime).getTime()) {
    return { scheduledTime: null };
  }

  return {
    scheduledTime,
    realtimeTime:
      departure.realtimeBaseMin !== undefined
        ? timeOffset(nowMs, departure.realtimeBaseMin, progressMin)
        : undefined,
  };
}
