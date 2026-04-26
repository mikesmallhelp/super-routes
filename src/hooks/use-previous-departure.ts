"use client";

import useSWR from "swr";
import { getMockPreviousDeparture } from "@/lib/mock-data";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";

interface PreviousDepartureResponse {
  scheduledTime: string | null;
  realtimeTime?: string;
}

async function fetcher(url: string): Promise<PreviousDepartureResponse> {
  const res = await fetch(url);
  if (!res.ok) return { scheduledTime: null };
  return res.json();
}

/** Round an ISO timestamp down to the start of its minute — stabilises the SWR key */
function roundToMinute(iso: string): string {
  const d = new Date(iso);
  d.setSeconds(0, 0);
  return d.toISOString();
}

/**
 * Fetch the scheduled/realtime departure of the previous bus of the same route
 * from the same stop, via Digitransit API.
 *
 * Uses minute-resolution caching key and keeps previous data while revalidating
 * to avoid flickering when upstream scheduledTime updates frequently.
 */
export function usePreviousDeparture(
  stopGtfsId: string | undefined,
  routeShortName: string | undefined,
  beforeTime: string | undefined
) {
  const mockData = USE_MOCK
    ? getMockPreviousDeparture(stopGtfsId, routeShortName, beforeTime)
    : null;
  const canFetch = !!stopGtfsId && !!routeShortName && !!beforeTime;
  const stableBefore = beforeTime ? roundToMinute(beforeTime) : undefined;
  const url = canFetch && !USE_MOCK
    ? `/api/previous-departure?stopGtfsId=${encodeURIComponent(stopGtfsId)}&route=${encodeURIComponent(routeShortName)}&before=${encodeURIComponent(stableBefore!)}`
    : null;

  const { data } = useSWR<PreviousDepartureResponse>(url, fetcher, {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    dedupingInterval: 5 * 60 * 1000,
    keepPreviousData: true,
  });

  return {
    scheduledTime: mockData?.scheduledTime ?? data?.scheduledTime ?? null,
    realtimeTime: mockData?.realtimeTime ?? data?.realtimeTime,
  };
}
