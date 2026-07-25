/**
 * Bounded progress-history policy.
 *
 * Every constant that decides how observations become history points lives
 * here. UI code must not re-derive or hard-code any of them.
 */
export const PROGRESS_HISTORY_POLICY = {
  /**
   * Mapped correctness observations per completed point. Matches
   * `DIAGNOSTIC_POLICY.errorSamples.sufficient`, so one history point is exactly
   * the exposure the product already calls enough to display a ratio.
   */
  correctnessBucketSize: 8,
  /**
   * Accepted binding timing observations per completed point. Matches
   * `DIAGNOSTIC_POLICY.timingSamples.sufficient` for the same reason.
   */
  timingBucketSize: 5,
  /**
   * Completed points retained per series, per key. Enough to read a short-term
   * direction, small enough that a fully practised layout stays well inside a
   * reasonable localStorage payload. Overflow drops the oldest completed point
   * and never touches the open partial bucket.
   */
  completedPointLimit: 10,
} as const;

export function validateProgressHistoryPolicy(
  policy: ProgressHistoryPolicy,
): void {
  const sizes = [
    policy.correctnessBucketSize,
    policy.timingBucketSize,
    policy.completedPointLimit,
  ];
  if (sizes.some((size) => !Number.isInteger(size) || size <= 0)) {
    throw new RangeError("progress history policy sizes must be positive integers");
  }
}

export type ProgressHistoryPolicy = typeof PROGRESS_HISTORY_POLICY;
