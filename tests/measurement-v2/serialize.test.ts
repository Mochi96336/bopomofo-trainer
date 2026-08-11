import { describe, expect, it } from "vitest";
import {
  createEmptyMeasurementSummaryV2,
  immediateHandAggregateKey,
  type MeasurementSummaryV2,
} from "../../src/measurement-v2/aggregate.js";
import { parseMeasurementSummaryV2 } from "../../src/measurement-v2/serialize.js";

const TOKENS = new Set(["zhuyin:ㄒ", "tone:2"]);

function summaryWithImmediateHands(count: number): MeasurementSummaryV2 {
  const scopes = [
    { fromHand: "left" as const, toHand: "left" as const },
    { fromHand: "left" as const, toHand: "right" as const },
    { fromHand: "right" as const, toHand: "left" as const },
    { fromHand: "right" as const, toHand: "right" as const },
  ];
  const immediateHands = Object.fromEntries(
    scopes.slice(0, count).map((scope, index) => [
      immediateHandAggregateKey(scope),
      {
        scope,
        observations: 6 + index,
        timingSamples: 5 + index,
        currentTimeToTypeMs: 100 + index,
        bestTimeToTypeMs: 90 + index,
      },
    ]),
  );
  return {
    ...createEmptyMeasurementSummaryV2(),
    motor: {
      ...createEmptyMeasurementSummaryV2().motor,
      immediateHands,
    },
  };
}

describe("measurement v2 persistence validation", () => {
  it("round-trips valid bounded motor aggregates", () => {
    const summary = summaryWithImmediateHands(4);
    expect(parseMeasurementSummaryV2(summary, "guided", "zhuyin-standard", TOKENS)).toEqual(summary);
  });

  it("rejects a fifth immediate-hand aggregate even when the record is otherwise well formed", () => {
    const summary = summaryWithImmediateHands(4);
    const invalid = structuredClone(summary) as unknown as Record<string, unknown>;
    const motor = invalid.motor as Record<string, unknown>;
    const immediate = motor.immediateHands as Record<string, unknown>;
    immediate['["immediate-hand","left","left","extra"]'] = {
      scope: { fromHand: "left", toHand: "left" },
      observations: 5,
      timingSamples: 5,
      currentTimeToTypeMs: 100,
      bestTimeToTypeMs: 90,
    };
    expect(parseMeasurementSummaryV2(invalid, "guided", "zhuyin-standard", TOKENS)).toBeNull();
  });

  it("rejects stored aggregate keys that do not match the decoded scope", () => {
    const summary = summaryWithImmediateHands(1);
    const invalid = structuredClone(summary) as unknown as Record<string, unknown>;
    const motor = invalid.motor as Record<string, unknown>;
    const immediate = motor.immediateHands as Record<string, unknown>;
    const [key, aggregate] = Object.entries(immediate)[0]!;
    delete immediate[key];
    immediate["wrong-key"] = aggregate;
    expect(parseMeasurementSummaryV2(invalid, "guided", "zhuyin-standard", TOKENS)).toBeNull();
  });
});
