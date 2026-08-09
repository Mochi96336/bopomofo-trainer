import type { Exercise, TokenId } from "../core/model.js";
import { assignedHandForCode } from "../motor/keyboard-geometry.js";
import type { InteractionTraceV2 } from "../practice/interaction-session-v2.js";
import { compileExerciseInputPlan } from "../practice/input-plan.js";
import { FINALS, INITIALS, MEDIALS } from "../scheme/tokens.js";
import type {
  BoundaryClass,
  CoordinationBodyShape,
  ExplicitHand,
  MeasurementObservationsV2,
  ThreePartInputOrderPermutation,
} from "./types.js";

const INITIAL_SET = new Set<string>(INITIALS);
const MEDIAL_SET = new Set<string>(MEDIALS);
const FINAL_SET = new Set<string>(FINALS);

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

function bopomofoSymbol(tokenId: TokenId): string | null {
  return tokenId.startsWith("zhuyin:") ? tokenId.slice("zhuyin:".length) : null;
}

export function coordinationBodyShape(
  bodyTokens: readonly TokenId[],
): CoordinationBodyShape | null {
  if (bodyTokens.length < 2) return null;
  let initial = false;
  let medial = false;
  let final = false;
  for (const tokenId of bodyTokens) {
    const symbol = bopomofoSymbol(tokenId);
    if (symbol === null) return null;
    if (INITIAL_SET.has(symbol)) {
      if (initial) return null;
      initial = true;
    } else if (MEDIAL_SET.has(symbol)) {
      if (medial) return null;
      medial = true;
    } else if (FINAL_SET.has(symbol)) {
      if (final) return null;
      final = true;
    } else {
      return null;
    }
  }
  if (initial && medial && final) return "initial-medial-final";
  if (initial && medial) return "initial-medial";
  if (initial && final) return "initial-final";
  if (medial && final) return "medial-final";
  return null;
}

export function threePartInputOrderPermutation(
  canonicalIndicesInAcceptedOrder: readonly number[],
): ThreePartInputOrderPermutation | null {
  if (canonicalIndicesInAcceptedOrder.length !== 3) return null;
  if (new Set(canonicalIndicesInAcceptedOrder).size !== 3) return null;
  if (canonicalIndicesInAcceptedOrder.some((index) => index < 0 || index > 2)) return null;
  const labels = canonicalIndicesInAcceptedOrder.map((index) => (
    index === 0 ? "first" : index === 1 ? "middle" : "last"
  ));
  const candidate = labels.join("-");
  switch (candidate) {
    case "first-middle-last":
    case "middle-first-last":
    case "first-last-middle":
    case "middle-last-first":
    case "last-first-middle":
    case "last-middle-first":
      return candidate;
    default:
      return null;
  }
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
  const expectedBodyShape = new Map(
    plan.syllables.map((syllable) => [
      syllable.ordinal,
      coordinationBodyShape(syllable.bodySlots.map((slot) => slot.tokenId)),
    ]),
  );

  const bindings: MeasurementObservationsV2["bindings"][number][] = [];
  const confusions: MeasurementObservationsV2["confusions"][number][] = [];
  const inputOrderPositions: MeasurementObservationsV2["inputOrderPositions"][number][] = [];
  const inputOrderPermutations: NonNullable<MeasurementObservationsV2["inputOrderPermutations"]>[number][] = [];
  const coordination: MeasurementObservationsV2["coordination"][number][] = [];
  const immediateTokens: MeasurementObservationsV2["immediateTokens"][number][] = [];
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
      const bodySize = expectedBodySize.get(trace.syllableOrdinal) ?? 0;
      if (
        bodySize >= 2
        && trace.canonicalTokenIndex !== null
        && trace.acceptedOrdinalInSyllable !== null
      ) {
        const canonicalBodyIndex = trace.canonicalTokenIndex;
        const acceptedBodyIndex = trace.acceptedOrdinalInSyllable;
        if (
          canonicalBodyIndex < 0
          || canonicalBodyIndex >= bodySize
          || acceptedBodyIndex < 0
          || acceptedBodyIndex >= bodySize
        ) {
          throw new Error(`trace ${trace.sequence} has an invalid input-order position`);
        }
        inputOrderPositions.push({
          syllableOrdinal: trace.syllableOrdinal,
          bodySize,
          canonicalBodyIndex,
          acceptedBodyIndex,
        });
      }

      const events = bodyEvents.get(trace.syllableOrdinal) ?? [];
      bodyEvents.set(trace.syllableOrdinal, [...events, trace]);
    }

    if (trace.outcome === "accepted-tone") {
      const events = bodyEvents.get(trace.syllableOrdinal) ?? [];
      if (events.length === 3) {
        const canonicalIndices = events.map((event) => event.canonicalTokenIndex);
        if (canonicalIndices.every((index): index is number => index !== null)) {
          const permutation = threePartInputOrderPermutation(canonicalIndices);
          if (permutation !== null) {
            inputOrderPermutations.push({
              syllableOrdinal: trace.syllableOrdinal,
              permutation,
            });
          }
        }
      }
      const bodyShape = expectedBodyShape.get(trace.syllableOrdinal) ?? null;
      if (events.length >= 2 && bodyShape !== null) {
        coordination.push({
          syllableOrdinal: trace.syllableOrdinal,
          bodyShape,
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
        const boundary = boundaryBetween(previousAccepted, trace);
        if (previousAccepted.matchedToken !== null && trace.matchedToken !== null) {
          immediateTokens.push({
            traceSequence: trace.sequence,
            fromToken: previousAccepted.matchedToken,
            toToken: trace.matchedToken,
            boundary,
            timingMs: trace.elapsedSincePreviousAcceptedMs,
            clean: !noiseSinceAccepted,
          });
        }
        const previousHand = explicitHand(previousAccepted.physicalCode);
        if (hand !== null && previousHand !== null) {
          immediateHands.push({
            traceSequence: trace.sequence,
            fromHand: previousHand,
            toHand: hand,
            boundary,
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
    inputOrderPositions,
    inputOrderPermutations,
    coordination,
    immediateTokens,
    immediateHands,
    sameHandRevisits,
    toneCommits,
    ambiguousErrorCount,
    duplicateComponentCount,
    prematureToneCount,
  };
}
