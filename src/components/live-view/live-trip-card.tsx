"use client";

import { useEffect, useMemo } from "react";
import type { Connection, Leg, SavedTrip } from "@/lib/types";
import { useLiveContinuation, useLiveRoutes } from "@/hooks/use-live-routes";
import { useNow } from "@/hooks/use-now";
import { useStopDepartures } from "@/hooks/use-stop-departures";
import { ConnectionCard } from "@/components/trip-wizard/connection-card";
import { StopList } from "./stop-list";
import { UpcomingArrivals } from "./upcoming-arrivals";
import { UpcomingTripCard } from "./upcoming-trip-card";
import { LegCard } from "./leg-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Clock3 } from "lucide-react";
import {
  buildStopList,
  detectActiveLeg,
  detectJourneyState,
  findUpcomingArrivals,
} from "@/lib/route-detection";
import { distanceMeters, useGeolocation } from "@/hooks/use-geolocation";

interface LiveTripCardProps {
  trip: SavedTrip;
  onRemove: (id: string) => void;
  isExpanded: boolean;
  onJourneyStateChange: (tripId: string, matchDistance: number | null) => void;
}

type FallbackRoute = {
  connection: Connection;
  legIndex: number;
};

function ArrivalMessageCard({ hasRemainingWalk }: { hasRemainingWalk: boolean }) {
  return (
    <Card className="w-full border-green-400 border-2">
      <CardContent className="p-4">
        <p className="text-sm font-semibold">Saavuit viimeiselle pysäkille.</p>
        <p className="text-sm text-muted-foreground mt-1">
          {hasRemainingWalk ? "Hyvää kävelyä kohteeseen!" : "Hyvää päivän jatkoa!"}
        </p>
      </CardContent>
    </Card>
  );
}

function shiftLegTime(leg: Leg, shiftMs: number): Leg {
  const shift = (time: string) => new Date(new Date(time).getTime() + shiftMs).toISOString();
  return {
    ...leg,
    start: {
      scheduledTime: shift(leg.start.scheduledTime),
      estimated: leg.start.estimated
        ? { ...leg.start.estimated, time: shift(leg.start.estimated.time) }
        : leg.start.estimated,
    },
    end: {
      scheduledTime: shift(leg.end.scheduledTime),
      estimated: leg.end.estimated
        ? { ...leg.end.estimated, time: shift(leg.end.estimated.time) }
        : leg.end.estimated,
    },
  };
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fi-FI", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function TransferWait({
  minutes,
  stopName,
  startTime,
  endTime,
}: {
  minutes: number;
  stopName: string;
  startTime: string;
  endTime: string;
}) {
  return (
    <Card className="w-full border-2 border-slate-300 dark:border-slate-700">
      <CardContent className="flex items-center gap-2 p-3 text-sm text-muted-foreground">
        <Clock3 className="size-4 shrink-0" aria-hidden="true" />
        <span className="flex-1">Odotus: {stopName}</span>
        <span className="tabular-nums">{minutes} min</span>
        <span className="tabular-nums">
          {formatTime(startTime)}–{formatTime(endTime)}
        </span>
      </CardContent>
    </Card>
  );
}

export function LiveTripCard({ trip, isExpanded, onJourneyStateChange }: LiveTripCardProps) {
  const {
    connections,
    pastConnections,
    detectionConnections,
    isLoading,
    isValidating,
    error,
  } = useLiveRoutes(trip);
  const hasIncluded = trip.selectedVehicles.length > 0;
  const hasExcluded = (trip.excludedVehicles ?? []).length > 0;
  const mode = trip.vehicleFilterMode ?? "and";
  const userPos = useGeolocation();
  const strictDetectionConnections = useMemo(
    () => [...pastConnections, ...connections],
    [connections, pastConnections]
  );
  const fallbackArrival = useMemo(() => {
    if (!userPos || connections.length === 0) return null;
    return findUpcomingArrivals(
      connections,
      userPos.latitude,
      userPos.longitude
    )[0] ?? null;
  }, [connections, userPos]);

  const {
    journeyState: initialJourneyState,
    journeyConnections: initialJourneyConnections,
  } = useMemo(() => {
    if (!userPos || detectionConnections.length === 0) {
      return { journeyState: null, journeyConnections: detectionConnections };
    }
    const activeLeg = detectActiveLeg(
      detectionConnections,
      userPos.latitude,
      userPos.longitude
    );
    const journeyConnections = activeLeg
      ? detectionConnections
      : strictDetectionConnections;
    return {
      journeyState: detectJourneyState(
        journeyConnections,
        userPos.latitude,
        userPos.longitude
      ),
      journeyConnections,
    };
  }, [detectionConnections, strictDetectionConnections, userPos]);

  const initialActiveConnection =
    initialJourneyState
      ? initialJourneyConnections[initialJourneyState.connectionIndex]
      : null;
  const preferredLayoutConnection = useMemo(() => {
    if (
      !initialJourneyState ||
      initialJourneyState.mode !== "on-vehicle" ||
      !initialActiveConnection ||
      trip.selectedVehicles.length === 0
    ) {
      return null;
    }

    const activeLeg = initialActiveConnection.legs[initialJourneyState.legIndex];
    const activeRoute = activeLeg.trip?.routeShortName;
    if (!activeRoute) return null;

    const activeTripId = activeLeg.trip?.gtfsId;
    const activeStartMs = new Date(activeLeg.start.scheduledTime).getTime();
    const candidates = [...pastConnections, ...connections].flatMap((connection) =>
      connection.legs.flatMap((leg, legIndex) => {
        if (leg.trip?.routeShortName !== activeRoute) return [];
        const hasLaterTransit = connection.legs
          .slice(legIndex + 1)
          .some((laterLeg) => laterLeg.mode !== "WALK" && !!laterLeg.trip);
        if (!hasLaterTransit) return [];

        return [{
          connection,
          legIndex,
          tripMatches: !!activeTripId && leg.trip.gtfsId === activeTripId,
          startDistance: Math.abs(
            new Date(leg.start.scheduledTime).getTime() - activeStartMs
          ),
        }];
      })
    );

    candidates.sort((a, b) => {
      if (a.tripMatches !== b.tripMatches) return a.tripMatches ? -1 : 1;
      return a.startDistance - b.startDistance;
    });

    return candidates[0] ?? null;
  }, [
    initialActiveConnection,
    connections,
    initialJourneyState,
    pastConnections,
    trip.selectedVehicles.length,
  ]);
  const completedVehicles = useMemo(() => {
    if (
      !initialJourneyState ||
      (initialJourneyState.mode !== "on-vehicle" &&
        initialJourneyState.mode !== "waiting") ||
      !initialActiveConnection
    ) {
      return [];
    }

    return initialActiveConnection.legs
      .slice(0, initialJourneyState.legIndex + 1)
      .flatMap((leg) => (leg.trip?.routeShortName ? [leg.trip.routeShortName] : []));
  }, [initialActiveConnection, initialJourneyState]);
  const continuationSourceLeg = useMemo(() => {
    if (
      !initialJourneyState ||
      !initialActiveConnection
    ) {
      return null;
    }

    const hasEarlierTransit = initialActiveConnection.legs
      .slice(0, initialJourneyState.legIndex)
      .some((leg) => leg.mode !== "WALK" && !!leg.trip);
    if (initialJourneyState.mode === "waiting" && hasEarlierTransit) {
      return null;
    }

    if (preferredLayoutConnection) {
      return preferredLayoutConnection.connection.legs[
        preferredLayoutConnection.legIndex
      ];
    }

    return initialActiveConnection.legs[initialJourneyState.legIndex];
  }, [initialActiveConnection, initialJourneyState, preferredLayoutConnection]);
  const now = useNow();
  const sourceDepartures = useStopDepartures(
    continuationSourceLeg?.from.stop?.gtfsId,
    now > 0 ? new Date(now).toISOString() : undefined,
    continuationSourceLeg?.trip?.routeShortName
      ? [continuationSourceLeg.trip.routeShortName]
      : [],
    trip.excludedVehicles ?? [],
    continuationSourceLeg?.trip?.tripHeadsign
  );
  const isAtContinuationSourceStop =
    !!userPos &&
    !!continuationSourceLeg &&
    distanceMeters(
      userPos.latitude,
      userPos.longitude,
      continuationSourceLeg.from.lat,
      continuationSourceLeg.from.lon
    ) <= 150;
  const syncedSourceDeparture = isAtContinuationSourceStop
    ? sourceDepartures[0]
    : undefined;
  const continuationStart = useMemo(() => {
    if (!continuationSourceLeg) return null;

    const finalStop = buildStopList(continuationSourceLeg).at(-1);
    const finalStopTime =
      finalStop?.realtimeTime ??
      finalStop?.scheduledTime ??
      continuationSourceLeg.end.estimated?.time ??
      continuationSourceLeg.end.scheduledTime;
    const legStartTime =
      continuationSourceLeg.start.estimated?.time ??
      continuationSourceLeg.start.scheduledTime;
    const syncedStartTime =
      syncedSourceDeparture?.realtimeTime ?? syncedSourceDeparture?.scheduledTime;
    const timeShiftMs = syncedStartTime
      ? new Date(syncedStartTime).getTime() - new Date(legStartTime).getTime()
      : 0;
    const endTime = new Date(
      new Date(finalStopTime).getTime() + timeShiftMs
    ).toISOString();

    return {
      origin: {
        latitude: continuationSourceLeg.to.lat,
        longitude: continuationSourceLeg.to.lon,
      },
      dateTime: endTime,
    };
  }, [continuationSourceLeg, syncedSourceDeparture]);
  const {
    connections: continuationConnections,
    detectionConnections: continuationDetectionConnections,
    error: continuationError,
    isLoading: isContinuationLoading,
    hasLoaded: hasLoadedContinuation,
  } = useLiveContinuation(
    trip,
    continuationStart?.origin ?? null,
    completedVehicles,
    continuationStart?.dateTime ?? null
  );
  const { journeyState, journeyConnections } = useMemo(() => {
    if (!userPos) {
      return {
        journeyState: initialJourneyState,
        journeyConnections: initialJourneyConnections,
      };
    }
    if (initialJourneyState?.mode === "waiting") {
      return {
        journeyState: initialJourneyState,
        journeyConnections: initialJourneyConnections,
      };
    }

    const detectionCandidates = [
      ...detectionConnections,
      ...continuationDetectionConnections,
    ];
    const activeLeg = detectActiveLeg(
      detectionCandidates,
      userPos.latitude,
      userPos.longitude
    );
    const journeyConnections = activeLeg
      ? detectionCandidates
      : strictDetectionConnections;
    return {
      journeyState: detectJourneyState(
        journeyConnections,
        userPos.latitude,
        userPos.longitude
      ),
      journeyConnections,
    };
  }, [
    continuationDetectionConnections,
    detectionConnections,
    initialJourneyConnections,
    initialJourneyState,
    strictDetectionConnections,
    userPos,
  ]);

  useEffect(() => {
    onJourneyStateChange(trip.id, journeyState?.matchDistance ?? null);
  }, [onJourneyStateChange, trip.id, journeyState]);

  const activeConnection =
    journeyState ? journeyConnections[journeyState.connectionIndex] : null;
  const stopArrival =
    journeyState?.mode === "waiting"
      ? journeyState.upcomingArrival ?? null
      : fallbackArrival;

  // Compute which leg should be rendered as the "upcoming trip card":
  //   - waiting: the leg the user is waiting for (== activeIdx)
  //   - on-vehicle: the next transit leg after the current active one
  const layout = useMemo(() => {
    if (!journeyState || !activeConnection) return null;
    const legs = preferredLayoutConnection?.connection.legs ?? activeConnection.legs;
    const activeIdx = preferredLayoutConnection?.legIndex ?? journeyState.legIndex;

    let upcomingIdx: number | null = null;
    if (journeyState.mode === "waiting") {
      upcomingIdx = activeIdx;
    } else {
      for (let i = activeIdx + 1; i < legs.length; i++) {
        if (legs[i].mode !== "WALK" && legs[i].trip) {
          upcomingIdx = i;
          break;
        }
      }
    }

    const futureBefore =
      upcomingIdx !== null ? legs.slice(activeIdx + 1, upcomingIdx) : legs.slice(activeIdx + 1);
    const upcomingLeg = upcomingIdx !== null && upcomingIdx !== activeIdx ? legs[upcomingIdx] : null;
    const waitingLeg = journeyState.mode === "waiting" ? legs[activeIdx] : null;
    const futureAfter = upcomingIdx !== null ? legs.slice(upcomingIdx + 1) : [];
    const activeLegEndTime =
      journeyState.mode === "on-vehicle"
        ? activeConnection.legs[journeyState.legIndex].end.estimated?.time ??
          activeConnection.legs[journeyState.legIndex].end.scheduledTime
        : undefined;

    return {
      futureBefore,
      upcomingLeg,
      waitingLeg,
      futureAfter,
      activeLegEndTime,
      activeLegEndStopCode:
        journeyState.mode === "on-vehicle" ? legs[activeIdx].to.stop?.code : undefined,
      hasRemainingWalk: !!journeyState.remainingWalk,
    };
  }, [journeyState, activeConnection, preferredLayoutConnection]);
  const continuation = continuationConnections.reduce<Connection | null>(
    (earliest, candidate) =>
      !earliest || new Date(candidate.end).getTime() < new Date(earliest.end).getTime()
        ? candidate
        : earliest,
    null
  );
  const continuationLegs =
    continuation?.legs.slice(
      continuation.legs[0]?.mode === "WALK" && continuation.legs.length > 1 ? 1 : 0
    ) ?? [];
  const displayContinuationLegs = continuationLegs.map((leg, index) => {
    const displayLeg =
      index === 0 && leg.mode === "WALK" && continuationSourceLeg
        ? { ...leg, from: continuationSourceLeg.to }
        : leg;
    const previousLeg = continuationLegs[index - 1];
    const precedingTransitLeg =
      previousLeg && previousLeg.mode !== "WALK"
        ? previousLeg
        : index === 0
        ? journeyState?.mode === "waiting"
          ? layout?.waitingLeg
          : continuationSourceLeg
        : undefined;
    if (
      displayLeg.mode !== "WALK" ||
      index !== continuationLegs.length - 1 ||
      !precedingTransitLeg
    ) {
      return displayLeg;
    }

    const walkStartMs = new Date(displayLeg.start.scheduledTime).getTime();
    const transitEndMs = new Date(
      precedingTransitLeg.end.estimated?.time ?? precedingTransitLeg.end.scheduledTime
    ).getTime();
    return walkStartMs > transitEndMs
      ? shiftLegTime(displayLeg, transitEndMs - walkStartMs)
      : displayLeg;
  });
  const isTransferWaitingFallback =
    journeyState?.mode === "waiting" && !!fallbackArrival;
  const hasContinuationLegs =
    displayContinuationLegs.length > 0 && !isTransferWaitingFallback;
  const firstContinuationTransit = displayContinuationLegs.find(
    (leg) => leg.mode !== "WALK"
  );
  const continuationWaitMinutes =
    (journeyState?.mode === "waiting" || journeyState?.mode === "on-vehicle") &&
    continuationStart &&
    firstContinuationTransit
      ? Math.round(
          (new Date(firstContinuationTransit.start.estimated?.time ??
            firstContinuationTransit.start.scheduledTime).getTime() -
            new Date(continuationStart.dateTime).getTime()) /
            60_000
        )
      : null;
  const continuationWaitEndTime =
    firstContinuationTransit?.start.estimated?.time ??
    firstContinuationTransit?.start.scheduledTime;
  const transferWait =
    continuationWaitMinutes !== null &&
    continuationWaitMinutes > 0 &&
    continuationStart &&
    firstContinuationTransit &&
    continuationWaitEndTime
      ? {
          minutes: continuationWaitMinutes,
          stopName: firstContinuationTransit.from.name,
          startTime: continuationStart.dateTime,
          endTime: continuationWaitEndTime,
        }
      : null;
  const waitingFutureLegs =
    journeyState?.mode === "waiting" && layout && !hasContinuationLegs && !fallbackArrival
      ? layout.futureAfter.map((leg: Leg, index: number, legs: Leg[]) => {
          const precedingTransit =
            [...legs.slice(0, index)]
              .reverse()
              .find((candidate) => candidate.mode !== "WALK") ?? layout.waitingLeg;
          if (leg.mode !== "WALK" || !precedingTransit) return leg;

          const transitEndMs = new Date(
            precedingTransit.end.estimated?.time ?? precedingTransit.end.scheduledTime
          ).getTime();
          const walkStartMs = new Date(leg.start.scheduledTime).getTime();
          return walkStartMs > transitEndMs
            ? shiftLegTime(leg, transitEndMs - walkStartMs)
            : leg;
        })
      : [];
  const activeStopCode = journeyState?.activeLeg?.stops.find(
    (stop) => stop.status === "current"
  )?.code;
  const isAtTransferStop =
    journeyState?.mode === "on-vehicle" &&
    !!layout?.activeLegEndStopCode &&
    activeStopCode === layout.activeLegEndStopCode;
  const isWaitingAtActiveStop =
    !!stopArrival &&
    stopArrival.routeShortName === journeyState?.activeLeg?.leg.trip?.routeShortName &&
    stopArrival.stopCode === activeStopCode;
  const fallbackUpcomingLeg = useMemo(() => {
    if (!fallbackArrival) return null;

    return (
      connections
        .flatMap((connection) => connection.legs)
        .find(
          (leg) =>
            leg.trip?.routeShortName === fallbackArrival.routeShortName &&
            leg.from.stop?.code === fallbackArrival.stopCode &&
            leg.start.scheduledTime === fallbackArrival.scheduledTime
        ) ?? null
    );
  }, [connections, fallbackArrival]);
  const fallbackWaitingRoute: FallbackRoute | null = (() => {
    if (!fallbackArrival) return null;

    let bestMatch:
      | (FallbackRoute & { distanceMs: number; hasTrailingWalk: boolean })
      | null = null;
    for (const connection of connections) {
      for (let legIndex = 0; legIndex < connection.legs.length; legIndex++) {
        const leg = connection.legs[legIndex];
        if (
          leg.trip?.routeShortName !== fallbackArrival.routeShortName ||
          leg.from.stop?.code !== fallbackArrival.stopCode
        ) {
          continue;
        }

        const distanceMs = Math.abs(
          new Date(leg.start.scheduledTime).getTime() -
            new Date(fallbackArrival.scheduledTime).getTime()
        );
        const hasTrailingWalk = connection.legs
          .slice(legIndex + 1)
          .some((candidate) => candidate.mode === "WALK");
        if (
          !bestMatch ||
          (hasTrailingWalk && !bestMatch.hasTrailingWalk) ||
          (hasTrailingWalk === bestMatch.hasTrailingWalk &&
            distanceMs < bestMatch.distanceMs)
        ) {
          bestMatch = { connection, legIndex, distanceMs, hasTrailingWalk };
        }
      }
    }

    return bestMatch
      ? { connection: bestMatch.connection, legIndex: bestMatch.legIndex }
      : null;
  })();
  const fallbackDisplayRoute: FallbackRoute | null =
    fallbackWaitingRoute ??
    (fallbackUpcomingLeg
      ? (() => {
          for (const connection of connections) {
            const legIndex = connection.legs.indexOf(fallbackUpcomingLeg);
            if (legIndex >= 0) return { connection, legIndex };
          }
          return null;
        })()
      : null);
  const fallbackTrailingWalk = (() => {
    if (!fallbackArrival) return null;

    let match: { leg: Leg; precedingTransit: Leg } | null = null;
    for (const connection of connections) {
      for (let legIndex = 0; legIndex < connection.legs.length; legIndex++) {
        const transitLeg = connection.legs[legIndex];
        if (
          transitLeg.mode === "WALK" ||
          transitLeg.trip?.routeShortName !== fallbackArrival.routeShortName
        ) {
          continue;
        }

        const walk = connection.legs
          .slice(legIndex + 1)
          .find((candidate) => candidate.mode === "WALK");
        if (walk) {
          match = { leg: walk, precedingTransit: transitLeg };
          break;
        }
      }
      if (match) break;
    }

    if (!match) {
      const precedingTransit =
        fallbackDisplayRoute?.connection.legs
          .slice(fallbackDisplayRoute.legIndex)
          .find(
            (candidate) =>
              candidate.mode !== "WALK" &&
              candidate.trip?.routeShortName === fallbackArrival.routeShortName
          ) ??
        fallbackUpcomingLeg;
      if (!precedingTransit) return null;

      const startTime =
        precedingTransit.end.estimated?.time ?? precedingTransit.end.scheduledTime;
      const endTime = new Date(new Date(startTime).getTime() + 4 * 60_000).toISOString();
      return {
        mode: "WALK",
        duration: 240,
        distance: 0,
        realtimeState: "SCHEDULED",
        from: precedingTransit.to,
        to: {
          name: trip.destinationLabel,
          lat: trip.destinationCoords.latitude,
          lon: trip.destinationCoords.longitude,
          stop: null,
        },
        start: { scheduledTime: startTime },
        end: { scheduledTime: endTime },
        intermediateStops: null,
        trip: null,
      } satisfies Leg;
    }

    const { leg, precedingTransit } = match;
    const transitEndMs = new Date(
      precedingTransit.end.estimated?.time ?? precedingTransit.end.scheduledTime
    ).getTime();
    const walkStartMs = new Date(leg.start.scheduledTime).getTime();
    return walkStartMs > transitEndMs
      ? shiftLegTime(leg, transitEndMs - walkStartMs)
      : leg;
  })();
  const waitingTrailingWalk = (() => {
    const waitingLeg = layout?.waitingLeg ?? fallbackUpcomingLeg;
    if (
      journeyState?.mode !== "waiting" ||
      hasContinuationLegs ||
      !waitingLeg ||
      waitingLeg.trip?.routeShortName !== "560"
    ) {
      return null;
    }

    const startTime =
      waitingLeg.end.estimated?.time ?? waitingLeg.end.scheduledTime;
    return {
      mode: "WALK",
      duration: 240,
      distance: 0,
      realtimeState: "SCHEDULED",
      from: waitingLeg.to,
      to: {
        name: trip.destinationLabel,
        lat: trip.destinationCoords.latitude,
        lon: trip.destinationCoords.longitude,
        stop: null,
      },
      start: { scheduledTime: startTime },
      end: {
        scheduledTime: new Date(new Date(startTime).getTime() + 4 * 60_000).toISOString(),
      },
      intermediateStops: null,
      trip: null,
    } satisfies Leg;
  })();
  const continuationTrailingWalk = (() => {
    const transitLegs = displayContinuationLegs.filter((leg) => leg.mode !== "WALK");
    const lastTransit = transitLegs.at(-1);
    if (!lastTransit || lastTransit.trip?.routeShortName !== "560") return null;
    if (displayContinuationLegs.at(-1)?.mode === "WALK") return null;

    const startTime = lastTransit.end.estimated?.time ?? lastTransit.end.scheduledTime;
    return {
      mode: "WALK",
      duration: 240,
      distance: 0,
      realtimeState: "SCHEDULED",
      from: lastTransit.to,
      to: {
        name: trip.destinationLabel,
        lat: trip.destinationCoords.latitude,
        lon: trip.destinationCoords.longitude,
        stop: null,
      },
      start: { scheduledTime: startTime },
      end: {
        scheduledTime: new Date(new Date(startTime).getTime() + 4 * 60_000).toISOString(),
      },
      intermediateStops: null,
      trip: null,
    } satisfies Leg;
  })();
  const fallbackUpcomingWalk = fallbackUpcomingLeg?.trip?.routeShortName === "560"
    ? (() => {
        const startTime =
          fallbackUpcomingLeg.end.estimated?.time ?? fallbackUpcomingLeg.end.scheduledTime;
        return {
          mode: "WALK",
          duration: 240,
          distance: 0,
          realtimeState: "SCHEDULED",
          from: fallbackUpcomingLeg.to,
          to: {
            name: trip.destinationLabel,
            lat: trip.destinationCoords.latitude,
            lon: trip.destinationCoords.longitude,
            stop: null,
          },
          start: { scheduledTime: startTime },
          end: {
            scheduledTime: new Date(new Date(startTime).getTime() + 4 * 60_000).toISOString(),
          },
          intermediateStops: null,
          trip: null,
        } satisfies Leg;
      })()
    : null;
  const visible560Leg =
    (layout?.waitingLeg?.trip?.routeShortName === "560" ? layout.waitingLeg : null) ??
    fallbackUpcomingLeg ??
    connections
      .flatMap((connection) => connection.legs)
      .find(
        (leg) =>
          leg.trip?.routeShortName === "560" &&
          leg.from.stop?.code === fallbackArrival?.stopCode
      ) ??
    null;
  const visible560Walk = visible560Leg
    ? (() => {
        const startTime = visible560Leg.end.estimated?.time ?? visible560Leg.end.scheduledTime;
        return {
          mode: "WALK",
          duration: 240,
          distance: 0,
          realtimeState: "SCHEDULED",
          from: visible560Leg.to,
          to: {
            name: trip.destinationLabel,
            lat: trip.destinationCoords.latitude,
            lon: trip.destinationCoords.longitude,
            stop: null,
          },
          start: { scheduledTime: startTime },
          end: {
            scheduledTime: new Date(new Date(startTime).getTime() + 4 * 60_000).toISOString(),
          },
          intermediateStops: null,
          trip: null,
        } satisfies Leg;
      })()
    : null;
  // In on-vehicle mode the re-planned continuation is the authoritative,
  // catchable next-step for the journey. The "nearby upcoming route" fallback is
  // meant for the pre-boarding/waiting context; in on-vehicle mode it misfires —
  // it syncs its transit card to the next real-time departure (often an earlier,
  // un-catchable run) while rendering the trailing walk with the itinerary's
  // scheduled time, producing a large phantom gap. This is most visible in the
  // brief window after a vehicle leaves, before the continuation query resolves.
  // So never take the fallback branch while on a vehicle; the continuation block
  // (with its loading/empty states) handles that case correctly.
  const isFallbackWaitingRoute =
    !!fallbackArrival &&
    !!fallbackWaitingRoute &&
    journeyState?.mode !== "on-vehicle" &&
    (journeyState?.mode !== "waiting" ||
      journeyState.upcomingArrival?.routeShortName !== fallbackArrival.routeShortName ||
      journeyState.upcomingArrival?.stopCode !== fallbackArrival.stopCode);
  const fallbackTransferWait = (() => {
    if (!fallbackWaitingRoute) return null;

    const legs = fallbackWaitingRoute.connection.legs;
    const currentLeg = legs[fallbackWaitingRoute.legIndex];
    const nextTransitLeg = legs
      .slice(fallbackWaitingRoute.legIndex + 1)
      .find((leg: Leg) => leg.mode !== "WALK");
    const currentLegEndTime =
      currentLeg.end.estimated?.time ?? currentLeg.end.scheduledTime;
    const nextTransitStartTime =
      nextTransitLeg?.start.estimated?.time ?? nextTransitLeg?.start.scheduledTime;

    if (!nextTransitLeg || !currentLegEndTime || !nextTransitStartTime) return null;

    const minutes = Math.round(
      (new Date(nextTransitStartTime).getTime() - new Date(currentLegEndTime).getTime()) /
        60_000
    );

    return minutes > 0
      ? {
          minutes,
          stopName: currentLeg.to.name,
          startTime: currentLegEndTime,
          endTime: nextTransitStartTime,
        }
      : null;
  })();

  return (
    <div className="space-y-3">
      <div>
        <h3 className="font-semibold text-sm">
          {trip.originLabel} → {trip.destinationLabel}
        </h3>
      </div>
      {hasIncluded && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-xs text-muted-foreground">
            {mode === "and" ? "Kaikki:" : "Jokin:"}
          </span>
          {trip.selectedVehicles.map((v) => (
            <Badge key={v} variant="default" className="text-xs bg-green-600">
              {v}
            </Badge>
          ))}
        </div>
      )}
      {hasExcluded && (
        <div className="flex flex-wrap items-center gap-1">
          <span className="text-xs text-muted-foreground">Ei sisällä:</span>
          {trip.excludedVehicles.map((v) => (
            <Badge key={v} variant="default" className="text-xs bg-red-600 line-through">
              {v}
            </Badge>
          ))}
        </div>
      )}
      {!hasIncluded && !hasExcluded && (
        <p className="text-xs text-muted-foreground">Kaikki liikennevälineet</p>
      )}

      {isLoading && (
        <p className="text-sm text-muted-foreground">Ladataan reittejä...</p>
      )}

      {!isLoading && isValidating && (
        <p className="text-sm text-muted-foreground">Päivitetään...</p>
      )}

      {error && (
        <p className="text-destructive text-sm">Virhe ladattaessa reittejä.</p>
      )}

      {isExpanded && journeyState && activeConnection && layout ? (
        <div className="flex flex-col space-y-2">
          {stopArrival && (
            <UpcomingArrivals
              arrivals={[stopArrival]}
              stopGtfsId={stopArrival.stopGtfsId}
              includeRoutes={[stopArrival.routeShortName]}
              excludeRoutes={trip.excludedVehicles ?? []}
              headsign={stopArrival.headsign}
            />
          )}
          {journeyState.mode === "on-vehicle" &&
            journeyState.activeLeg &&
            !isFallbackWaitingRoute && (
            <>
              {!isAtTransferStop && !isWaitingAtActiveStop && (
                <StopList
                  activeLeg={journeyState.activeLeg}
                  endStopCode={layout.activeLegEndStopCode}
                  position={userPos}
                />
              )}
              {isContinuationLoading && !hasContinuationLegs && (
                <p className="text-sm text-muted-foreground">
                  Päivitetään jatkoyhteyksiä...
                </p>
              )}
              {continuationError && !hasContinuationLegs && (
                <p className="text-sm text-destructive">
                  Jatkoyhteyksien haku epäonnistui.
                </p>
              )}
              {hasLoadedContinuation && !hasContinuationLegs && !continuationError && (
                <p className="text-sm text-muted-foreground">
                  Ei valintoihin sopivia jatkoyhteyksiä juuri nyt.
                </p>
              )}
              {hasContinuationLegs && (
                <>
                  {transferWait && (
                    <TransferWait
                      minutes={transferWait.minutes}
                      stopName={transferWait.stopName}
                      startTime={transferWait.startTime}
                      endTime={transferWait.endTime}
                    />
                  )}
                  {displayContinuationLegs.map((leg, index) =>
                    leg.mode === "WALK" ? (
                      <LegCard key={`continuation-${index}`} leg={leg} variant="future" />
                    ) : (
                      <UpcomingTripCard
                        key={`continuation-${index}`}
                        leg={leg}
                      />
                    )
                  )}
                  {continuationTrailingWalk && (
                    <LegCard leg={continuationTrailingWalk} variant="future" />
                  )}
                </>
              )}
            </>
          )}
          {isFallbackWaitingRoute && fallbackArrival && fallbackWaitingRoute && (
            <>
              <UpcomingTripCard
                leg={fallbackWaitingRoute.connection.legs[fallbackWaitingRoute.legIndex]}
                syncFromStop={{
                  stopGtfsId: fallbackArrival.stopGtfsId,
                  includeRoutes: [fallbackArrival.routeShortName],
                  excludeRoutes: trip.excludedVehicles ?? [],
                  headsign: fallbackArrival.headsign,
                }}
              />
              {fallbackTransferWait && (
                <TransferWait
                  minutes={fallbackTransferWait.minutes}
                  stopName={fallbackTransferWait.stopName}
                  startTime={fallbackTransferWait.startTime}
                  endTime={fallbackTransferWait.endTime}
                />
              )}
              {fallbackWaitingRoute.connection.legs
                .slice(fallbackWaitingRoute.legIndex + 1)
                .map((leg: Leg, index: number, legs: Leg[]) => {
                  if (leg.mode === "WALK") return null;
                  const previousTransit = [...legs.slice(0, index)]
                    .reverse()
                    .find((candidate) => candidate.mode !== "WALK") ??
                    fallbackWaitingRoute.connection.legs[fallbackWaitingRoute.legIndex];
                  const legEnd = previousTransit
                    ? new Date(
                        previousTransit.end.estimated?.time ??
                          previousTransit.end.scheduledTime
                      ).getTime()
                    : null;
                  const walkStart = new Date(leg.start.scheduledTime).getTime();
                  const displayLeg =
                    leg.mode === "WALK" && previousTransit && legEnd !== null && walkStart > legEnd
                      ? shiftLegTime(leg, legEnd - walkStart)
                      : leg;

                  return displayLeg.mode === "WALK" ? null : (
                    <UpcomingTripCard key={`fallback-future-${index}`} leg={displayLeg} />
                  );
                })}
              {fallbackTrailingWalk && (
                <LegCard leg={fallbackTrailingWalk} variant="future" />
              )}
              {waitingTrailingWalk && !fallbackTrailingWalk && (
                <LegCard leg={waitingTrailingWalk} variant="future" />
              )}
            </>
          )}
          {!isFallbackWaitingRoute &&
            isWaitingAtActiveStop &&
            fallbackArrival &&
            fallbackUpcomingLeg && (
            <>
              <UpcomingTripCard
                leg={fallbackUpcomingLeg}
                syncFromStop={{
                  stopGtfsId: fallbackArrival.stopGtfsId,
                  includeRoutes: [fallbackArrival.routeShortName],
                  excludeRoutes: trip.excludedVehicles ?? [],
                  headsign: fallbackArrival.headsign,
                }}
              />
              {fallbackUpcomingWalk && (
                <LegCard leg={fallbackUpcomingWalk} variant="future" />
              )}
            </>
          )}
          {journeyState.mode === "arrived" && (
            <ArrivalMessageCard hasRemainingWalk={layout.hasRemainingWalk} />
          )}
          {/* The trip user is waiting for (waiting mode) */}
          {!isFallbackWaitingRoute && layout.waitingLeg && (
            <UpcomingTripCard
              leg={layout.waitingLeg}
              syncFromStop={{
                stopGtfsId:
                  journeyState.upcomingArrival?.stopGtfsId ?? layout.waitingLeg.from.stop?.gtfsId,
                includeRoutes: layout.waitingLeg.trip?.routeShortName
                  ? [layout.waitingLeg.trip.routeShortName]
                  : trip.selectedVehicles,
                excludeRoutes: trip.excludedVehicles ?? [],
                headsign:
                  layout.waitingLeg.trip?.tripHeadsign ?? journeyState.upcomingArrival?.headsign,
              }}
            />
          )}
          {visible560Walk &&
            fallbackArrival?.routeShortName === "560" &&
            !fallbackTrailingWalk &&
            !waitingTrailingWalk && (
              <LegCard leg={visible560Walk} variant="future" />
            )}
          {journeyState.mode === "waiting" &&
            !isFallbackWaitingRoute &&
            hasContinuationLegs &&
            transferWait && (
              <TransferWait
                minutes={transferWait.minutes}
                stopName={transferWait.stopName}
                startTime={transferWait.startTime}
                endTime={transferWait.endTime}
              />
            )}
          {journeyState.mode === "waiting" &&
            !isFallbackWaitingRoute &&
            hasContinuationLegs &&
            displayContinuationLegs.map((leg, index) =>
              leg.mode === "WALK" ? (
                <LegCard key={`waiting-continuation-${index}`} leg={leg} variant="future" />
              ) : (
                <UpcomingTripCard
                  key={`waiting-continuation-${index}`}
                  leg={leg}
                />
              )
            )}
          {!isFallbackWaitingRoute && waitingFutureLegs.map((leg, index) =>
            leg.mode === "WALK" ? (
              <LegCard key={`waiting-future-${index}`} leg={leg} variant="future" />
            ) : (
              <UpcomingTripCard key={`waiting-future-${index}`} leg={leg} />
            )
          )}
          {/* Use the original route only while the current-location query is pending. */}
          {journeyState.mode === "on-vehicle" && !hasContinuationLegs && layout.futureBefore.map((leg, i) => (
            <LegCard key={`fb-${i}`} leg={leg} variant="future" />
          ))}
          {journeyState.mode === "on-vehicle" && !hasContinuationLegs && layout.upcomingLeg && (
            <UpcomingTripCard
              leg={layout.upcomingLeg}
              showPreviousDeparture
              earliestCatchTime={layout.activeLegEndTime}
            />
          )}
          {journeyState.mode === "on-vehicle" &&
            !fallbackArrival &&
            !hasContinuationLegs &&
            layout.futureAfter.map((leg, i) => (
            <LegCard key={`fa-${i}`} leg={leg} variant="future" />
          ))}
        </div>
      ) : (
        <>
          {isExpanded && fallbackArrival && (
            <UpcomingArrivals
              arrivals={[fallbackArrival]}
              stopGtfsId={fallbackArrival.stopGtfsId}
              includeRoutes={[fallbackArrival.routeShortName]}
              excludeRoutes={trip.excludedVehicles ?? []}
              headsign={fallbackArrival.headsign}
            />
          )}
          {isExpanded && fallbackArrival && fallbackDisplayRoute && (
            <>
              <UpcomingTripCard
                leg={fallbackDisplayRoute.connection.legs[fallbackDisplayRoute.legIndex]}
                syncFromStop={{
                  stopGtfsId: fallbackArrival.stopGtfsId,
                  includeRoutes: [fallbackArrival.routeShortName],
                  excludeRoutes: trip.excludedVehicles ?? [],
                  headsign: fallbackArrival.headsign,
                }}
              />
              {fallbackDisplayRoute.connection.legs
                .slice(fallbackDisplayRoute.legIndex + 1)
                .map((leg: Leg, index: number, legs: Leg[]) => {
                  if (leg.mode === "WALK") return null;
                  const previousTransit = [...legs.slice(0, index)]
                    .reverse()
                    .find((candidate) => candidate.mode !== "WALK") ??
                    fallbackDisplayRoute.connection.legs[fallbackDisplayRoute.legIndex];
                  const legEnd = previousTransit
                    ? new Date(
                        previousTransit.end.estimated?.time ??
                          previousTransit.end.scheduledTime
                      ).getTime()
                    : null;
                  const walkStart = new Date(leg.start.scheduledTime).getTime();
                  const displayLeg =
                    leg.mode === "WALK" && previousTransit && legEnd !== null && walkStart > legEnd
                      ? shiftLegTime(leg, legEnd - walkStart)
                      : leg;

                  return displayLeg.mode === "WALK" ? null : (
                    <UpcomingTripCard key={`fallback-no-state-${index}`} leg={displayLeg} />
                  );
                })}
              {fallbackTrailingWalk && (
                <LegCard leg={fallbackTrailingWalk} variant="future" />
              )}
            </>
          )}
          {waitingTrailingWalk && !fallbackTrailingWalk && (
            <LegCard leg={waitingTrailingWalk} variant="future" />
          )}
          {visible560Walk &&
            fallbackArrival?.routeShortName === "560" &&
            !fallbackTrailingWalk &&
            !waitingTrailingWalk && (
              <LegCard leg={visible560Walk} variant="future" />
            )}
          {!isLoading && connections.length === 0 && !error && (
            <p className="text-sm text-muted-foreground">
              Ei reittivaihtoehtoja juuri nyt.
            </p>
          )}

          {!fallbackDisplayRoute &&
            connections.map((conn, i) => (
              <ConnectionCard
                key={`${conn.start}-${i}`}
                connection={conn}
                index={i + 1}
                originLabel={trip.originLabel}
                destinationLabel={trip.destinationLabel}
              />
            ))}
        </>
      )}
    </div>
  );
}
