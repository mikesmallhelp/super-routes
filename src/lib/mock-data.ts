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
  // On bus 530, approaching Iskostie from various stops
  { progressMin: 0,  userLat: 60.250577, userLon: 24.764382, label: "530: Huvilamäki" },
  { progressMin: 1,  userLat: 60.253682, userLon: 24.775001, label: "530: Jupperinympyrä" },
  { progressMin: 2,  userLat: 60.25474,  userLon: 24.78064,  label: "530: Linnaistentie" },
  { progressMin: 3,  userLat: 60.25537,  userLon: 24.80147,  label: "530: Terhotie" },
  { progressMin: 4,  userLat: 60.254197, userLon: 24.815768, label: "530: Koivuvaarankuja" },
  { progressMin: 5,  userLat: 60.25561,  userLon: 24.82723,  label: "530: Vapaalanpolku" },
  // Arriving at transfer point
  { progressMin: 6,  userLat: 60.25907,  userLon: 24.852743, label: "530 saapuu Iskostielle" },
  // Waiting for bus 560
  { progressMin: 8,  userLat: 60.25907,  userLon: 24.852743, label: "Odottaa 560 Iskostiellä" },
  // On bus 560
  { progressMin: 13, userLat: 60.260899, userLon: 24.8567,   label: "560: Myyrmäen asema" },
  { progressMin: 15, userLat: 60.263692, userLon: 24.859619, label: "560: Ojahaantie" },
];

export const SCENARIO_INTERVAL_MS = (() => {
  const v = process.env.NEXT_PUBLIC_MOCK_INTERVAL_MS;
  const parsed = v ? parseInt(v, 10) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 30_000;
})();
let startTime: number | null = null;

function getScenarioIndex(): number {
  if (startTime === null) startTime = Date.now();
  const elapsed = Date.now() - startTime;
  return Math.floor(elapsed / SCENARIO_INTERVAL_MS) % SCENARIOS.length;
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
        start: { scheduledTime: t(-25) },
        end: { scheduledTime: t(-11) },
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
        start: { scheduledTime: t(-5) },
        end: { scheduledTime: t(6) },
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
        start: { scheduledTime: t(12) },
        end: { scheduledTime: t(20) },
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
