"use client";

import useSWR from "swr";
import type { StopDepartureInfo } from "@/lib/digitransit";

interface StopDeparturesResponse {
  departures: StopDepartureInfo[];
}

async function fetcher(url: string): Promise<StopDeparturesResponse> {
  const res = await fetch(url);
  if (!res.ok) return { departures: [] };
  return res.json();
}

function roundToMinute(iso: string): string {
  const d = new Date(iso);
  d.setSeconds(0, 0);
  return d.toISOString();
}

export function useStopDepartures(
  stopGtfsId: string | undefined,
  afterTime: string | undefined,
  includeRoutes: string[],
  excludeRoutes: string[],
  headsign?: string
) {
  const stableAfter = afterTime ? roundToMinute(afterTime) : undefined;
  const includeKey = [...includeRoutes].sort().join(",");
  const excludeKey = [...excludeRoutes].sort().join(",");
  const url = stopGtfsId && stableAfter
    ? `/api/stop-departures?stopGtfsId=${encodeURIComponent(stopGtfsId)}&after=${encodeURIComponent(stableAfter)}&includeRoutes=${encodeURIComponent(includeKey)}&excludeRoutes=${encodeURIComponent(excludeKey)}${headsign ? `&headsign=${encodeURIComponent(headsign)}` : ""}`
    : null;

  const { data } = useSWR<StopDeparturesResponse>(url, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 30_000,
    keepPreviousData: true,
  });

  return data?.departures ?? [];
}
