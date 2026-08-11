import type { Exercise } from "../core/model.js";
import { assignedHandForCode } from "../motor/keyboard-geometry.js";
import type { InteractionTraceV2 } from "../practice/interaction-session-v2.js";
import { compileExerciseInputPlan } from "../practice/input-plan.js";
import type {
  BoundaryClass,
  CoordinationHandShape,
  ExplicitHand,
  MeasurementObservationsV2,
} from "./types.js";

function explicitHand(code: string): ExplicitHand | null {
  const hand = assignedHandForCode(code);
  return hand === "left" || hand === "right" ? hand : null;
}

function otherHand(hand: ExplicitHand): ExplicitHand {
  return hand === "left" ? "right" : "left";
}

function boundaryBetween(
  previous: InteractionTraceV2,
  current: InteractionTraceV2,
): BoundaryClass {
  if (previous.entryIndex !== current.entryIndex) return "entry-boundary";
  if (previous.syllableOrdinal !== current.syllableOrdinal) return "syllable-boundary";
  return "within-syllable";
}

function coordinationHandShape(events: readonly InteractionTraceV2[]): CoordinationHandShape {
  const hands = events.map((trace) => explicitHand(trace.physicalCode));
  if (hands.some((hand) => hand === null)) return "unknown";
  const hasLeft = hands.includes("left");
  const hasRight = hands.includes("right");
  if (hasLeft && hasRight) return "mixed";
  if (hasLeft) return "left-only";
  if (hasRight) return "right-only";
  return "unknown";
}

function isAccepted(trace: InteractionTraceV2): boolean {
  return trace.outcome === "accepted-component" || trace.outcome === "accepted-tone";
}

function validMotorTimingContext(trace: InteractionTraceV2): boolean {
  return trace.context === "within-syllable" || trace.context === "tone";
}

export function deriveMeasurementObservationsV2(
  exercise: Exercise,
  traces: readonly InteractionTraceV2[],
): MeasurementObservationsV2 {
  const plan = compileExerciseInputPlan(exercise);
  const expectedBodySize = new Map(
    plan.syllables.map((syllable) => [syllable.ordinal, syllable.bodySlots.length]),
  );

  const bindings: MeasurementObservationsV2["bindings"][number][] = [];
  const confusions: MeasurementObservationsV2["confusions"][number][] = [];
  const coordination: MeasurementObservationsV2["coordination"][number][] = [];
  const immediateHands: MeasurementObservationsV2["immediateHands"][number][] = [];
  const sameHandRevisits: MeasurementObservationsV2["sameHandRevisits"][number][] = [];
  const toneCommits: MeasurementObservationsV2["toneCommits"][number][] = [];

  let ambiguousErrorCount = 0;
  let duplicateComponentCount = 0;
  let prematureToneCount = 0;
  let noiseSinceAccepted = false;
  let previousAccepted: InteractionTraceV2 | null = null;

  const previousByHand: Record<ExplicitHand, InteractionTraceV2 | null> = {
    left: null,
    right: null,
  };
  const dirtyByHand: Record<ExplicitHand, boolean> = {
    left: false,
    right: false,
  };
  const oppositeEventsSince: Record<ExplicitHand, number> = {
    left: 0,
    right: 0,
  };
  const bodyEvents = new Map<number, InteractionTraceV2[]>();
  const dirtyCoordination = new Set<number>();

  for (const trace of traces) {
    if (trace.exerciseId !== exercise.id) {
      throw new Error(
        `trace ${trace.sequence} belongs to exercise ${trace.exerciseId}, expected ${exercise.id}`,
      );
    }

    if (trace.matchedToken !== null) {
      bindings.push({
        traceSequence: trace.sequence,
        scope: {
          mode: exercise.mode,
          layoutId: exercise.layoutId,
          tokenId: trace.matchedToken,
        },
        physicalCode: trace.physicalCode,
        correct: true,
        timingMs: validMotorTimingContext(trace) && !trace.recovery && !noiseSinceAccepted
          ? trace.elapsedSincePreviousAcceptedMs
          : null,
      });
    } else if (trace.attributedExpectedToken !== null && trace.actualToken !== null) {
      bindings.push({
        traceSequence: trace.sequence,
        scope: {
          mode: exercise.mode,
          layoutId: exercise.layoutId,
          tokenId: trace.attributedExpectedToken,
        },
        physicalCode: trace.physicalCode,
        correct: false,
        timingMs: null,
      });
      if (trace.actualToken !== trace.attributedExpectedToken) {
        confusions.push({
          traceSequence: trace.sequence,
          mode: exercise.mode,
          layoutId: exercise.layoutId,
          expectedToken: trace.attributedExpectedToken,
          actualToken: trace.actualToken,
          physicalCode: trace.physicalCode,
        });
      }
    }

    if (trace.outcome === "unexpected-component" && trace.attributedExpectedToken === null) {
      ambiguousErrorCount += 1;
    } else if (trace.outcome === "duplicate-component") {
      duplicateComponentCount += 1;
    } else if (trace.outcome === "premature-tone") {
      prematureToneCount += 1;
    }

    if (trace.outcome === "accepted-component") {
      const events = bodyEvents.get(trace.syllableOrdinal) ?? [];
      bodyEvents.set(trace.syllableOrdinal, [...events, trace]);
    }

    if (trace.outcome === "accepted-tone") {
      const events = bodyEvents.get(trace.syllableOrdinal) ?? [];
      if (events.length >= 2) {
        coordination.push({
          syllableOrdinal: trace.syllableOrdinal,
          bodySize: events.length,
          handShape: coordinationHandShape(events),
          timingMs: Math.max(0, events[events.length - 1]!.timestampMs - events[0]!.timestampMs),
          clean: !dirtyCoordination.has(trace.syllableOrdinal),
        });
      }
      const lastBody = events[events.length - 1] ?? null;
      if (lastBody !== null && trace.matchedToken !== null) {
        toneCommits.push({
          traceSequence: trace.sequence,
          toneToken: trace.matchedToken,
          timingMs: Math.max(0, trace.timestampMs - lastBody.timestampMs),
          clean: !noiseSinceAccepted,
        });
      }
      bodyEvents.delete(trace.syllableOrdinal);
      dirtyCoordination.delete(trace.syllableOrdinal);
    }

    if (isAccepted(trace)) {
      const hand = explicitHand(trace.physicalCode);
      if (previousAccepted !== null) {
        const previousHand = explicitHand(previousAccepted.physicalCode);
        if (hand !== null && previousHand !== null) {
          immediateHands.push({
            traceSequence: trace.sequence,
            fromHand: previousHand,
            toHand: hand,
            boundary: boundaryBetween(previousAccepted, trace),
            timingMs: trace.elapsedSincePreviousAcceptedMs,
            clean: !noiseSinceAccepted,
          });
        }
      }

      if (hand === null) {
        previousByHand.left = null;
        previousByHand.right = null;
        dirtyByHand.left = false;
        dirtyByHand.right = false;
        oppositeEventsSince.left = 0;
        oppositeEventsSince.right = 0;
      } else {
        const previousSameHand = previousByHand[hand];
        if (previousSameHand !== null) {
          sameHandRevisits.push({
            traceSequence: trace.sequence,
            hand,
            boundary: boundaryBetween(previousSameHand, trace),
            timingMs: Math.max(0, trace.timestampMs - previousSameHand.timestampMs),
            oppositeHandEventsBetween: oppositeEventsSince[hand],
            clean: !dirtyByHand[hand],
          });
        }
        previousByHand[hand] = trace;
        dirtyByHand[hand] = false;
        oppositeEventsSince[hand] = 0;
        oppositeEventsSince[otherHand(hand)] += 1;
      }

      previousAccepted = trace;
      noiseSinceAccepted = false;
      continue;
    }

    noiseSinceAccepted = true;
    dirtyByHand.left = previousByHand.left !== null || dirtyByHand.left;
    dirtyByHand.right = previousByHand.right !== null || dirtyByHand.right;

    const currentBodyEvents = bodyEvents.get(trace.syllableOrdinal) ?? [];
    const requiredBodySize = expectedBodySize.get(trace.syllableOrdinal) ?? 0;
    if (currentBodyEvents.length > 0 && currentBodyEvents.length < requiredBodySize) {
      dirtyCoordination.add(trace.syllableOrdinal);
    }
  }

  return {
    bindings,
    confusions,
    coordination,
    immediateHands,
    sameHandRevisits,
    toneCommits,
    ambiguousErrorCount,
    duplicateComponentCount,
    prematureToneCount,
  };
}
