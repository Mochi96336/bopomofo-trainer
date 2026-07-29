import type { TokenId } from "../core/model.js";
import type {
  KeyProgressHistory,
  ProgressHistory,
} from "../progress-history/types.js";
import { tokenLabel } from "./labels.js";
import {
  DIAGNOSTIC_PROGRESS_POLICY,
  type DiagnosticProgressPolicy,
} from "./policy.js";
import type {
  KeyProgressSeries,
  KeyProgressTrends,
  ProgressChartDomain,
  ProgressMetric,
  ProgressSeriesPoint,
  ProgressTrend,
  ProgressTrendSummary,
} from "./types.js";

const CORRECTNESS_LABEL = "錯誤觀察比例";
const TIMING_LABEL = "有效鍵間時間";

const TREND_LABELS: Readonly<Record<ProgressMetric, Readonly<Record<ProgressTrend, string>>>> = {
  correctness: {
    insufficient: "再累積幾個區段後才能判斷",
    improving: "最近較少出錯",
    stable: "近期大致持平",
    worsening: "最近錯誤觀察增加",
    variable: "最近波動較大",
  },
  timing: {
    insufficient: "再累積幾個區段後才能判斷",
    improving: "最近較快",
    stable: "近期大致持平",
    worsening: "最近較慢",
    variable: "最近波動較大",
  },
};

function median(values: readonly number[]): number {
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function deadZone(
  metric: ProgressMetric,
  previousValue: number,
  policy: DiagnosticProgressPolicy,
): number {
  if (metric === "correctness") return policy.correctnessDeadZone;
  return Math.max(
    policy.timingDeadZoneMs,
    Math.abs(previousValue) * policy.timingDeadZoneRatio,
  );
}

/**
 * Compares the median of the two most recent completed points with the median
 * of the two before them.
 *
 * Two windows rather than first-versus-last, because a single outlying bucket
 * at either end of a ten-point series would otherwise decide the wording. Both
 * metrics are "lower is better", so a negative difference is always the
 * improvement direction.
 *
 * This is a description of bounded past observations. It does not extrapolate,
 * and no part of it is a significance test.
 */
export function summarizeProgressTrend(
  metric: ProgressMetric,
  values: readonly number[],
  policy: DiagnosticProgressPolicy = DIAGNOSTIC_PROGRESS_POLICY,
): ProgressTrendSummary {
  const required = Math.max(
    policy.minimumComparablePoints,
    policy.windowSize * 2,
  );
  if (values.length < required) {
    return {
      state: "insufficient",
      previousValue: null,
      recentValue: null,
      delta: null,
      label: TREND_LABELS[metric].insufficient,
    };
  }

  const compared = values.slice(values.length - policy.windowSize * 2);
  const previousValue = median(compared.slice(0, policy.windowSize));
  const recentValue = median(compared.slice(policy.windowSize));
  const delta = recentValue - previousValue;

  const volatility = compared.reduce(
    (largest, value, index) =>
      index === 0
        ? largest
        : Math.max(largest, Math.abs(value - compared[index - 1]!)),
    0,
  );
  const zone = deadZone(metric, previousValue, policy);
  const magnitude = Math.max(Math.abs(delta), zone);

  let state: ProgressTrend;
  if (volatility >= policy.variabilityMultiplier * magnitude) {
    state = "variable";
  } else if (Math.abs(delta) <= zone) {
    state = "stable";
  } else {
    state = delta < 0 ? "improving" : "worsening";
  }

  return {
    state,
    previousValue,
    recentValue,
    delta,
    label: TREND_LABELS[metric][state],
  };
}

/**
 * A bounded adaptive axis. It never autoscales to the raw range alone: a
 * minimum span keeps a one-point difference looking like a one-point
 * difference, and padding keeps the newest point off the frame edge.
 */
export function progressChartDomain(
  metric: ProgressMetric,
  values: readonly number[],
  policy: DiagnosticProgressPolicy = DIAGNOSTIC_PROGRESS_POLICY,
): ProgressChartDomain {
  const minimumSpan = metric === "correctness"
    ? policy.chart.correctnessMinimumSpan
    : policy.chart.timingMinimumSpanMs;
  if (values.length === 0) return { minimum: 0, maximum: minimumSpan };

  const lowest = Math.min(...values);
  const highest = Math.max(...values);
  const centre = (lowest + highest) / 2;
  const span = Math.max(highest - lowest, minimumSpan);
  const padded = span * (1 + policy.chart.paddingRatio * 2);
  let minimum = centre - padded / 2;
  let maximum = centre + padded / 2;

  if (minimum < 0) {
    maximum += -minimum;
    minimum = 0;
  }
  if (metric === "correctness" && maximum > 1) {
    minimum = Math.max(0, minimum - (maximum - 1));
    maximum = 1;
  }
  return {
    minimum: Math.round(minimum * 1e6) / 1e6,
    maximum: Math.round(maximum * 1e6) / 1e6,
  };
}

function formatValue(metric: ProgressMetric, value: number): string {
  return metric === "correctness"
    ? `${Math.round(value * 100)}%`
    : `${Math.round(value)} ms`;
}

function accessibleSummary(
  metric: ProgressMetric,
  symbol: string,
  series: Omit<KeyProgressSeries, "accessibleSummary">,
): string {
  const label = metric === "correctness" ? CORRECTNESS_LABEL : TIMING_LABEL;
  if (series.state === "not-applicable") {
    return `${symbol}的${label}不適用。`;
  }
  if (series.state === "no-history") {
    return `${symbol}的${label}尚無歷史區段，變化資料將從現在開始累積。`;
  }
  const count = `${symbol}的${label}共有 ${series.points.length} 個歷史區段`;
  if (series.trend.state === "insufficient"
    || series.trend.previousValue === null
    || series.trend.recentValue === null) {
    return `${count}，目前資料不足以判斷變化。`;
  }
  return `${count}，前期代表值 ${formatValue(metric, series.trend.previousValue)}，`
    + `近期代表值 ${formatValue(metric, series.trend.recentValue)}，${series.trend.label}。`;
}

function buildSeries(
  metric: ProgressMetric,
  symbol: string,
  points: readonly ProgressSeriesPoint[],
  partialSampleCount: number,
  bucketSize: number,
  applicable: boolean,
  policy: DiagnosticProgressPolicy,
): KeyProgressSeries {
  const values = points.map((point) => point.value);
  const state: KeyProgressSeries["state"] = !applicable
    ? "not-applicable"
    : points.length === 0
      ? "no-history"
      : points.length === 1
        ? "single-point"
        : "charted";
  const base: Omit<KeyProgressSeries, "accessibleSummary"> = {
    metric,
    metricLabel: metric === "correctness" ? CORRECTNESS_LABEL : TIMING_LABEL,
    unit: metric === "correctness" ? "percent" : "milliseconds",
    state,
    points,
    chartDomain: progressChartDomain(metric, values, policy),
    trend: state === "not-applicable"
      ? {
          state: "insufficient",
          previousValue: null,
          recentValue: null,
          delta: null,
          label: TREND_LABELS[metric].insufficient,
        }
      : summarizeProgressTrend(metric, values, policy),
    earliestValue: values[0] ?? null,
    latestValue: values.at(-1) ?? null,
    partialSampleCount,
    bucketSize,
  };
  return { ...base, accessibleSummary: accessibleSummary(metric, symbol, base) };
}

export interface BuildKeyProgressTrendsInput {
  readonly tokenId: TokenId;
  readonly entry: KeyProgressHistory | null;
  /** False when the catalog can never produce accepted motor timing for this key. */
  readonly timingAvailable: boolean;
  readonly correctnessBucketSize: number;
  readonly timingBucketSize: number;
  readonly policy?: DiagnosticProgressPolicy;
}

export function buildKeyProgressTrends(
  input: BuildKeyProgressTrendsInput,
): KeyProgressTrends {
  const policy = input.policy ?? DIAGNOSTIC_PROGRESS_POLICY;
  const symbol = tokenLabel(input.tokenId);
  const entry = input.entry;

  const correctnessPoints: readonly ProgressSeriesPoint[] = (entry?.correctness ?? [])
    .map((point, index) => ({
      index,
      value: point.errorRatio,
      sampleCount: point.attempts,
      completedRound: point.completedRound,
    }));
  const timingPoints: readonly ProgressSeriesPoint[] = (entry?.timing ?? [])
    .map((point, index) => ({
      index,
      value: point.representativeTimingMs,
      sampleCount: point.samples,
      completedRound: point.completedRound,
    }));

  return {
    tokenId: input.tokenId,
    correctness: buildSeries(
      "correctness",
      symbol,
      correctnessPoints,
      entry?.partialCorrectness.attempts ?? 0,
      input.correctnessBucketSize,
      true,
      policy,
    ),
    timing: buildSeries(
      "timing",
      symbol,
      input.timingAvailable ? timingPoints : [],
      input.timingAvailable ? entry?.partialTiming.samples.length ?? 0 : 0,
      input.timingBucketSize,
      input.timingAvailable,
      policy,
    ),
  };
}

export interface KeyTimingAvailability {
  readonly tokenId: TokenId;
  readonly timingAvailable: boolean;
}

/**
 * Projects stored history into presentation series for every key the diagnostic
 * model knows about. Work is proportional to the number of keys times the fixed
 * completed-point limit, so it stays bounded no matter how long a learner
 * practises.
 */
export function buildProgressTrendIndex(
  keys: readonly KeyTimingAvailability[],
  history: ProgressHistory | null,
  bucketSizes: {
    readonly correctnessBucketSize: number;
    readonly timingBucketSize: number;
  },
  policy: DiagnosticProgressPolicy = DIAGNOSTIC_PROGRESS_POLICY,
): Readonly<Record<TokenId, KeyProgressTrends>> {
  const result: Record<TokenId, KeyProgressTrends> = {};
  for (const key of keys) {
    result[key.tokenId] = buildKeyProgressTrends({
      tokenId: key.tokenId,
      entry: history?.keys[key.tokenId] ?? null,
      timingAvailable: key.timingAvailable,
      correctnessBucketSize: bucketSizes.correctnessBucketSize,
      timingBucketSize: bucketSizes.timingBucketSize,
      policy,
    });
  }
  return result;
}
