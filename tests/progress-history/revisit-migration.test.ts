import { describe, expect, it } from "vitest";
import { parseProgressHistory } from "../../src/progress-history/serialize.js";
import { PROGRESS_HISTORY_SCHEMA_VERSION } from "../../src/progress-history/types.js";

const VALID_TOKENS = new Set(["zhuyin:ㄅ", "zhuyin:ㄢ", "tone:2"]);

describe("progress history revisit migration", () => {
  for (const schemaVersion of [5, 6] as const) {
    it(`preserves schema-${schemaVersion} word-structure history while discarding old revisit semantics`, () => {
      const structureKey = '["coordination","initial-final"]';
      const revisitKey = '["same-hand-revisit","right",true]';
      const legacy = {
        schemaVersion,
        mode: "guided",
        layoutId: "zhuyin-standard",
        lastCompletedRound: 1,
        keys: {},
        motor: {
          coordination: {
            [structureKey]: {
              scope: { bodyShape: "initial-final" },
              timing: [],
              partialTiming: { samples: [170] },
              totalTimingSamples: 1,
            },
          },
          immediateHands: {},
          sameHandRevisits: {
            [revisitKey]: {
              scope: { hand: "right", oppositeHandIntervened: true },
              timing: [],
              partialTiming: { samples: [205] },
              totalTimingSamples: 1,
            },
          },
          toneCommits: {},
        },
      };

      const migrated = parseProgressHistory(
        JSON.stringify(legacy),
        "guided",
        "zhuyin-standard",
        VALID_TOKENS,
      );

      expect(migrated?.schemaVersion).toBe(PROGRESS_HISTORY_SCHEMA_VERSION);
      expect(migrated?.motor.coordination[structureKey]).toEqual(legacy.motor.coordination[structureKey]);
      expect(migrated?.motor.sameHandRevisits).toEqual({});
    });
  }
});
