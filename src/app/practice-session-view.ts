import type { TokenId } from "../core/model.js";
import type {
  InteractionSessionStateV2,
  InteractionTraceV2,
} from "../practice/interaction-session-v2.js";
import type { InputSlot, SyllableInputPlan } from "../practice/input-plan.js";

export type PracticeSyllableState = "done" | "current" | "upcoming";
export type PracticeTokenState =
  | "done"
  | "pending"
  | "commit-locked"
  | "commit-ready"
  | "upcoming";

export interface CurrentPracticeView {
  readonly syllable: SyllableInputPlan | null;
  readonly remainingBodySlots: readonly InputSlot[];
  readonly acceptableTokens: readonly TokenId[];
  readonly bodyComplete: boolean;
}

export function currentPracticeView(
  session: InteractionSessionStateV2,
): CurrentPracticeView {
  const syllable = session.plan.syllables[session.currentSyllableOrdinal] ?? null;
  if (syllable === null) {
    return {
      syllable: null,
      remainingBodySlots: [],
      acceptableTokens: [],
      bodyComplete: true,
    };
  }
  const completed = new Set(session.completedBodySlotIds);
  const remainingBodySlots = syllable.bodySlots.filter((slot) => !completed.has(slot.id));
  const bodyComplete = remainingBodySlots.length === 0;
  return {
    syllable,
    remainingBodySlots,
    acceptableTokens: bodyComplete
      ? [syllable.toneSlot.tokenId]
      : remainingBodySlots.map((slot) => slot.tokenId),
    bodyComplete,
  };
}

export function syllableState(
  session: InteractionSessionStateV2,
  ordinal: number,
): PracticeSyllableState {
  if (ordinal < session.currentSyllableOrdinal) return "done";
  if (ordinal === session.currentSyllableOrdinal && !session.completed) return "current";
  return "upcoming";
}

export function tokenState(
  session: InteractionSessionStateV2,
  syllableOrdinal: number,
  canonicalTokenIndex: number,
): PracticeTokenState {
  const state = syllableState(session, syllableOrdinal);
  if (state === "done") return "done";
  if (state === "upcoming") return "upcoming";

  const syllable = session.plan.syllables[syllableOrdinal];
  if (syllable === undefined) return "upcoming";
  if (syllable.toneSlot.canonicalTokenIndex === canonicalTokenIndex) {
    return session.completedBodySlotIds.length === syllable.bodySlots.length
      ? "commit-ready"
      : "commit-locked";
  }
  const slot = syllable.bodySlots.find(
    (candidate) => candidate.canonicalTokenIndex === canonicalTokenIndex,
  );
  if (slot === undefined) return "upcoming";
  return session.completedBodySlotIds.includes(slot.id) ? "done" : "pending";
}

export function isMappedPracticeAttempt(trace: InteractionTraceV2): boolean {
  return trace.outcome === "accepted-component"
    || trace.outcome === "accepted-tone"
    || trace.outcome === "unexpected-component"
    || trace.outcome === "unexpected-tone"
    || trace.outcome === "duplicate-component"
    || trace.outcome === "premature-tone";
}

export function isMappedPracticeError(trace: InteractionTraceV2): boolean {
  return isMappedPracticeAttempt(trace) && !trace.accepted;
}

export function inspectionNextToken(session: InteractionSessionStateV2): TokenId | null {
  const view = currentPracticeView(session);
  return view.acceptableTokens[0] ?? null;
}

export function errorCanonicalTokenIndex(
  session: InteractionSessionStateV2,
  trace: InteractionTraceV2 | undefined,
): number | null {
  if (trace === undefined || trace.syllableOrdinal !== session.currentSyllableOrdinal) return null;
  if (trace.attributedExpectedToken !== null) {
    const syllable = session.plan.syllables[trace.syllableOrdinal];
    if (syllable === undefined) return null;
    if (syllable.toneSlot.tokenId === trace.attributedExpectedToken) {
      return syllable.toneSlot.canonicalTokenIndex;
    }
    return syllable.bodySlots.find((slot) => slot.tokenId === trace.attributedExpectedToken)
      ?.canonicalTokenIndex ?? null;
  }
  if (trace.outcome === "duplicate-component" && trace.actualToken !== null) {
    const syllable = session.plan.syllables[trace.syllableOrdinal];
    return syllable?.bodySlots.find((slot) => slot.tokenId === trace.actualToken)
      ?.canonicalTokenIndex ?? null;
  }
  if (trace.outcome === "premature-tone") {
    return session.plan.syllables[trace.syllableOrdinal]?.toneSlot.canonicalTokenIndex ?? null;
  }
  return null;
}
