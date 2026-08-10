import type { PracticeMode, TokenId } from "../core/model.js";
import type {
  CoordinationAggregateScope,
  ImmediateHandAggregateScope,
  ImmediateTokenAggregateScope,
  SameHandRevisitAggregateScope,
  ToneCommitAggregateScope,
} from "../measurement-v2/aggregate.js";

// Schema 7 adds bounded history for exact accepted-token transitions. Schema 6
// remains readable: its word-structure, immediate-hand, same-hand revisit and
// tone histories are preserved, while exact transition history starts empty
// because older records never stored pair-level series. Schema 5 preserves
// word-structure, immediate-hand and tone histories but discards its old revisit
// series; schema 4/3 also discard obsolete coordination; schema 2 migrates with
// empty motor history.
export const PROGRESS_HISTORY_SCHEMA_VERSION = 7 as const;

export interface CorrectnessTrendPoint {
  readonly endingObservation: number;
  readonly completedRound: number;
  readonly attempts: number;
  readonly errors: number;
  readonly errorRatio: number;
}

export interface TimingTrendPoint {
  readonly endingSample: number;
  readonly completedRound: number;
  readonly samples: number;
  readonly representativeTimingMs: number;
}

export interface PartialCorrectnessBucket {
  readonly attempts: number;
  readonly errors: number;
}

export interface PartialTimingBucket {
  readonly samples: readonly number[];
}

export interface KeyProgressHistory {
  readonly tokenId: TokenId;
  readonly correctness: readonly CorrectnessTrendPoint[];
  readonly timing: readonly TimingTrendPoint[];
  readonly partialCorrectness: PartialCorrectnessBucket;
  readonly partialTiming: PartialTimingBucket;
  readonly totalObservations: number;
  readonly totalTimingSamples: number;
}

export interface MotorTimingProgressHistory<Scope> {
  readonly scope: Scope;
  readonly timing: readonly TimingTrendPoint[];
  readonly partialTiming: PartialTimingBucket;
  readonly totalTimingSamples: number;
}

export interface MotorProgressHistory {
  readonly coordination: Readonly<Record<string, MotorTimingProgressHistory<CoordinationAggregateScope>>>;
  readonly immediateTokens: Readonly<Record<string, MotorTimingProgressHistory<ImmediateTokenAggregateScope>>>;
  readonly immediateHands: Readonly<Record<string, MotorTimingProgressHistory<ImmediateHandAggregateScope>>>;
  readonly sameHandRevisits: Readonly<Record<string, MotorTimingProgressHistory<SameHandRevisitAggregateScope>>>;
  readonly toneCommits: Readonly<Record<string, MotorTimingProgressHistory<ToneCommitAggregateScope>>>;
}

export interface ProgressHistory {
  readonly schemaVersion: typeof PROGRESS_HISTORY_SCHEMA_VERSION;
  readonly mode: PracticeMode;
  readonly layoutId: string;
  readonly lastCompletedRound: number;
  readonly keys: Readonly<Record<TokenId, KeyProgressHistory>>;
  readonly motor: MotorProgressHistory;
}
