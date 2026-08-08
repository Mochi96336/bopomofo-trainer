import { describe, expect, it } from "vitest";
import type { Exercise } from "../../src/core/model.js";
import {
  coordinationAggregateKey,
  immediateHandAggregateKey,
  toneCommitAggregateKey,
} from "../../src/measurement-v2/aggregate.js";
import type { PracticeInput } from "../../src/practice/interaction-input.js";
import {
  applyInteractionInputV2,
  createInteractionSessionV2,
} from "../../src/practice/interaction-session-v2.js";
import { PROGRESS_HISTORY_POLICY } from "../../src/progress-history/policy.js";
import {
  parseProgressHistory,
  serializeProgressHistory,
} from "../../src/progress-history/serialize.js";
import {
  appendRoundToProgressHistory,
  createEmptyProgressHistory,
} from "../../src/progress-history/update.js";

const exercise: Exercise = {
  id: "motor-history-test",
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

function traces(offset: number) {
  let state = createInteractionSessionV2(exercise, offset);
  state = applyInteractionInputV2(state, input(offset + 10, "KeyM", "zhuyin:ㄩ"));
  state = applyInteractionInputV2(state, input(offset + 40, "KeyV", "zhuyin:ㄒ"));
  state = applyInteractionInputV2(state, input(offset + 80, "Comma", "zhuyin:ㄝ"));
  state = applyInteractionInputV2(state, input(offset + 105, "Digit6", "tone:2"));
  return state.traces;
}

const validTokens = new Set(["zhuyin:ㄒ", "zhuyin:ㄩ", "zhuyin:ㄝ", "tone:2"]);

describe("bounded motor progress history", () => {
  it("closes motor history points with the same median buckets as key timing", () => {
    let history = createEmptyProgressHistory("guided", "zhuyin-standard");
    for (let round = 1; round <= PROGRESS_HISTORY_POLICY.timingBucketSize; round += 1) {
      history = appendRoundToProgressHistory({
        history,
        exercise,
        traces: traces(round * 1000),
        completedRound: round,
      });
    }

    const coordinationKey = coordinationAggregateKey({ bodySize: "3", handShape: "mixed" });
    const coordination = history.motor.coordination[coordinationKey]!;
    expect(coordination.timing).toEqual([{
      endingSample: 5,
      completedRound: 5,
      samples: 5,
      representativeTimingMs: 70,
    }]);
    expect(coordination.partialTiming.samples).toEqual([]);

    const handKey = immediateHandAggregateKey({ fromHand: "right", toHand: "left" });
    expect(history.motor.immediateHands[handKey]?.timing[0]).toMatchObject({
      samples: 5,
      representativeTimingMs: 30,
    });

    const toneKey = toneCommitAggregateKey({ toneToken: "tone:2" });
    expect(history.motor.toneCommits[toneKey]?.timing[0]).toMatchObject({
      samples: 5,
      representativeTimingMs: 25,
    });
  });

  it("round-trips current motor histories and migrates schema 2 with empty motor series", () => {
    let history = createEmptyProgressHistory("guided", "zhuyin-standard");
    history = appendRoundToProgressHistory({
      history,
      exercise,
      traces: traces(1000),
      completedRound: 1,
    });
    expect(parseProgressHistory(
      serializeProgressHistory(history),
      "guided",
      "zhuyin-standard",
      validTokens,
    )).toEqual(history);

    const legacy = JSON.parse(serializeProgressHistory(history)) as Record<string, unknown>;
    legacy.schemaVersion = 2;
    delete legacy.motor;
    const migrated = parseProgressHistory(
      JSON.stringify(legacy),
      "guided",
      "zhuyin-standard",
      validTokens,
    );
    expect(migrated).toEqual({
      ...history,
      motor: {
        coordination: {},
        immediateHands: {},
        sameHandRevisits: {},
        toneCommits: {},
      },
    });
  });

  it("bounds every motor timing series to the existing completed-point limit", () => {
    let history = createEmptyProgressHistory("guided", "zhuyin-standard");
    const rounds = PROGRESS_HISTORY_POLICY.timingBucketSize
      * (PROGRESS_HISTORY_POLICY.completedPointLimit + 2);
    for (let round = 1; round <= rounds; round += 1) {
      history = appendRoundToProgressHistory({
        history,
        exercise,
        traces: traces(round * 1000),
        completedRound: round,
      });
    }
    const toneKey = toneCommitAggregateKey({ toneToken: "tone:2" });
    const tone = history.motor.toneCommits[toneKey]!;
    expect(tone.timing).toHaveLength(PROGRESS_HISTORY_POLICY.completedPointLimit);
    expect(tone.timing.at(-1)?.completedRound).toBe(rounds);
  });
});
