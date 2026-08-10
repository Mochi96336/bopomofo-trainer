import type { TokenId } from "../core/model.js";

export type DiagnosticDataState = "insufficient" | "preliminary" | "sufficient";
export type DiagnosticMetricAvailability = "available" | "not-applicable";
export type DiagnosticReinforcementState = "sampling" | "neutral" | "reinforced";

export interface KeyDiagnostic {
  readonly tokenId: TokenId;
  readonly symbol: string;
  readonly physicalCode: string;
  readonly physicalKey: string;
  readonly attempts: number;
  readonly errors: number;
  readonly displayedErrorRatio: number | null;
  readonly errorMetricLabel: "錯誤觀察比例";
  readonly errorDataState: DiagnosticDataState;
  readonly timingAvailability: DiagnosticMetricAvailability;
  readonly timingMs: number | null;
  readonly timingSamples: number;
  readonly bestTimingMs: number | null;
  readonly timingDataState: DiagnosticDataState | null;
  /** Null when the supplied measurement model does not preserve exclusion causes. */
  readonly excludedSamples: {
    readonly syllableStart: number;
    readonly incorrect: number;
    readonly recovery: number;
    readonly interactionNoise: number;
  } | null;
  readonly overallDataState: DiagnosticDataState;
  readonly reinforcement: {
    readonly state: DiagnosticReinforcementState;
    readonly label: string;
    readonly reason: string;
    readonly expectedTokenBoost: number;
  };
}

export interface ConfusionDiagnostic {
  readonly id: string;
  readonly expectedTokenId: TokenId;
  readonly actualTokenId: TokenId;
  readonly expectedSymbol: string;
  readonly actualSymbol: string;
  readonly expectedPhysicalKey: string;
  readonly actualPhysicalKey: string;
  readonly occurrences: number;
  readonly expectedConfusionTotal: number;
  readonly expectedErrorShare: number;
  readonly dataState: DiagnosticDataState;
}

export type ProgressMetric = "correctness" | "timing";

/**
 * How a series should be read, before any direction is discussed.
 *
 * `no-history` is the starting state: the learner has a cumulative aggregate
 * but has not yet completed enough rounds to have recorded history, so nothing
 * is charted rather than fabricating two points from current and best values.
 */
export type ProgressSeriesState =
  | "not-applicable"
  | "no-history"
  | "single-point"
  | "charted";

/**
 * A descriptive summary of recent bounded observations. Not statistical
 * confidence, not a causal claim about training, and never a prediction.
 */
export type ProgressTrend =
  | "insufficient"
  | "improving"
  | "stable"
  | "worsening"
  | "variable";

export interface ProgressSeriesPoint {
  readonly index: number;
  readonly value: number;
  readonly sampleCount: number;
  readonly completedRound: number;
}

export interface ProgressChartDomain {
  readonly minimum: number;
  readonly maximum: number;
}

export interface ProgressTrendSummary {
  readonly state: ProgressTrend;
  readonly previousValue: number | null;
  readonly recentValue: number | null;
  readonly delta: number | null;
  readonly label: string;
}

export interface KeyProgressSeries {
  readonly metric: ProgressMetric;
  readonly metricLabel: string;
  readonly unit: "percent" | "milliseconds";
  readonly state: ProgressSeriesState;
  readonly points: readonly ProgressSeriesPoint[];
  readonly chartDomain: ProgressChartDomain;
  readonly trend: ProgressTrendSummary;
  readonly earliestValue: number | null;
  readonly latestValue: number | null;
  /** Observations already gathered toward the next, not-yet-closed point. */
  readonly partialSampleCount: number;
  readonly bucketSize: number;
  readonly accessibleSummary: string;
}

export interface KeyProgressTrends {
  readonly tokenId: TokenId;
  readonly correctness: KeyProgressSeries;
  readonly timing: KeyProgressSeries;
}
