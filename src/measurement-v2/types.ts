import type { BindingSkillScope, PracticeMode, TokenId } from "../core/model.js";
import type { AssignedHand } from "../motor/keyboard-geometry.js";

export type ExplicitHand = Extract<AssignedHand, "left" | "right">;
export type BoundaryClass = "within-syllable" | "syllable-boundary" | "entry-boundary";

/**
 * Legacy coordination dimension retained only so old persisted records can be
 * validated before their obsolete coordination channel is discarded.
 */
export type CoordinationHandShape = "left-only" | "right-only" | "mixed" | "unknown";

/**
 * Canonical Bopomofo body structure for words with at least two non-tone parts.
 * These are the complete multi-part combinations of initial / medial / final.
 */
export type CoordinationBodyShape =
  | "initial-medial"
  | "initial-final"
  | "medial-final"
  | "initial-medial-final";

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

/**
 * One accepted body component projected into the relationship between canonical
 * notation position and actual accepted position. This deliberately does not
 * retain token identity, so long-term strategy evidence stays bounded.
 */
export interface InputOrderPositionObservation {
  readonly syllableOrdinal: number;
  readonly bodySize: number;
  readonly canonicalBodyIndex: number;
  readonly acceptedBodyIndex: number;
}

/**
 * Total clean time from the first accepted body component to the final accepted
 * body component of one word. Identity is canonical word-body structure, never
 * the hands used to enter it; hand timing has its own motor families below.
 */
export interface CoordinationObservation {
  readonly syllableOrdinal: number;
  readonly bodyShape: CoordinationBodyShape;
  readonly timingMs: number;
  readonly clean: boolean;
}

/**
 * Exact motor edge between two actually accepted tokens. This is observational:
 * neither endpoint nor direction is reconstructed from canonical syllable order.
 */
export interface ImmediateTokenObservation {
  readonly traceSequence: number;
  readonly fromToken: TokenId;
  readonly toToken: TokenId;
  readonly boundary: BoundaryClass;
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

/**
 * Reappearance of the same conventional hand assignment inside one word body.
 * Tone keys and cross-word/syllable predecessors are deliberately excluded;
 * tone completion is owned by ToneCommitObservation instead.
 */
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
  readonly inputOrderPositions: readonly InputOrderPositionObservation[];
  readonly coordination: readonly CoordinationObservation[];
  readonly immediateTokens: readonly ImmediateTokenObservation[];
  readonly immediateHands: readonly ImmediateHandObservation[];
  readonly sameHandRevisits: readonly SameHandRevisitObservation[];
  readonly toneCommits: readonly ToneCommitObservation[];
  readonly ambiguousErrorCount: number;
  readonly duplicateComponentCount: number;
  readonly prematureToneCount: number;
}
