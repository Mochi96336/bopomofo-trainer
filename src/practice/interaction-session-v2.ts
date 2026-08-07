import type { Exercise, TimingContext, TokenId } from "../core/model.js";
import type { PracticeInput } from "./interaction-input.js";
import {
  compileExerciseInputPlan,
  type InputSlot,
  type SyllableInputPlan,
} from "./input-plan.js";

export type InteractionOutcomeV2 =
  | "accepted-component"
  | "accepted-tone"
  | "unexpected-component"
  | "unexpected-tone"
  | "duplicate-component"
  | "premature-tone"
  | "unmapped"
  | "ignored-repeat"
  | "ignored-modifier"
  | "composition";

export interface InteractionTraceV2 {
  readonly sequence: number;
  readonly timestampMs: number;
  readonly elapsedSincePreviousAcceptedMs: number;
  readonly exerciseId: string;
  readonly entryId: string;
  readonly entryIndex: number;
  readonly syllableIndex: number;
  readonly syllableOrdinal: number;
  readonly physicalCode: string;
  readonly actualToken: TokenId | null;
  readonly matchedSlotId: string | null;
  readonly matchedToken: TokenId | null;
  readonly canonicalTokenIndex: number | null;
  readonly attributedExpectedToken: TokenId | null;
  readonly acceptedOrdinalInSyllable: number | null;
  readonly context: TimingContext;
  readonly outcome: InteractionOutcomeV2;
  readonly accepted: boolean;
  readonly recovery: boolean;
  readonly repeat: boolean;
  readonly composing: boolean;
  readonly modifierOnly: boolean;
}

export interface InteractionSessionStateV2 {
  readonly exercise: Exercise;
  readonly plan: ReturnType<typeof compileExerciseInputPlan>;
  readonly currentSyllableOrdinal: number;
  readonly completedBodySlotIds: readonly string[];
  readonly completedCount: number;
  readonly lastAcceptedTimestampMs: number;
  readonly traces: readonly InteractionTraceV2[];
  readonly hadErrorSinceAccepted: boolean;
  readonly completed: boolean;
}

function ignoredOutcome(input: PracticeInput): InteractionOutcomeV2 | null {
  if (input.composing) return "composition";
  if (input.repeat) return "ignored-repeat";
  if (input.modifierOnly) return "ignored-modifier";
  return null;
}

function isToneToken(tokenId: TokenId | null): boolean {
  return tokenId?.startsWith("tone:") ?? false;
}

function currentSyllable(state: InteractionSessionStateV2): SyllableInputPlan | null {
  return state.plan.syllables[state.currentSyllableOrdinal] ?? null;
}

function remainingBodySlots(
  state: InteractionSessionStateV2,
  syllable: SyllableInputPlan,
): readonly InputSlot[] {
  const completed = new Set(state.completedBodySlotIds);
  return syllable.bodySlots.filter((slot) => !completed.has(slot.id));
}

function contextFor(
  state: InteractionSessionStateV2,
  syllable: SyllableInputPlan,
  input: PracticeInput,
): TimingContext {
  if (isToneToken(input.actualToken)) return "tone";
  if (state.completedBodySlotIds.length > 0) return "within-syllable";
  if (state.completedCount === 0) return "exercise-start";
  if (syllable.syllableIndex === 0) return "entry-start";
  return "syllable-start";
}

function isErrorOutcome(outcome: InteractionOutcomeV2): boolean {
  return outcome === "unexpected-component"
    || outcome === "unexpected-tone"
    || outcome === "duplicate-component"
    || outcome === "premature-tone";
}

function findCompletedBodySlot(
  state: InteractionSessionStateV2,
  syllable: SyllableInputPlan,
  tokenId: TokenId,
): InputSlot | null {
  const completed = new Set(state.completedBodySlotIds);
  return syllable.bodySlots.find((slot) => slot.tokenId === tokenId && completed.has(slot.id)) ?? null;
}

export function createInteractionSessionV2(
  exercise: Exercise,
  startedAtMs: number,
): InteractionSessionStateV2 {
  const plan = compileExerciseInputPlan(exercise);
  return {
    exercise,
    plan,
    currentSyllableOrdinal: 0,
    completedBodySlotIds: [],
    completedCount: 0,
    lastAcceptedTimestampMs: startedAtMs,
    traces: [],
    hadErrorSinceAccepted: false,
    completed: plan.syllables.length === 0,
  };
}

export function applyInteractionInputV2(
  state: InteractionSessionStateV2,
  input: PracticeInput,
): InteractionSessionStateV2 {
  if (state.completed) return state;
  const syllable = currentSyllable(state);
  if (syllable === null) return { ...state, completed: true };

  const ignored = ignoredOutcome(input);
  const remaining = remainingBodySlots(state, syllable);
  const bodyComplete = remaining.length === 0;
  const acceptedOrdinal = syllable.bodySlots.length - remaining.length;
  const context = contextFor(state, syllable, input);

  let outcome: InteractionOutcomeV2;
  let matchedSlot: InputSlot | null = null;
  let attributedExpectedToken: TokenId | null = null;

  if (ignored !== null) {
    outcome = ignored;
  } else if (input.actualToken === null) {
    outcome = "unmapped";
  } else if (isToneToken(input.actualToken)) {
    if (!bodyComplete) {
      outcome = "premature-tone";
    } else if (input.actualToken === syllable.toneSlot.tokenId) {
      outcome = "accepted-tone";
      matchedSlot = syllable.toneSlot;
    } else {
      outcome = "unexpected-tone";
      attributedExpectedToken = syllable.toneSlot.tokenId;
    }
  } else {
    const remainingMatch = remaining.find((slot) => slot.tokenId === input.actualToken) ?? null;
    if (remainingMatch !== null) {
      outcome = "accepted-component";
      matchedSlot = remainingMatch;
    } else if (findCompletedBodySlot(state, syllable, input.actualToken) !== null) {
      outcome = "duplicate-component";
    } else {
      outcome = "unexpected-component";
      attributedExpectedToken = remaining.length === 1
        ? remaining[0]!.tokenId
        : bodyComplete
          ? syllable.toneSlot.tokenId
          : null;
    }
  }

  const accepted = outcome === "accepted-component" || outcome === "accepted-tone";
  const recovery = accepted && state.hadErrorSinceAccepted;
  const trace: InteractionTraceV2 = {
    sequence: state.traces.length + 1,
    timestampMs: input.timestampMs,
    elapsedSincePreviousAcceptedMs: Math.max(0, input.timestampMs - state.lastAcceptedTimestampMs),
    exerciseId: state.exercise.id,
    entryId: syllable.entryId,
    entryIndex: syllable.entryIndex,
    syllableIndex: syllable.syllableIndex,
    syllableOrdinal: syllable.ordinal,
    physicalCode: input.physicalCode,
    actualToken: input.actualToken,
    matchedSlotId: matchedSlot?.id ?? null,
    matchedToken: matchedSlot?.tokenId ?? null,
    canonicalTokenIndex: matchedSlot?.canonicalTokenIndex ?? null,
    attributedExpectedToken,
    acceptedOrdinalInSyllable: accepted
      ? outcome === "accepted-tone"
        ? syllable.bodySlots.length
        : acceptedOrdinal
      : null,
    context,
    outcome,
    accepted,
    recovery,
    repeat: input.repeat,
    composing: input.composing,
    modifierOnly: input.modifierOnly,
  };

  let nextSyllableOrdinal = state.currentSyllableOrdinal;
  let completedBodySlotIds = state.completedBodySlotIds;
  let completedCount = state.completedCount;

  if (outcome === "accepted-component" && matchedSlot !== null) {
    completedBodySlotIds = [...state.completedBodySlotIds, matchedSlot.id];
    completedCount += 1;
  } else if (outcome === "accepted-tone") {
    nextSyllableOrdinal += 1;
    completedBodySlotIds = [];
    completedCount += 1;
  }

  return {
    ...state,
    currentSyllableOrdinal: nextSyllableOrdinal,
    completedBodySlotIds,
    completedCount,
    lastAcceptedTimestampMs: accepted ? input.timestampMs : state.lastAcceptedTimestampMs,
    traces: [...state.traces, trace],
    hadErrorSinceAccepted: accepted
      ? false
      : state.hadErrorSinceAccepted || isErrorOutcome(outcome),
    completed: nextSyllableOrdinal >= state.plan.syllables.length,
  };
}
