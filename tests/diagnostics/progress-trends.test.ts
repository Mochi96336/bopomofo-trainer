import { describe, expect, it } from "vitest";
import { DIAGNOSTIC_PROGRESS_POLICY } from "../../src/diagnostics/policy.js";
import {
  buildKeyProgressTrends,
  progressChartDomain,
  summarizeProgressTrend,
} from "../../src/diagnostics/progress-trends.js";
import { PROGRESS_HISTORY_POLICY } from "../../src/progress-history/policy.js";
import type { KeyProgressHistory } from "../../src/progress-history/types.js";

const BUCKETS = {
  correctnessBucketSize: PROGRESS_HISTORY_POLICY.correctnessBucketSize,
  timingBucketSize: PROGRESS_HISTORY_POLICY.timingBucketSize,
};

function entry(
  correctnessRatios: readonly number[],
  timingValues: readonly number[],
): KeyProgressHistory {
  return {
    tokenId: "zhuyin:ㄌ",
    correctness: correctnessRatios.map((errorRatio, index) => ({
      endingObservation: (index + 1) * BUCKETS.correctnessBucketSize,
      completedRound: index + 1,
      attempts: BUCKETS.correctnessBucketSize,
      errors: Math.round(errorRatio * BUCKETS.correctnessBucketSize),
      errorRatio,
    })),
    timing: timingValues.map((representativeTimingMs, index) => ({
      endingSample: (index + 1) * BUCKETS.timingBucketSize,
      completedRound: index + 1,
      samples: BUCKETS.timingBucketSize,
      representativeTimingMs,
    })),
    partialCorrectness: { attempts: 0, errors: 0 },
    partialTiming: { samples: [] },
    totalObservations: correctnessRatios.length * BUCKETS.correctnessBucketSize,
    totalTimingSamples: timingValues.length * BUCKETS.timingBucketSize,
  };
}

function trends(
  correctnessRatios: readonly number[],
  timingValues: readonly number[],
  timingAvailable = true,
) {
  return buildKeyProgressTrends({
    tokenId: "zhuyin:ㄌ",
    entry: entry(correctnessRatios, timingValues),
    timingAvailable,
    ...BUCKETS,
  });
}

describe("progress trend estimator", () => {
  it("reports insufficient below the minimum comparable points", () => {
    for (let count = 0; count < DIAGNOSTIC_PROGRESS_POLICY.minimumComparablePoints; count += 1) {
      const summary = summarizeProgressTrend(
        "timing",
        Array.from({ length: count }, (_, index) => 400 - index * 30),
      );
      expect(summary.state).toBe("insufficient");
      expect(summary.previousValue).toBeNull();
      expect(summary.recentValue).toBeNull();
      expect(summary.delta).toBeNull();
    }
  });

  it("treats a clear fall in the error-observation ratio as improving", () => {
    const summary = summarizeProgressTrend("correctness", [0.25, 0.25, 0.05, 0.05]);
    expect(summary.state).toBe("improving");
    expect(summary.previousValue).toBeCloseTo(0.25, 10);
    expect(summary.recentValue).toBeCloseTo(0.05, 10);
    expect(summary.delta).toBeLessThan(0);
    expect(summary.label).toBe("最近較少出錯");
  });

  it("treats a clear rise in the error-observation ratio as worsening", () => {
    const summary = summarizeProgressTrend("correctness", [0.05, 0.05, 0.25, 0.25]);
    expect(summary.state).toBe("worsening");
    expect(summary.label).toBe("最近錯誤觀察增加");
  });

  it("applies the opposite direction to timing, where lower is faster", () => {
    expect(summarizeProgressTrend("timing", [480, 470, 330, 320].map(Number)).state)
      .toBe("improving");
    expect(summarizeProgressTrend("timing", [320, 330, 470, 480]).state).toBe("worsening");
    expect(summarizeProgressTrend("timing", [320, 330, 470, 480]).label).toBe("最近較慢");
  });

  it("keeps a difference inside the display dead zone as stable", () => {
    // Two percentage points of correctness and eight milliseconds of timing are
    // both below the thresholds that decide the wording.
    expect(summarizeProgressTrend("correctness", [0.12, 0.12, 0.10, 0.10]).state).toBe("stable");
    expect(summarizeProgressTrend("timing", [400, 400, 392, 392]).state).toBe("stable");
    expect(summarizeProgressTrend("timing", [400, 400, 392, 392]).label).toBe("近期大致持平");
  });

  it("reports variable when point-to-point movement dwarfs the window difference", () => {
    expect(summarizeProgressTrend("timing", [250, 700, 260, 690]).state).toBe("variable");
    expect(summarizeProgressTrend("correctness", [0.02, 0.5, 0.03, 0.48]).state).toBe("variable");
    expect(summarizeProgressTrend("timing", [250, 700, 260, 690]).label).toBe("最近波動較大");
  });

  it("compares the two most recent windows rather than the first and last point", () => {
    // An old outlying bucket sits outside the compared windows. First-versus-last
    // would announce a large improvement; the windows read the recent stretch as
    // level, which is what the learner is actually being told about.
    const summary = summarizeProgressTrend("timing", [900, 400, 400, 405, 398, 402]);
    expect(summary.state).toBe("stable");
    expect(summary.previousValue).toBeCloseTo(402.5, 10);
    expect(summary.recentValue).toBeCloseTo(400, 10);
  });

  it("never emits a value beyond the observed points", () => {
    const values = [500, 480, 450, 430];
    const summary = summarizeProgressTrend("timing", values);
    for (const value of [summary.previousValue, summary.recentValue]) {
      expect(value).not.toBeNull();
      expect(value!).toBeLessThanOrEqual(Math.max(...values));
      expect(value!).toBeGreaterThanOrEqual(Math.min(...values));
    }
  });
});

describe("progress chart domain", () => {
  it("never lets a small difference fill the whole chart", () => {
    const domain = progressChartDomain("correctness", [0.08, 0.07]);
    expect(domain.maximum - domain.minimum).toBeGreaterThanOrEqual(
      DIAGNOSTIC_PROGRESS_POLICY.chart.correctnessMinimumSpan,
    );
    const timing = progressChartDomain("timing", [401, 400]);
    expect(timing.maximum - timing.minimum).toBeGreaterThanOrEqual(
      DIAGNOSTIC_PROGRESS_POLICY.chart.timingMinimumSpanMs,
    );
  });

  it("stays inside the ratio and non-negative bounds each metric allows", () => {
    const high = progressChartDomain("correctness", [0.98, 1]);
    expect(high.maximum).toBeLessThanOrEqual(1);
    expect(high.minimum).toBeGreaterThanOrEqual(0);
    expect(progressChartDomain("timing", [10, 12]).minimum).toBeGreaterThanOrEqual(0);
  });
});

describe("key progress projection", () => {
  it("reports the starting state when a key has no history at all", () => {
    const projected = buildKeyProgressTrends({
      tokenId: "zhuyin:ㄌ",
      entry: null,
      timingAvailable: true,
      ...BUCKETS,
    });
    expect(projected.correctness.state).toBe("no-history");
    expect(projected.correctness.points).toEqual([]);
    expect(projected.correctness.trend.state).toBe("insufficient");
    expect(projected.correctness.accessibleSummary).toContain("變化資料將從現在開始累積。");
  });

  it("marks a single completed point as not yet comparable", () => {
    const projected = trends([0.25], [420]);
    expect(projected.correctness.state).toBe("single-point");
    expect(projected.correctness.trend.state).toBe("insufficient");
    expect(projected.correctness.accessibleSummary).toContain("目前資料不足以判斷變化。");
  });

  it("keeps correctness and timing separate, including opposite directions", () => {
    const projected = trends([0.25, 0.25, 0.05, 0.05], [320, 330, 470, 480]);
    expect(projected.correctness.trend.state).toBe("improving");
    expect(projected.timing.trend.state).toBe("worsening");
    expect(projected.correctness.unit).toBe("percent");
    expect(projected.timing.unit).toBe("milliseconds");
    expect(projected.correctness.latestValue).not.toBe(projected.timing.latestValue);
  });

  it("produces no timing series for a key that can never be timed", () => {
    const projected = trends([0.25, 0.2, 0.1, 0.05], [420, 400, 380, 360], false);
    expect(projected.timing.state).toBe("not-applicable");
    expect(projected.timing.points).toEqual([]);
    expect(projected.timing.accessibleSummary).toBe("ㄌ的有效鍵間時間不適用。");
    expect(projected.correctness.state).toBe("charted");
  });

  it("writes an accessible summary that names the metric, count, and direction", () => {
    const projected = trends([0.25, 0.25, 0.05, 0.05], []);
    expect(projected.correctness.accessibleSummary).toBe(
      "ㄌ的錯誤觀察比例共有 4 個歷史區段，前期代表值 25%，近期代表值 5%，最近較少出錯。",
    );
  });

  it("carries the open partial bucket without turning it into a point", () => {
    const projected = buildKeyProgressTrends({
      tokenId: "zhuyin:ㄌ",
      entry: {
        ...entry([0.25, 0.25], [420, 400]),
        partialCorrectness: { attempts: 3, errors: 1 },
        partialTiming: { samples: [340, 355] },
        totalObservations: 19,
        totalTimingSamples: 12,
      },
      timingAvailable: true,
      ...BUCKETS,
    });
    expect(projected.correctness.points).toHaveLength(2);
    expect(projected.correctness.partialSampleCount).toBe(3);
    expect(projected.timing.partialSampleCount).toBe(2);
    expect(projected.timing.bucketSize).toBe(BUCKETS.timingBucketSize);
  });
});
