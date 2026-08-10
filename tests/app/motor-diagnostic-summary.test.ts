import { describe, expect, it } from "vitest";
import {
  coordinationAggregateKey,
  createEmptyMeasurementSummaryV2,
  immediateHandAggregateKey,
  sameHandRevisitAggregateKey,
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

  it("explains when enough total samples are split across insufficient paths", () => {
    const rl = { fromHand: "right" as const, toHand: "left" as const };
    const lr = { fromHand: "left" as const, toHand: "right" as const };
    const summary: MeasurementSummaryV2 = {
      ...createEmptyMeasurementSummaryV2(),
      motor: {
        ...createEmptyMeasurementSummaryV2().motor,
        immediateHands: {
          [immediateHandAggregateKey(rl)]: {
            scope: rl,
            observations: 3,
            timingSamples: 3,
            currentTimeToTypeMs: 180,
            bestTimeToTypeMs: 150,
          },
          [immediateHandAggregateKey(lr)]: {
            scope: lr,
            observations: 3,
            timingSamples: 3,
            currentTimeToTypeMs: 160,
            bestTimeToTypeMs: 140,
          },
        },
      },
    };

    const hand = motorDiagnosticSignals(summary)[1]!;
    expect(hand.value).toBe("—");
    expect(hand.meta).toContain("6 個乾淨樣本");
    expect(hand.meta).toContain("單類樣本不足");
  });

  it("shows a timing when exactly one comparable scope clears the gate", () => {
    const rl = { fromHand: "right" as const, toHand: "left" as const };
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
        },
      },
    };

    const hand = motorDiagnosticSignals(summary)[1]!;
    expect(hand.label).toBe("左右手交接");
    expect(hand.value).toBe("190 ms");
    expect(hand.meta).toContain("右 → 左");
    expect(hand.meta).not.toContain("較慢");
  });

  it("does not call a longer coordination task weaker just because its absolute time is larger", () => {
    const two = { bodySize: "2" as const, handShape: "mixed" as const };
    const four = { bodySize: "4+" as const, handShape: "mixed" as const };
    const summary: MeasurementSummaryV2 = {
      ...createEmptyMeasurementSummaryV2(),
      motor: {
        ...createEmptyMeasurementSummaryV2().motor,
        coordination: {
          [coordinationAggregateKey(two)]: {
            scope: two,
            observations: 8,
            timingSamples: 8,
            currentTimeToTypeMs: 120,
            bestTimeToTypeMs: 100,
          },
          [coordinationAggregateKey(four)]: {
            scope: four,
            observations: 8,
            timingSamples: 8,
            currentTimeToTypeMs: 400,
            bestTimeToTypeMs: 350,
          },
        },
      },
    };

    const coordination = motorDiagnosticSignals(summary)[0]!;
    expect(coordination.label).toBe("音節協調");
    expect(coordination.value).toBe("2 類");
    expect(coordination.meta).toContain("不跨類排名");
    expect(coordination.meta).not.toContain("4+");
    expect(coordination.meta).not.toContain("較慢");
  });

  it("does not rank same-hand revisit intervals across different intervening-event classes", () => {
    const direct = { hand: "left" as const, oppositeHandIntervened: false };
    const intervened = { hand: "left" as const, oppositeHandIntervened: true };
    const summary: MeasurementSummaryV2 = {
      ...createEmptyMeasurementSummaryV2(),
      motor: {
        ...createEmptyMeasurementSummaryV2().motor,
        sameHandRevisits: {
          [sameHandRevisitAggregateKey(direct)]: {
            scope: direct,
            observations: 6,
            timingSamples: 6,
            currentTimeToTypeMs: 90,
            bestTimeToTypeMs: 80,
          },
          [sameHandRevisitAggregateKey(intervened)]: {
            scope: intervened,
            observations: 6,
            timingSamples: 6,
            currentTimeToTypeMs: 260,
            bestTimeToTypeMs: 230,
          },
        },
      },
    };

    const revisit = motorDiagnosticSignals(summary)[2]!;
    expect(revisit.label).toBe("同手再出手");
    expect(revisit.value).toBe("2 類");
    expect(revisit.meta).toContain("不跨類排名");
    expect(revisit.meta).not.toContain("中間有另一手");
  });
});
