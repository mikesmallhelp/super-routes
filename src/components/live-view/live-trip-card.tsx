"use client";

import { useEffect, useMemo } from "react";
import type { SavedTrip } from "@/lib/types";
import { useLiveContinuation, useLiveRoutes } from "@/hooks/use-live-routes";
import { ConnectionCard } from "@/components/trip-wizard/connection-card";
import { StopList } from "./stop-list";
import { UpcomingArrivals } from "./upcoming-arrivals";
import { UpcomingTripCard } from "./upcoming-trip-card";
import { LegCard } from "./leg-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  detectActiveLeg,
  detectJourneyState,
  findUpcomingArrivals,
} from "@/lib/route-detection";
import { useGeolocation } from "@/hooks/use-geolocation";

interface LiveTripCardProps {
  trip: SavedTrip;
  onRemove: (id: string) => void;
  isExpanded: boolean;
  onJourneyStateChange: (tripId: string, matchDistance: number | null) => void;
}

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
      initialJourneyState.mode !== "on-vehicle" ||
      !initialActiveConnection
    ) {
      return [];
    }

    return initialActiveConnection.legs
      .slice(0, initialJourneyState.legIndex + 1)
      .flatMap((leg) => (leg.trip?.routeShortName ? [leg.trip.routeShortName] : []));
  }, [initialActiveConnection, initialJourneyState]);
  const continuationStart = useMemo(() => {
    if (
      !initialJourneyState ||
      initialJourneyState.mode !== "on-vehicle" ||
      !initialActiveConnection
    ) {
      return null;
    }

    const activeLeg =
      preferredLayoutConnection?.connection.legs[preferredLayoutConnection.legIndex] ??
      initialActiveConnection.legs[initialJourneyState.legIndex];
    return {
      origin: {
        latitude: activeLeg.to.lat,
        longitude: activeLeg.to.lon,
      },
      dateTime: activeLeg.end.estimated?.time ?? activeLeg.end.scheduledTime,
    };
  }, [initialActiveConnection, initialJourneyState, preferredLayoutConnection]);
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
  const continuation = continuationConnections[0] ?? null;
  const waitingFutureLegs =
    journeyState?.mode === "waiting" && layout
      ? layout.futureAfter.slice(layout.futureAfter[0]?.mode === "WALK" ? 1 : 0)
      : [];
  const continuationLegs =
    continuation?.legs.slice(
      continuation.legs[0]?.mode === "WALK" && continuation.legs.length > 1 ? 1 : 0
    ) ?? [];
  const hasContinuationTransit = continuationLegs.some((leg) => leg.mode !== "WALK");

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
        <div className="space-y-2">
          {journeyState.mode === "on-vehicle" && journeyState.activeLeg && (
            <>
              <StopList
                activeLeg={journeyState.activeLeg}
                endStopCode={layout.activeLegEndStopCode}
                position={userPos}
              />
              {isContinuationLoading && !hasContinuationTransit && (
                <p className="text-sm text-muted-foreground">
                  Päivitetään jatkoyhteyksiä...
                </p>
              )}
              {continuationError && !hasContinuationTransit && (
                <p className="text-sm text-destructive">
                  Jatkoyhteyksien haku epäonnistui.
                </p>
              )}
              {hasLoadedContinuation && !hasContinuationTransit && !continuationError && (
                <p className="text-sm text-muted-foreground">
                  Ei valintoihin sopivia jatkoyhteyksiä juuri nyt.
                </p>
              )}
              {hasContinuationTransit && (
                <>
                  {continuationLegs.map((leg, index) =>
                    leg.mode === "WALK" ? (
                      <LegCard key={`continuation-${index}`} leg={leg} variant="future" />
                    ) : (
                      <UpcomingTripCard key={`continuation-${index}`} leg={leg} />
                    )
                  )}
                </>
              )}
            </>
          )}
          {journeyState.mode === "arrived" && (
            <ArrivalMessageCard hasRemainingWalk={layout.hasRemainingWalk} />
          )}
          {stopArrival && (
            <UpcomingArrivals
              arrivals={[stopArrival]}
              stopGtfsId={stopArrival.stopGtfsId}
              includeRoutes={[stopArrival.routeShortName]}
              excludeRoutes={trip.excludedVehicles ?? []}
              headsign={stopArrival.headsign}
            />
          )}

          {/* The trip user is waiting for (waiting mode) */}
          {layout.waitingLeg && (
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
          {waitingFutureLegs.map((leg, index) =>
            leg.mode === "WALK" ? (
              <LegCard key={`waiting-future-${index}`} leg={leg} variant="future" />
            ) : (
              <UpcomingTripCard key={`waiting-future-${index}`} leg={leg} />
            )
          )}

          {/* Use the original route only while the current-location query is pending. */}
          {journeyState.mode === "on-vehicle" && !hasContinuationTransit && layout.futureBefore.map((leg, i) => (
            <LegCard key={`fb-${i}`} leg={leg} variant="future" />
          ))}
          {journeyState.mode === "on-vehicle" && !hasContinuationTransit && layout.upcomingLeg && (
            <UpcomingTripCard
              leg={layout.upcomingLeg}
              showPreviousDeparture
              earliestCatchTime={layout.activeLegEndTime}
            />
          )}
          {journeyState.mode === "on-vehicle" && !hasContinuationTransit && layout.futureAfter.map((leg, i) => (
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
          {!isLoading && connections.length === 0 && !error && (
            <p className="text-sm text-muted-foreground">
              Ei reittivaihtoehtoja juuri nyt.
            </p>
          )}

          {connections.map((conn, i) => (
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
