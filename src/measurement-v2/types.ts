import type { BindingSkillScope, PracticeMode, TokenId } from "../core/model.js";
import type { AssignedHand } from "../motor/keyboard-geometry.js";

export type ExplicitHand = Extract<AssignedHand, "left" | "right">;
export type BoundaryClass = "within-syllable" | "syllable-boundary" | "entry-boundary";
export type CoordinationHandShape = "left-only" | "right-only" | "mixed" | "unknown";

export interface BindingObservationV2 {
  readonly traceSequence: number;
  readonly scope: BindingSkillScope;
  readonly physicalCode: string;
  readonly correct: boolean;
  readonly timingMs: number | null;
}

export interface ConfusionObservationV2 {
  readonly traceSequence: number;
  readonly mode: PracticeMode;
  readonly layoutId: string;
  readonly expectedToken: TokenId;
  readonly actualToken: TokenId;
  readonly physicalCode: string;
}

export interface CoordinationObservation {
  readonly syllableOrdinal: number;
  readonly bodySize: number;
  readonly handShape: CoordinationHandShape;
  readonly timingMs: number;
  readonly clean: boolean;
}

export interface ImmediateHandObservation {
  readonly traceSequence: number;
  readonly fromHand: ExplicitHand;
  readonly toHand: ExplicitHand;
  readonly boundary: BoundaryClass;
  readonly timingMs: number;
  readonly clean: boolean;
}

export interface SameHandRevisitObservation {
  readonly traceSequence: number;
  readonly hand: ExplicitHand;
  readonly boundary: BoundaryClass;
  readonly timingMs: number;
  readonly oppositeHandEventsBetween: number;
  readonly clean: boolean;
}

export interface ToneCommitObservation {
  readonly traceSequence: number;
  readonly toneToken: TokenId;
  readonly timingMs: number;
  readonly clean: boolean;
}

export interface MeasurementObservationsV2 {
  readonly bindings: readonly BindingObservationV2[];
  readonly confusions: readonly ConfusionObservationV2[];
  readonly coordination: readonly CoordinationObservation[];
  readonly immediateHands: readonly ImmediateHandObservation[];
  readonly sameHandRevisits: readonly SameHandRevisitObservation[];
  readonly toneCommits: readonly ToneCommitObservation[];
  readonly ambiguousErrorCount: number;
  readonly duplicateComponentCount: number;
  readonly prematureToneCount: number;
}
