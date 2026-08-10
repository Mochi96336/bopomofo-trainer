import type { PracticeMode, TokenId } from "../core/model.js";
import type {
  CoordinationAggregateScope,
  ImmediateHandAggregateScope,
  SameHandRevisitAggregateScope,
  ToneCommitAggregateScope,
} from "../measurement-v2/aggregate.js";

// Schema 4 narrows Bopomofo body-size-dependent motor history to the complete
// product domain: 2 or 3 body components. Schema 3 remains migratable by
// preserving valid 2/3 coordination histories and dropping only the impossible
// legacy 4+ bucket. Schema 2 still migrates with empty motor series.
export const PROGRESS_HISTORY_SCHEMA_VERSION = 4 as const;

/**
 * One completed slice of correctness observations for a single expected token.
 *
 * `errorRatio` keeps the same meaning as the cumulative `錯誤觀察比例`: it counts
 * mapped incorrect observations against all mapped observations, including the
 * correct recovery input that follows an error. It is not a first-attempt error
 * rate, and nothing downstream may rename it as one.
 */
export interface CorrectnessTrendPoint {
  /** Cumulative count of mapped correctness observations at the bucket's close. */
  readonly endingObservation: number;
  readonly completedRound: number;
  readonly attempts: number;
  readonly errors: number;
  readonly errorRatio: number;
}

/**
 * One completed slice of accepted timing observations.
 *
 * `representativeTimingMs` is the median of the bucket's accepted samples. It is
 * deliberately not an aggregate EMA: the aggregate describes the current
 * smoothed state, this point describes one bounded exposure.
 */
export interface TimingTrendPoint {
  /** Cumulative count of accepted timing observations at the bucket's close. */
  readonly endingSample: number;
  readonly completedRound: number;
  readonly samples: number;
  readonly representativeTimingMs: number;
}

/** Counters for the not-yet-complete correctness bucket. */
export interface PartialCorrectnessBucket {
  readonly attempts: number;
  readonly errors: number;
}

/**
 * The not-yet-complete timing bucket. Raw sample values are retained only until
 * the bucket closes, because the median cannot be computed incrementally. The
 * array is therefore bounded by `timingBucketSize - 1`.
 */
export interface PartialTimingBucket {
  readonly samples: readonly number[];
}

export interface KeyProgressHistory {
  readonly tokenId: TokenId;
  readonly correctness: readonly CorrectnessTrendPoint[];
  readonly timing: readonly TimingTrendPoint[];
  readonly partialCorrectness: PartialCorrectnessBucket;
  readonly partialTiming: PartialTimingBucket;
  /** Cumulative mapped correctness observations, including the partial bucket. */
  readonly totalObservations: number;
  /** Cumulative accepted timing observations, including the partial bucket. */
  readonly totalTimingSamples: number;
}

/**
 * One bounded motor timing series. Scope identity is intentionally the same
 * low-dimensional identity used by the cumulative V2 motor aggregate.
 */
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
  /**
   * The highest completed round already folded into this history. Re-applying a
   * round at or below this number is a no-op, so reopening diagnostics,
   * reloading, or re-importing a backup can never double-count practice.
   */
  readonly lastCompletedRound: number;
  readonly keys: Readonly<Record<TokenId, KeyProgressHistory>>;
  readonly motor: MotorProgressHistory;
}
