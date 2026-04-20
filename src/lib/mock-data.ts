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

const SCENARIOS: MockScenario[] = [
  // Walk 1: Kivilammentie 1 → Kolmperänristi
  { progressMin: -47,   userLat: 60.260725, userLon: 24.506763, label: "Kävelee: Kivilammentie 1" },
  { progressMin: -40,   userLat: 60.25801,  userLon: 24.51255,  label: "Kävelee kohti Kolmperänristiä (1/3)" },
  { progressMin: -33,   userLat: 60.25529,  userLon: 24.51833,  label: "Kävelee kohti Kolmperänristiä (2/3)" },
  { progressMin: -27,   userLat: 60.25300,  userLon: 24.52300,  label: "Lähestyy Kolmperänristiä" },

  // Bus 247: Kolmperänristi → Ikea Espoo (15 stops)
  { progressMin: -24.5, userLat: 60.25249,  userLon: 24.52427,  label: "247: Kolmperänristi" },
  { progressMin: -23.6, userLat: 60.24904,  userLon: 24.53423,  label: "247: Kolmperä" },
  { progressMin: -22.7, userLat: 60.247725, userLon: 24.542425, label: "247: Ämmässuo" },
  { progressMin: -21.8, userLat: 60.24449,  userLon: 24.57063,  label: "247: Histansilta" },
  { progressMin: -20.9, userLat: 60.24355,  userLon: 24.57839,  label: "247: Rauhamäki" },
  { progressMin: -20.0, userLat: 60.23671,  userLon: 24.597885, label: "247: Nupurinristi" },
  { progressMin: -19.1, userLat: 60.23408,  userLon: 24.60218,  label: "247: Veikkaustie" },
  { progressMin: -18.2, userLat: 60.229864, userLon: 24.610592, label: "247: Hallava" },
  { progressMin: -17.3, userLat: 60.225916, userLon: 24.618982, label: "247: Karhuniityntie" },
  { progressMin: -16.4, userLat: 60.222895, userLon: 24.627954, label: "247: Kurutie" },
  { progressMin: -15.5, userLat: 60.22181,  userLon: 24.63336,  label: "247: Karhunkynsi" },
  { progressMin: -14.6, userLat: 60.22106,  userLon: 24.64406,  label: "247: Pitkäniitty" },
  { progressMin: -13.7, userLat: 60.22154,  userLon: 24.65273,  label: "247: Miilukorventie" },
  { progressMin: -12.8, userLat: 60.22298,  userLon: 24.66,     label: "247: Ylämyllyntie" },
  { progressMin: -11.9, userLat: 60.218001, userLon: 24.661122, label: "247 saapuu Ikea Espooseen" },

  // Walk 2: Ikea Espoo stop change
  { progressMin: -9, userLat: 60.21878, userLon: 24.66194, label: "Kävelee Ikea Espoon pysäkille" },

  // Bus 530: Ikea Espoo → Iskostie (20 stops)
  { progressMin: -4.5, userLat: 60.21878,  userLon: 24.66194,  label: "530: Ikea Espoo" },
  { progressMin: -4.0, userLat: 60.22162,  userLon: 24.671849, label: "530: Fallåker" },
  { progressMin: -3.5, userLat: 60.223356, userLon: 24.689578, label: "530: Jorvi" },
  { progressMin: -3.0, userLat: 60.22459,  userLon: 24.70664,  label: "530: Petas" },
  { progressMin: -2.5, userLat: 60.22812,  userLon: 24.71094,  label: "530: Kolkeranta" },
  { progressMin: -2.0, userLat: 60.232085, userLon: 24.716303, label: "530: Auroran koulu" },
  { progressMin: -1.5, userLat: 60.23562,  userLon: 24.72505,  label: "530: Vilniemi" },
  { progressMin: -1.0, userLat: 60.24064,  userLon: 24.74186,  label: "530: Lähderannanristi" },
  { progressMin: -0.5, userLat: 60.24387,  userLon: 24.7488,   label: "530: Kuttulammentie" },
  { progressMin: 0,    userLat: 60.250577, userLon: 24.764382, label: "530: Huvilamäki" },
  { progressMin: 0.5,  userLat: 60.253682, userLon: 24.775001, label: "530: Jupperinympyrä" },
  { progressMin: 1,    userLat: 60.25474,  userLon: 24.78064,  label: "530: Linnaistentie" },
  { progressMin: 1.5,  userLat: 60.25537,  userLon: 24.80147,  label: "530: Terhotie" },
  { progressMin: 2,    userLat: 60.255369, userLon: 24.808008, label: "530: Pähkinärinteentie" },
  { progressMin: 2.5,  userLat: 60.254197, userLon: 24.815768, label: "530: Koivuvaarankuja" },
  { progressMin: 3,    userLat: 60.253851, userLon: 24.822685, label: "530: Köysikuja" },
  { progressMin: 3.5,  userLat: 60.25561,  userLon: 24.82723,  label: "530: Vapaalanpolku" },
  { progressMin: 4,    userLat: 60.258998, userLon: 24.836402, label: "530: Lastutie" },
  { progressMin: 4.5,  userLat: 60.25903,  userLon: 24.844529, label: "530: Raappavuorentie" },
  { progressMin: 5,    userLat: 60.25907,  userLon: 24.852743, label: "530 saapuu Iskostielle" },

  // Waiting at Iskostie for bus 560 (530 ended, 560 not yet started)
  { progressMin: 9, userLat: 60.25907, userLon: 24.852743, label: "Odottaa 560 Iskostiellä" },

  // Bus 560: Iskostie → Silvola (5 stops)
  { progressMin: 12.5, userLat: 60.25907,  userLon: 24.852743, label: "560: Iskostie" },
  { progressMin: 13.5, userLat: 60.260899, userLon: 24.8567,   label: "560: Myyrmäen asema" },
  { progressMin: 14.5, userLat: 60.263692, userLon: 24.859619, label: "560: Ojahaantie" },
  { progressMin: 15.5, userLat: 60.263299, userLon: 24.869046, label: "560: Vaskivuori" },
  { progressMin: 16.5, userLat: 60.265006, userLon: 24.883116, label: "560 saapuu Silvolaan" },

  // Walk 3: Silvola → Vetotie 3
  { progressMin: 22,   userLat: 60.265006, userLon: 24.883116, label: "Kävelee: Silvola" },
  { progressMin: 25,   userLat: 60.26661,  userLon: 24.87968,  label: "Kävelee kohti Vetotietä" },
  { progressMin: 28,   userLat: 60.268214, userLon: 24.876241, label: "Lähestyy Vetotie 3" },
];

export const SCENARIO_INTERVAL_MS = (() => {
  const v = process.env.NEXT_PUBLIC_MOCK_INTERVAL_MS;
  const parsed = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30_000;
})();
let startTime: number | null = null;
let pausedElapsed: number | null = null;

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
}

export function resumeMock(): void {
  if (pausedElapsed === null) return;
  startTime = Date.now() - pausedElapsed;
  pausedElapsed = null;
}

export function isMockPaused(): boolean {
  return pausedElapsed !== null;
}

/** Step to next scenario (only works when paused) */
export function stepMockForward(): void {
  if (pausedElapsed === null) return;
  pausedElapsed += SCENARIO_INTERVAL_MS;
}

/** Step to previous scenario (only works when paused) */
export function stepMockBackward(): void {
  if (pausedElapsed === null) return;
  pausedElapsed -= SCENARIO_INTERVAL_MS;
  // Keep non-negative by wrapping to end of cycle
  if (pausedElapsed < 0) {
    pausedElapsed += SCENARIOS.length * SCENARIO_INTERVAL_MS;
  }
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

function timeOffset(baseMinutes: number, progressMin: number): string {
  return new Date(Date.now() + (baseMinutes - progressMin) * 60_000).toISOString();
}

/**
 * Generate mock connections for the current scenario.
 * Times shift based on progressMin so the user appears at the right point in the journey.
 */
export function generateMockConnections(): Connection[] {
  const { progressMin, label } = getCurrentScenario();
  console.log(`[Mock] Skenaario: ${getMockScenarioLabel()}, progress: ${progressMin} min`);

  const t = (min: number) => timeOffset(min, progressMin);

  /**
   * Build an "estimated" field simulating real-time data with a given delay.
   * delayMin: positive = late, negative = early.
   */
  const est = (baseMin: number, delayMin: number) => ({
    time: timeOffset(baseMin + delayMin, progressMin),
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
          stop: { code: "E6413", name: "Kolmperänristi" },
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
          stop: { code: "E6413", name: "Kolmperänristi" },
        },
        to: {
          name: "Ikea Espoo",
          lat: 60.218001,
          lon: 24.661122,
          stop: { code: "E6309", name: "Ikea Espoo" },
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
          stop: { code: "E6309", name: "Ikea Espoo" },
        },
        to: {
          name: "Ikea Espoo",
          lat: 60.21878,
          lon: 24.66194,
          stop: { code: "E6307", name: "Ikea Espoo" },
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
          stop: { code: "E6307", name: "Ikea Espoo" },
        },
        to: {
          name: "Iskostie",
          lat: 60.25907,
          lon: 24.852743,
          stop: { code: "V1597", name: "Iskostie" },
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
          stop: { code: "V1597", name: "Iskostie" },
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
