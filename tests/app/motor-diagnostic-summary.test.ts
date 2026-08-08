import { describe, expect, it } from "vitest";
import {
  createEmptyMeasurementSummaryV2,
  immediateHandAggregateKey,
  type MeasurementSummaryV2,
} from "../../src/measurement-v2/aggregate.js";
import { motorDiagnosticSignals } from "../../src/app/motor-diagnostic-summary.js";

describe("motor diagnostic summary", () => {
  it("does not invent a directional weakness before enough clean samples exist", () => {
    const scope = { fromHand: "right" as const, toHand: "left" as const };
    const summary: MeasurementSummaryV2 = {
      ...createEmptyMeasurementSummaryV2(),
      motor: {
        ...createEmptyMeasurementSummaryV2().motor,
        immediateHands: {
          [immediateHandAggregateKey(scope)]: {
            scope,
            observations: 3,
            timingSamples: 3,
            currentTimeToTypeMs: 180,
            bestTimeToTypeMs: 150,
          },
        },
      },
    };

    const hand = motorDiagnosticSignals(summary)[1]!;
    expect(hand.label).toBe("左右手交接");
    expect(hand.value).toBe("—");
    expect(hand.meta).toContain("樣本累積中");
  });

  it("reports the slowest sufficiently sampled actual hand path", () => {
    const rl = { fromHand: "right" as const, toHand: "left" as const };
    const lr = { fromHand: "left" as const, toHand: "right" as const };
    const summary: MeasurementSummaryV2 = {
      ...createEmptyMeasurementSummaryV2(),
      motor: {
        ...createEmptyMeasurementSummaryV2().motor,
        immediateHands: {
          [immediateHandAggregateKey(rl)]: {
            scope: rl,
            observations: 8,
            timingSamples: 8,
            currentTimeToTypeMs: 190,
            bestTimeToTypeMs: 120,
          },
          [immediateHandAggregateKey(lr)]: {
            scope: lr,
            observations: 8,
            timingSamples: 8,
            currentTimeToTypeMs: 110,
            bestTimeToTypeMs: 90,
          },
        },
      },
    };

    const hand = motorDiagnosticSignals(summary)[1]!;
    expect(hand.label).toBe("右 → 左");
    expect(hand.value).toBe("190 ms");
    expect(hand.meta).toContain("8 樣本");
  });
});
