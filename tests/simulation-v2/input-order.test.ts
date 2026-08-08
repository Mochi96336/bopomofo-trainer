import { describe, expect, it } from "vitest";
import type { Exercise } from "../../src/core/model.js";
import { deriveMeasurementObservationsV2 } from "../../src/measurement-v2/derive-observations.js";
import { STANDARD_BOPOMOFO_LAYOUT } from "../../src/scheme/standard-layout.js";
import {
  orderBodySlots,
  simulateInputOrder,
  type InputOrderStrategy,
} from "../../src/simulation-v2/input-order.js";

const exercise: Exercise = {
  id: "order-strategies",
  mode: "guided",
  layoutId: STANDARD_BOPOMOFO_LAYOUT.id,
  entries: [{
    id: "word:學",
    prompt: { text: "學", locale: "zh-TW" },
    syllables: [{ tokens: ["zhuyin:ㄒ", "zhuyin:ㄩ", "zhuyin:ㄝ", "tone:2"] }],
    tags: ["test"],
    provenanceIds: ["test"],
  }],
};

const strategies: readonly InputOrderStrategy[] = [
  "canonical",
  "reverse-body",
  "random-valid",
  "hand-alternating",
];

describe("input-order v2 simulation", () => {
  it.each(strategies)("completes the same syllable with %s without invented errors", (strategy) => {
    const state = simulateInputOrder(exercise, STANDARD_BOPOMOFO_LAYOUT, strategy, {
      random: () => 0,
    });
    expect(state.completed).toBe(true);
    expect(state.traces.every((trace) => trace.accepted)).toBe(true);
    expect(state.traces.map((trace) => trace.outcome)).toEqual([
      "accepted-component",
      "accepted-component",
      "accepted-component",
      "accepted-tone",
    ]);
  });

  it("keeps semantic binding totals equal for canonical and reverse-body strategies", () => {
    const canonical = simulateInputOrder(exercise, STANDARD_BOPOMOFO_LAYOUT, "canonical");
    const reverse = simulateInputOrder(exercise, STANDARD_BOPOMOFO_LAYOUT, "reverse-body");
    const canonicalBindings = deriveMeasurementObservationsV2(exercise, canonical.traces).bindings;
    const reverseBindings = deriveMeasurementObservationsV2(exercise, reverse.traces).bindings;

    expect(canonicalBindings.map((row) => row.scope.tokenId).sort()).toEqual(
      reverseBindings.map((row) => row.scope.tokenId).sort(),
    );
    expect(canonicalBindings.every((row) => row.correct)).toBe(true);
    expect(reverseBindings.every((row) => row.correct)).toBe(true);
    expect(reverse.traces.slice(0, 3).map((trace) => trace.actualToken)).toEqual([
      "zhuyin:ㄝ",
      "zhuyin:ㄩ",
      "zhuyin:ㄒ",
    ]);
  });

  it("keeps random-valid deterministic when given a deterministic random source", () => {
    const plan = simulateInputOrder(exercise, STANDARD_BOPOMOFO_LAYOUT, "canonical").plan;
    const slots = plan.syllables[0]!.bodySlots;
    expect(orderBodySlots(slots, "random-valid", STANDARD_BOPOMOFO_LAYOUT, () => 0)
      .map((slot) => slot.tokenId)).toEqual([
        "zhuyin:ㄩ",
        "zhuyin:ㄝ",
        "zhuyin:ㄒ",
      ]);
  });
});
