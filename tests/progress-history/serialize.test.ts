import { describe, expect, it } from "vitest";
import { PROGRESS_HISTORY_POLICY } from "../../src/progress-history/policy.js";
import {
  parseProgressHistory,
  PROGRESS_HISTORY_KEY_LIMIT,
  serializeProgressHistory,
} from "../../src/progress-history/serialize.js";
import {
  PROGRESS_HISTORY_SCHEMA_VERSION,
  type KeyProgressHistory,
  type ProgressHistory,
} from "../../src/progress-history/types.js";

const TOKEN = "zhuyin:A";
const VALID_TOKENS = new Set([TOKEN, "zhuyin:B", "tone:2"]);

function entry(overrides: Partial<KeyProgressHistory> = {}): KeyProgressHistory {
  return {
    tokenId: TOKEN,
    correctness: [
      { endingObservation: 8, completedRound: 1, attempts: 8, errors: 2, errorRatio: 0.25 },
      { endingObservation: 16, completedRound: 2, attempts: 8, errors: 1, errorRatio: 0.125 },
    ],
    timing: [
      { endingSample: 5, completedRound: 1, samples: 5, representativeTimingMs: 420 },
      { endingSample: 10, completedRound: 2, samples: 5, representativeTimingMs: 360 },
    ],
    partialCorrectness: { attempts: 3, errors: 1 },
    partialTiming: { samples: [340, 355] },
    totalObservations: 19,
    totalTimingSamples: 12,
    ...overrides,
  };
}

function history(keyEntry: KeyProgressHistory = entry()): ProgressHistory {
  return {
    schemaVersion: PROGRESS_HISTORY_SCHEMA_VERSION,
    mode: "guided",
    layoutId: "zhuyin-standard",
    lastCompletedRound: 4,
    keys: { [TOKEN]: keyEntry },
    motor: {
      coordination: {},
      immediateTokens: {},
      immediateHands: {},
      sameHandRevisits: {},
      toneCommits: {},
    },
  };
}

function parse(source: string): ProgressHistory | null {
  return parseProgressHistory(source, "guided", "zhuyin-standard", VALID_TOKENS);
}

function mutate(change: (draft: Record<string, unknown>) => void): string {
  const draft = JSON.parse(serializeProgressHistory(history())) as Record<string, unknown>;
  change(draft);
  return JSON.stringify(draft);
}

function mutateEntry(change: (draft: Record<string, unknown>) => void): string {
  return mutate((draft) => {
    change((draft.keys as Record<string, Record<string, unknown>>)[TOKEN]!);
  });
}

function motorHistory(scope: Record<string, unknown>, value = 140): Record<string, unknown> {
  return {
    scope,
    timing: [{
      endingSample: 5,
      completedRound: 3,
      samples: 5,
      representativeTimingMs: value,
    }],
    partialTiming: { samples: [] },
    totalTimingSamples: 5,
  };
}

describe("progress history persistence", () => {
  it("round-trips a valid history", () => {
    const original = history();
    expect(parse(serializeProgressHistory(original))).toEqual(original);
  });

  it("migrates schema 6 without inventing exact transition history", () => {
    const source = mutate((draft) => {
      draft.schemaVersion = 6;
      const motor = draft.motor as Record<string, unknown>;
      delete motor.immediateTokens;
      motor.coordination = {
        '["coordination","initial-final"]': motorHistory({ bodyShape: "initial-final" }, 130),
      };
      motor.immediateHands = {
        '["immediate-hand","left","right"]': motorHistory({ fromHand: "left", toHand: "right" }, 110),
      };
      motor.sameHandRevisits = {
        '["same-hand-revisit","left",false]': motorHistory({
          hand: "left",
          oppositeHandIntervened: false,
        }, 150),
      };
      motor.toneCommits = {
        '["tone-commit","tone:2"]': motorHistory({ toneToken: "tone:2" }, 170),
      };
    });
    const migrated = parse(source);
    expect(migrated?.schemaVersion).toBe(PROGRESS_HISTORY_SCHEMA_VERSION);
    expect(migrated?.motor.immediateTokens).toEqual({});
    expect(Object.keys(migrated?.motor.coordination ?? {})).toEqual([
      '["coordination","initial-final"]',
    ]);
    expect(Object.keys(migrated?.motor.immediateHands ?? {})).toEqual([
      '["immediate-hand","left","right"]',
    ]);
    expect(Object.keys(migrated?.motor.sameHandRevisits ?? {})).toEqual([
      '["same-hand-revisit","left",false]',
    ]);
    expect(Object.keys(migrated?.motor.toneCommits ?? {})).toEqual([
      '["tone-commit","tone:2"]',
    ]);
  });

  it("round-trips current exact-transition history and rejects corrupted pair identity", () => {
    const exactKey = '["immediate-token","zhuyin:A","zhuyin:B"]';
    const source = mutate((draft) => {
      const motor = draft.motor as Record<string, unknown>;
      motor.immediateTokens = {
        [exactKey]: motorHistory({ fromToken: TOKEN, toToken: "zhuyin:B" }, 125),
      };
    });
    const parsed = parse(source);
    expect(parsed?.motor.immediateTokens[exactKey]?.timing[0]?.representativeTimingMs).toBe(125);

    expect(parse(mutate((draft) => {
      const motor = draft.motor as Record<string, unknown>;
      motor.immediateTokens = {
        '["immediate-token","zhuyin:B","zhuyin:A"]': motorHistory({
          fromToken: TOKEN,
          toToken: "zhuyin:B",
        }),
      };
    }))).toBeNull();

    expect(parse(mutate((draft) => {
      const motor = draft.motor as Record<string, unknown>;
      motor.immediateTokens = {
        '["immediate-token","zhuyin:A","zhuyin:UNKNOWN"]': motorHistory({
          fromToken: TOKEN,
          toToken: "zhuyin:UNKNOWN",
        }),
      };
    }))).toBeNull();
  });

  it("gates exact-transition history by the valid token-pair domain before parsing entries", () => {
    const immediateTokens: Record<string, unknown> = {};
    const maximumPairs = VALID_TOKENS.size * VALID_TOKENS.size;
    for (let index = 0; index <= maximumPairs; index += 1) {
      immediateTokens[`invalid-${index}`] = motorHistory({ fromToken: TOKEN, toToken: "zhuyin:B" });
    }
    expect(parse(mutate((draft) => {
      (draft.motor as Record<string, unknown>).immediateTokens = immediateTokens;
    }))).toBeNull();
  });

  it("migrates schema 3 by dropping obsolete coordination while preserving other history", () => {
    const source = mutate((draft) => {
      draft.schemaVersion = 3;
      draft.motor = {
        coordination: {
          '["coordination","2","mixed"]': motorHistory({ bodySize: "2", handShape: "mixed" }, 130),
          '["coordination","4+","mixed"]': motorHistory({ bodySize: "4+", handShape: "mixed" }, 170),
        },
        immediateHands: {
          '["immediate-hand","left","right"]': motorHistory({ fromHand: "left", toHand: "right" }, 110),
        },
        sameHandRevisits: {},
        toneCommits: {},
      };
    });
    const migrated = parse(source);
    expect(migrated?.schemaVersion).toBe(PROGRESS_HISTORY_SCHEMA_VERSION);
    expect(migrated?.motor.coordination).toEqual({});
    expect(migrated?.motor.immediateTokens).toEqual({});
    expect(Object.keys(migrated?.motor.immediateHands ?? {})).toEqual([
      '["immediate-hand","left","right"]',
    ]);
    expect(migrated?.keys[TOKEN]).toEqual(history().keys[TOKEN]);
  });

  it("rejects legacy coordination identity in the current schema", () => {
    expect(parse(mutate((draft) => {
      const motor = draft.motor as Record<string, unknown>;
      motor.coordination = {
        '["coordination","4+","mixed"]': motorHistory({ bodySize: "4+", handShape: "mixed" }),
      };
    }))).toBeNull();
  });

  it("rejects unparsable source and unsupported schema generations", () => {
    expect(parse("{")).toBeNull();
    expect(parse(mutate((draft) => { draft.schemaVersion = 1; }))).toBeNull();
    expect(parse(mutate((draft) => { draft.schemaVersion = 99; }))).toBeNull();
  });

  it("rejects a history recorded under a different mode or layout", () => {
    expect(parse(mutate((draft) => { draft.mode = "recall"; }))).toBeNull();
    expect(parse(mutate((draft) => { draft.layoutId = "other"; }))).toBeNull();
  });

  it("rejects a token that the current layout and catalog support do not know", () => {
    expect(parse(mutate((draft) => {
      draft.keys = { "zhuyin:UNKNOWN": entry() };
    }))).toBeNull();
  });

  it("gates the number of stored keys before validating them", () => {
    const keys: Record<string, unknown> = {};
    for (let index = 0; index <= PROGRESS_HISTORY_KEY_LIMIT; index += 1) {
      keys[`zhuyin:${index}`] = entry();
    }
    expect(parse(mutate((draft) => { draft.keys = keys; }))).toBeNull();
  });

  it("rejects arrays longer than the completed-point limit", () => {
    expect(parse(mutateEntry((draft) => {
      draft.correctness = Array.from(
        { length: PROGRESS_HISTORY_POLICY.completedPointLimit + 1 },
        (_, index) => ({
          endingObservation: (index + 1) * 8,
          completedRound: 1,
          attempts: 8,
          errors: 0,
          errorRatio: 0,
        }),
      );
    }))).toBeNull();
  });

  it("rejects negative, non-integer, NaN, and Infinity values", () => {
    expect(parse(mutateEntry((draft) => {
      draft.partialCorrectness = { attempts: -1, errors: 0 };
    }))).toBeNull();
    expect(parse(mutateEntry((draft) => {
      draft.partialCorrectness = { attempts: 2.5, errors: 0 };
    }))).toBeNull();
    expect(parse(mutateEntry((draft) => {
      draft.partialTiming = { samples: [Number.NaN] };
    }))).toBeNull();
    expect(parse(mutate((draft) => {
      draft.lastCompletedRound = Number.POSITIVE_INFINITY;
    }))).toBeNull();
    expect(parse(mutateEntry((draft) => {
      draft.timing = [
        { endingSample: 5, completedRound: 1, samples: 5, representativeTimingMs: -1 },
      ];
      draft.totalTimingSamples = 7;
    }))).toBeNull();
  });

  it("rejects a point whose counts contradict its own stored ratio", () => {
    expect(parse(mutateEntry((draft) => {
      draft.correctness = [
        { endingObservation: 8, completedRound: 1, attempts: 8, errors: 2, errorRatio: 0.9 },
      ];
      draft.totalObservations = 11;
    }))).toBeNull();
  });

  it("rejects a point whose bucket size disagrees with the policy", () => {
    expect(parse(mutateEntry((draft) => {
      draft.correctness = [
        { endingObservation: 4, completedRound: 1, attempts: 4, errors: 1, errorRatio: 0.25 },
      ];
      draft.totalObservations = 7;
    }))).toBeNull();
  });

  it("rejects duplicate and out-of-order points", () => {
    const point = {
      endingObservation: 8,
      completedRound: 2,
      attempts: 8,
      errors: 1,
      errorRatio: 0.125,
    };
    expect(parse(mutateEntry((draft) => {
      draft.correctness = [point, point];
      draft.totalObservations = 11;
    }))).toBeNull();
    expect(parse(mutateEntry((draft) => {
      draft.correctness = [
        { ...point, endingObservation: 16, completedRound: 3 },
        { ...point, endingObservation: 8, completedRound: 2 },
      ];
      draft.totalObservations = 11;
    }))).toBeNull();
  });

  it("rejects an overfull partial bucket", () => {
    expect(parse(mutateEntry((draft) => {
      draft.partialCorrectness = {
        attempts: PROGRESS_HISTORY_POLICY.correctnessBucketSize,
        errors: 0,
      };
      draft.totalObservations = 16 + PROGRESS_HISTORY_POLICY.correctnessBucketSize;
    }))).toBeNull();
    expect(parse(mutateEntry((draft) => {
      draft.partialTiming = {
        samples: Array.from(
          { length: PROGRESS_HISTORY_POLICY.timingBucketSize },
          () => 300,
        ),
      };
      draft.totalTimingSamples = 10 + PROGRESS_HISTORY_POLICY.timingBucketSize;
    }))).toBeNull();
  });

  it("rejects totals that disagree with the stored points", () => {
    expect(parse(mutateEntry((draft) => { draft.totalObservations = 40; }))).toBeNull();
    expect(parse(mutateEntry((draft) => { draft.totalTimingSamples = 40; }))).toBeNull();
  });

  it("rejects a point recorded after the history's own last completed round", () => {
    expect(parse(mutate((draft) => { draft.lastCompletedRound = 1; }))).toBeNull();
  });
});
