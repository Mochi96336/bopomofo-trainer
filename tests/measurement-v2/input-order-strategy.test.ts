import { describe, expect, it } from "vitest";
import type { Exercise } from "../../src/core/model.js";
import {
  aggregateMeasurementObservationsV2,
  createEmptyMeasurementSummaryV2,
  inputOrderPositionAggregateKey,
  type InputOrderPositionAggregateScope,
} from "../../src/measurement-v2/aggregate.js";
import { deriveMeasurementObservationsV2 } from "../../src/measurement-v2/derive-observations.js";
import { parseMeasurementSummaryV2 } from "../../src/measurement-v2/serialize.js";
import type { PracticeInput } from "../../src/practice/interaction-input.js";
import {
  applyInteractionInputV2,
  createInteractionSessionV2,
} from "../../src/practice/interaction-session-v2.js";

const exercise: Exercise = {
  id: "strategy-test",
  mode: "guided",
  layoutId: "zhuyin-standard",
  entries: [{
    id: "word:學",
    prompt: { text: "學", locale: "zh-TW" },
    syllables: [{ tokens: ["zhuyin:ㄒ", "zhuyin:ㄩ", "zhuyin:ㄝ", "tone:2"] }],
    tags: ["test"],
    provenanceIds: ["test"],
  }],
};

function input(timestampMs: number, physicalCode: string, actualToken: string): PracticeInput {
  return {
    timestampMs,
    physicalCode,
    actualToken,
    repeat: false,
    composing: false,
    modifierOnly: false,
  };
}

function reverseBodyTraces() {
  let state = createInteractionSessionV2(exercise, 0);
  state = applyInteractionInputV2(state, input(10, "Comma", "zhuyin:ㄝ"));
  state = applyInteractionInputV2(state, input(20, "KeyM", "zhuyin:ㄩ"));
  state = applyInteractionInputV2(state, input(30, "KeyV", "zhuyin:ㄒ"));
  state = applyInteractionInputV2(state, input(40, "Digit6", "tone:2"));
  return state.traces;
}

function key(scope: InputOrderPositionAggregateScope): string {
  return inputOrderPositionAggregateKey(scope);
}

describe("input-order strategy persistence", () => {
  it("projects canonical position against actual accepted position without token-pair identities", () => {
    const observations = deriveMeasurementObservationsV2(exercise, reverseBodyTraces());
    expect(observations.inputOrderPositions).toEqual([
      { syllableOrdinal: 0, bodySize: 3, canonicalBodyIndex: 2, acceptedBodyIndex: 0 },
      { syllableOrdinal: 0, bodySize: 3, canonicalBodyIndex: 1, acceptedBodyIndex: 1 },
      { syllableOrdinal: 0, bodySize: 3, canonicalBodyIndex: 0, acceptedBodyIndex: 2 },
    ]);

    const summary = aggregateMeasurementObservationsV2(observations);
    expect(summary.strategy.inputOrderPositions[key({
      bodySize: "3",
      canonicalPosition: "last",
      acceptedPosition: "first",
    })]?.observations).toBe(1);
    expect(summary.strategy.inputOrderPositions[key({
      bodySize: "3",
      canonicalPosition: "middle",
      acceptedPosition: "middle",
    })]?.observations).toBe(1);
    expect(summary.strategy.inputOrderPositions[key({
      bodySize: "3",
      canonicalPosition: "first",
      acceptedPosition: "last",
    })]?.observations).toBe(1);
  });

  it("keeps strategy identity bounded for bodies larger than three components", () => {
    const summary = aggregateMeasurementObservationsV2({
      bindings: [],
      confusions: [],
      inputOrderPositions: Array.from({ length: 20 }, (_, index) => ({
        syllableOrdinal: index,
        bodySize: 8,
        canonicalBodyIndex: index % 8,
        acceptedBodyIndex: 7 - (index % 8),
      })),
      coordination: [],
      immediateHands: [],
      sameHandRevisits: [],
      toneCommits: [],
      ambiguousErrorCount: 0,
      duplicateComponentCount: 0,
      prematureToneCount: 0,
    });
    expect(Object.keys(summary.strategy.inputOrderPositions).length).toBeLessThanOrEqual(9);
  });

  it("round-trips strategy aggregates and safely treats an older V2 record as empty strategy", () => {
    const summary = aggregateMeasurementObservationsV2(
      deriveMeasurementObservationsV2(exercise, reverseBodyTraces()),
    );
    const tokens = new Set(["zhuyin:ㄒ", "zhuyin:ㄩ", "zhuyin:ㄝ", "tone:2"]);
    expect(parseMeasurementSummaryV2(summary, "guided", "zhuyin-standard", tokens)).toEqual(summary);

    const oldShape = structuredClone(summary) as unknown as Record<string, unknown>;
    delete oldShape.strategy;
    expect(parseMeasurementSummaryV2(oldShape, "guided", "zhuyin-standard", tokens)).toEqual({
      ...summary,
      strategy: createEmptyMeasurementSummaryV2().strategy,
    });
  });
});
