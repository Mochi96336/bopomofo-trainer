import type { DiagnosticDataState } from "./types.js";

export const DIAGNOSTIC_POLICY = {
  errorSamples: {
    preliminary: 3,
    sufficient: 8,
  },
  timingSamples: {
    preliminary: 3,
    sufficient: 5,
  },
  relationshipSamples: {
    preliminary: 3,
    sufficient: 5,
  },
  commonConfusionOccurrences: 2,
  transitionTimingBandsMs: {
    medium: 300,
    slow: 450,
  },
  topLimit: 5,
} as const;

/**
 * Display policy for the bounded progress-history trends.
 *
 * Every number here is a reading threshold for a small chart, not a statistical
 * instrument. The dead zones exist so a one-millisecond or half-a-percent
 * wobble is not announced as improvement or decline; they are not confidence
 * intervals, and nothing derived from them may be presented as one.
 */
export const DIAGNOSTIC_PROGRESS_POLICY = {
  /** Completed points required before any direction is stated at all. */
  minimumComparablePoints: 4,
  /** Points per comparison window; the two most recent windows are compared. */
  windowSize: 2,
  /** Display dead zone for the error-observation ratio, in ratio units. */
  correctnessDeadZone: 0.05,
  /** Absolute floor of the timing display dead zone. */
  timingDeadZoneMs: 20,
  /** Relative timing dead zone; the larger of the two applies. */
  timingDeadZoneRatio: 0.08,
  /**
   * How much larger point-to-point movement must be than the window difference
   * before the difference is reported as `variable` rather than a direction.
   */
  variabilityMultiplier: 3,
  chart: {
    /** Smallest correctness axis span, so 8% → 7% cannot fill the chart. */
    correctnessMinimumSpan: 0.1,
    /** Smallest timing axis span, in milliseconds, for the same reason. */
    timingMinimumSpanMs: 40,
    /** Headroom added above and below the observed range. */
    paddingRatio: 0.15,
  },
} as const;

export type DiagnosticProgressPolicy = typeof DIAGNOSTIC_PROGRESS_POLICY;

export function dataStateForSamples(
  samples: number,
  thresholds: { readonly preliminary: number; readonly sufficient: number },
): DiagnosticDataState {
  if (!Number.isInteger(samples) || samples < 0) {
    throw new RangeError("diagnostic sample count must be a non-negative integer");
  }
  if (samples >= thresholds.sufficient) return "sufficient";
  if (samples >= thresholds.preliminary) return "preliminary";
  return "insufficient";
}

export function conservativeDataState(
  left: DiagnosticDataState,
  right: DiagnosticDataState,
): DiagnosticDataState {
  const rank: Readonly<Record<DiagnosticDataState, number>> = {
    insufficient: 0,
    preliminary: 1,
    sufficient: 2,
  };
  return rank[left] <= rank[right] ? left : right;
}
