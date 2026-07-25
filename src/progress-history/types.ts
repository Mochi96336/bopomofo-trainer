import type { PracticeMode, TokenId } from "../core/model.js";

export const PROGRESS_HISTORY_SCHEMA_VERSION = 1 as const;

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
 * One completed slice of accepted binding timing observations.
 *
 * `representativeTimingMs` is the median of the bucket's accepted samples. It is
 * deliberately not the aggregate's exponential moving average: the aggregate
 * describes the current smoothed state, this describes one bounded exposure.
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
}
