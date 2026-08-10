import type { PracticeMode, TokenId } from "../core/model.js";
import type {
  CoordinationAggregateScope,
  ImmediateHandAggregateScope,
  ImmediateTokenAggregateScope,
  SameHandRevisitAggregateScope,
  ToneCommitAggregateScope,
} from "../measurement-v2/aggregate.js";

// Schema 8 adds bounded history for exact accepted-token transitions on top of
// schema 7's tone-aware same-hand revisit semantics. Schema 7 therefore keeps
// its valid revisit history while exact transition history starts empty. Schema
// 6 used body-only revisit semantics, so its revisit series is validated then
// discarded and exact transition history also starts empty. Schema 5 and older
// retain their existing migration behavior.
export const PROGRESS_HISTORY_SCHEMA_VERSION = 8 as const;

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
