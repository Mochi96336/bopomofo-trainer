import type { PracticeMode, TokenId } from "../core/model.js";
import type {
  CoordinationAggregateScope,
  ImmediateHandAggregateScope,
  SameHandRevisitAggregateScope,
  ToneCommitAggregateScope,
} from "../measurement-v2/aggregate.js";

// Schema 7 keeps same-hand revisit evidence inside one syllable and lets the
// final accepted tone complete a revisit. Schema 6 used body-only revisit
// semantics, so its word-structure, immediate-hand and tone histories are
// preserved while its revisit series is validated then discarded. Schema 5 is
// handled the same way because its revisit predecessor rules are also obsolete.
// Schema 4/3 discard obsolete coordination series; schema 2 migrates with empty
// motor history.
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
