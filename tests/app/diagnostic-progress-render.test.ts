import { describe, expect, it } from "vitest";
import { keyProgressMarkup } from "../../src/app/diagnostic-panel.js";
import { buildKeyProgressTrends } from "../../src/diagnostics/progress-trends.js";
import type { KeyProgressTrends } from "../../src/diagnostics/types.js";
import { PROGRESS_HISTORY_POLICY } from "../../src/progress-history/policy.js";
import type { KeyProgressHistory } from "../../src/progress-history/types.js";

const BUCKETS = {
  correctnessBucketSize: PROGRESS_HISTORY_POLICY.correctnessBucketSize,
  timingBucketSize: PROGRESS_HISTORY_POLICY.timingBucketSize,
};

function entry(
  correctnessRatios: readonly number[],
  timingValues: readonly number[],
  partial: { correctness: number; timing: number } = { correctness: 0, timing: 0 },
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
    partialCorrectness: { attempts: partial.correctness, errors: 0 },
    partialTiming: { samples: Array.from({ length: partial.timing }, () => 300) },
    totalObservations:
      correctnessRatios.length * BUCKETS.correctnessBucketSize + partial.correctness,
    totalTimingSamples: timingValues.length * BUCKETS.timingBucketSize + partial.timing,
  };
}

function trends(
  keyEntry: KeyProgressHistory | null,
  timingAvailable = true,
): KeyProgressTrends {
  return buildKeyProgressTrends({
    tokenId: "zhuyin:ㄌ",
    entry: keyEntry,
    timingAvailable,
    ...BUCKETS,
  });
}

describe("selected-key recent-change rendering", () => {
  it("renders one 最近變化 section holding both metrics separately", () => {
    const markup = keyProgressMarkup(
      trends(entry([0.25, 0.25, 0.05, 0.05], [480, 470, 330, 320])),
    );

    expect(markup).toContain("最近變化");
    expect(markup).toContain("錯誤觀察比例");
    expect(markup).toContain("有效鍵間時間");
    expect(markup).toContain('data-metric="correctness"');
    expect(markup).toContain('data-metric="timing"');
    // Two charts, never one shared axis.
    expect(markup.match(/diagnostic-progress-svg/gu)).toHaveLength(2);
  });

  it("shows each metric's own values and never reuses one for the other", () => {
    const markup = keyProgressMarkup(
      trends(entry([0.25, 0.25, 0.05, 0.05], [480, 470, 330, 320])),
    );

    expect(markup).toContain("25% → 5%");
    expect(markup).toContain("475 ms → 325 ms");
    expect(markup).toContain("最近較少出錯");
    expect(markup).toContain("最近較快");
  });

  it("draws the adaptive axis bounds inside the chart in each metric's own unit", () => {
    const markup = keyProgressMarkup(trends(entry([0.1, 0.1, 0.08, 0.08], [400, 402, 398, 401])));
    const labels = [...markup.matchAll(
      /class="diagnostic-progress-axis-label"[^>]*>([^<]+)</gu,
    )].map((match) => match[1]);

    // Two bounds per chart, percent for correctness and ms for timing, so an
    // adaptive domain can never be mistaken for a fixed one.
    expect(labels).toHaveLength(4);
    expect(labels.slice(0, 2).every((label) => label!.endsWith("%"))).toBe(true);
    expect(labels.slice(2).every((label) => label!.endsWith(" ms"))).toBe(true);
    // Upper bound is drawn first, at the top of the plot area.
    expect(Number.parseInt(labels[2]!, 10)).toBeGreaterThan(Number.parseInt(labels[3]!, 10));
  });

  it("no longer repeats the axis or the reading direction as caption text", () => {
    const markup = keyProgressMarkup(trends(entry([0.1, 0.1, 0.08, 0.08], [400, 402, 398, 401])));

    expect(markup).not.toContain("軸 ");
    expect(markup).not.toContain("越低越快");
  });

  it("shows the upgrade state when there is no history yet", () => {
    const markup = keyProgressMarkup(trends(null));

    expect(markup).toContain("從本版本開始累積趨勢");
    expect(markup).toContain('data-state="no-history"');
    expect(markup).not.toContain("diagnostic-progress-svg");
  });

  it("draws a single completed point without claiming a direction", () => {
    const markup = keyProgressMarkup(trends(entry([0.25], [420])));

    expect(markup).toContain('data-state="single-point"');
    expect(markup).toContain("再累積一些有效觀察後才能比較");
    expect(markup).not.toContain("最近較少出錯");
    expect(markup).not.toContain("最近較快");
  });

  it("says a chart cannot yet show a direction rather than guessing one", () => {
    const markup = keyProgressMarkup(trends(entry([0.25, 0.1], [420, 380])));

    expect(markup).toContain('data-trend="insufficient"');
    expect(markup).toContain("目前資料不足以判斷方向");
  });

  it("reuses the existing 不適用 wording instead of an empty timing chart", () => {
    const markup = keyProgressMarkup(
      trends(entry([0.25, 0.25, 0.05, 0.05], []), false),
    );

    expect(markup).toContain('data-state="not-applicable"');
    expect(markup).toContain("不適用");
    expect(markup.match(/diagnostic-progress-svg/gu)).toHaveLength(1);
  });

  it("reports the open bucket as pending rather than as a completed point", () => {
    const markup = keyProgressMarkup(
      trends(entry([0.25, 0.2, 0.1, 0.05], [420, 400, 380, 360], {
        correctness: 3,
        timing: 2,
      })),
    );

    expect(markup).toContain(`下一個區段 3 / ${BUCKETS.correctnessBucketSize}`);
    expect(markup).toContain(`下一個區段 2 / ${BUCKETS.timingBucketSize}`);
    // Four completed points, not five: the open bucket is never plotted.
    expect(markup.match(/class="diagnostic-progress-point/gu)).toHaveLength(8);
  });

  it("emits an accessible text summary for every chart", () => {
    const markup = keyProgressMarkup(
      trends(entry([0.25, 0.25, 0.05, 0.05], [480, 470, 330, 320])),
    );

    expect(markup).toContain(
      "ㄌ的錯誤觀察比例共有 4 個歷史區段，前期代表值 25%，近期代表值 5%，最近較少出錯。",
    );
    expect(markup).toContain("ㄌ的有效鍵間時間共有 4 個歷史區段");
    expect(markup.match(/class="visually-hidden"/gu)).toHaveLength(2);
  });

  it("keeps chart internals out of the tab order and the accessibility tree", () => {
    const markup = keyProgressMarkup(trends(entry([0.25, 0.2, 0.1, 0.05], [420, 400, 380, 360])));

    expect(markup).toContain('role="presentation"');
    expect(markup).toContain('focusable="false"');
    expect(markup).not.toContain("tabindex");
    // Point titles are a hover convenience; the values are already in the
    // delta line and the accessible summary.
    expect(markup).toContain("<title>");
  });

  it("styles direction through neutral ink classes, not a traffic-light palette", () => {
    const worsening = keyProgressMarkup(
      trends(entry([0.05, 0.05, 0.25, 0.25], [320, 330, 470, 480])),
    );

    expect(worsening).toContain('data-trend="worsening"');
    expect(worsening).toContain("最近錯誤觀察增加");
    expect(worsening).not.toMatch(/style="[^"]*(?:red|green|#)/u);
  });

  it("renders nothing when a model has no projection for the selected key", () => {
    expect(keyProgressMarkup(undefined)).toBe("");
  });
});
