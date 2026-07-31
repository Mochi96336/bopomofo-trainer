import { describe, expect, it } from "vitest";
import type { PilotRoundRecord } from "../../src/product/pilot-history.js";
import {
  renderSparkline,
  renderTrendSection,
  sparklinePoints,
} from "../../src/app/practice-sparkline.js";

const GEOMETRY = { width: 168, height: 40, pad: 4 } as const;

function points(values: readonly number[]) {
  return sparklinePoints(values, GEOMETRY.width, GEOMETRY.height, GEOMETRY.pad);
}

describe("sparkline geometry", () => {
  it("spreads points evenly across the padded width", () => {
    const result = points([1, 2, 3]);
    expect(result[0]?.x).toBeCloseTo(4);
    expect(result[2]?.x).toBeCloseTo(164);
    expect(result[1]?.x).toBeCloseTo(84);
  });

  it("puts the lowest value at the bottom and the highest at the top", () => {
    const result = points([10, 20]);
    expect(result[0]?.y).toBeCloseTo(36);
    expect(result[1]?.y).toBeCloseTo(4);
  });

  // A flat series has no range to normalize against; falling back to a span of
  // 1 keeps it a level line instead of a division by zero.
  it("draws a flat series as a level line", () => {
    const result = points([7, 7, 7]);
    const ys = result.map((point) => point.y);
    expect(new Set(ys).size).toBe(1);
    expect(Number.isFinite(ys[0])).toBe(true);
  });

  it("centres a single point horizontally at the left edge with no step", () => {
    const result = points([5]);
    expect(result).toHaveLength(1);
    expect(result[0]?.x).toBeCloseTo(4);
  });
});

describe("sparkline markup", () => {
  it("renders the empty state below two values", () => {
    for (const values of [[], [42]]) {
      const markup = renderSparkline("正確率", values, (value) => `${value}%`);
      expect(markup).toContain("trend-empty");
      expect(markup).not.toContain("<svg");
    }
  });

  it("shows the newest value and marks it on the line", () => {
    const markup = renderSparkline("正確率", [10, 90], (value) => `${value}%`);
    expect(markup).toContain("90%");
    expect(markup).toContain("trend-dot");
    expect(markup).toContain("<path");
  });

  it("escapes the label and the formatted value", () => {
    const markup = renderSparkline("<b>x</b>", [1, 2], () => '"&<>');
    expect(markup).not.toContain("<b>x</b>");
    expect(markup).toContain("&lt;b&gt;");
    expect(markup).toContain("&quot;&amp;&lt;&gt;");
  });
});

function round(attempts: number, errors: number, latency: number | null): PilotRoundRecord {
  return { attempts, errors, cleanLatencyMedianMs: latency } as unknown as PilotRoundRecord;
}

describe("trend section", () => {
  it("renders one chart per metric", () => {
    const markup = renderTrendSection([
      round(10, 1, 300),
      round(10, 2, 320),
    ]);
    expect(markup.match(/trend-chart"/gu)).toHaveLength(2);
    expect(markup).toContain("正確率");
    expect(markup).toContain("反應時間");
  });

  // An abandoned round has no attempts to divide by, so it must be dropped
  // before accuracy is derived rather than counted as zero percent.
  it("drops rounds with no attempts", () => {
    const withAbandoned = renderTrendSection([round(0, 0, null), round(10, 0, 300), round(10, 5, 320)]);
    const withoutAbandoned = renderTrendSection([round(10, 0, 300), round(10, 5, 320)]);
    expect(withAbandoned).toBe(withoutAbandoned);
  });

  // A round can be answered without ever producing a clean timing sample; those
  // must not be read as zero milliseconds.
  it("excludes rounds without a clean latency sample from the timing series", () => {
    const markup = renderTrendSection([round(10, 1, null), round(10, 1, null)]);
    expect(markup).toContain("trend-empty");
  });

  // The two metrics are independent: losing every timing sample must not take
  // the accuracy chart down with it.
  it("still draws accuracy when no timing sample exists", () => {
    const markup = renderTrendSection([round(10, 0, null), round(10, 5, null)]);
    expect(markup.match(/<svg/gu)).toHaveLength(1);
    expect(markup.match(/trend-empty/gu)).toHaveLength(1);
    expect(markup).toContain("50%");
  });
});
