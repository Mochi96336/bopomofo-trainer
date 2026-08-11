import { describe, expect, it } from "vitest";
import {
  confusionAggregateKey,
  createEmptyMeasurementSummaryV2,
  type MeasurementSummaryV2,
} from "../../src/measurement-v2/aggregate.js";
import { parseMeasurementSummaryV2 } from "../../src/measurement-v2/serialize.js";

const CATALOG_TOKENS = new Set(["zhuyin:ㄅ", "tone:1"]);

function summaryWithConfusion(actualToken: string): MeasurementSummaryV2 {
  const summary = createEmptyMeasurementSummaryV2();
  const aggregate = {
    mode: "guided" as const,
    layoutId: "zhuyin-standard",
    expectedToken: "zhuyin:ㄅ",
    actualToken,
    occurrences: 1,
  };
  return {
    ...summary,
    semantic: {
      ...summary.semantic,
      confusions: {
        [confusionAggregateKey(
          aggregate.mode,
          aggregate.layoutId,
          aggregate.expectedToken,
          aggregate.actualToken,
        )]: aggregate,
      },
    },
  };
}

describe("Measurement V2 confusion persistence", () => {
  it("preserves a valid mapped Bopomofo input even when that token is outside current catalog support", () => {
    const summary = summaryWithConfusion("zhuyin:ㄦ");

    expect(parseMeasurementSummaryV2(
      summary,
      "guided",
      "zhuyin-standard",
      CATALOG_TOKENS,
    )).toEqual(summary);
  });

  it("still rejects a confusion actual token outside the Bopomofo input domain", () => {
    const summary = summaryWithConfusion("zhuyin:不存在");

    expect(parseMeasurementSummaryV2(
      summary,
      "guided",
      "zhuyin-standard",
      CATALOG_TOKENS,
    )).toBeNull();
  });
});
