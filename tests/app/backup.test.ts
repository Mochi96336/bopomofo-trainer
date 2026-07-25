import { describe, expect, it } from "vitest";
import { createProductBackup, parseProductBackup } from "../../src/app/backup.js";
import { DEFAULT_SELECTION_TUNING } from "../../src/app/selection-tuning.js";
import { pilotHistoryFromProgress } from "../../src/product/pilot-history.js";
import {
  createFreshProgressForEnvironment,
  createProductEnvironment,
} from "../../src/product/session.js";
import { createEmptyProgressHistory } from "../../src/progress-history/update.js";
import type { ProgressHistory } from "../../src/progress-history/types.js";
import { PRODUCT_CATALOGS } from "../product/fixtures.js";

const environment = createProductEnvironment(PRODUCT_CATALOGS);
const freshProgress = createFreshProgressForEnvironment(
  environment,
  "seed",
  "guided",
  "standard",
);
// Two completed rounds, so a history that references round 1 is consistent with
// the progress it travels with.
const progress = {
  ...freshProgress,
  practiceRoundsCompleted: 2,
  curriculum: { ...freshProgress.curriculum, round: 2 },
};
const pilotHistory = pilotHistoryFromProgress(progress);
const token = Object.keys(environment.practiceSupport.byToken)[0]!;

const progressHistory: ProgressHistory = {
  ...createEmptyProgressHistory("guided", "standard"),
  lastCompletedRound: 1,
  keys: {
    [token]: {
      tokenId: token,
      correctness: [
        { endingObservation: 8, completedRound: 1, attempts: 8, errors: 2, errorRatio: 0.25 },
      ],
      timing: [
        { endingSample: 5, completedRound: 1, samples: 5, representativeTimingMs: 410 },
      ],
      partialCorrectness: { attempts: 1, errors: 0 },
      partialTiming: { samples: [330] },
      totalObservations: 9,
      totalTimingSamples: 6,
    },
  },
};

function parse(source: string) {
  return parseProductBackup(source, environment, "guided", "standard");
}

describe("product backup with progress history", () => {
  it("round-trips progress history alongside progress and pilot history", () => {
    const source = createProductBackup(
      progress,
      pilotHistory,
      progressHistory,
      DEFAULT_SELECTION_TUNING,
      "2026-07-25T00:00:00.000Z",
    );
    const parsed = parse(source);

    expect(parsed).not.toBeNull();
    expect(parsed!.progressHistory).toEqual(progressHistory);
    expect(parsed!.progress).toEqual(progress);
  });

  it("rejects a backup with no progress history section", () => {
    const source = createProductBackup(
      progress,
      pilotHistory,
      progressHistory,
      DEFAULT_SELECTION_TUNING,
    );
    const draft = JSON.parse(source) as Record<string, unknown>;
    delete draft.progressHistory;

    // Every backup this version writes carries the section, so a missing one
    // is a malformed file rather than an older export to be filled in.
    expect(parse(JSON.stringify(draft))).toBeNull();
  });

  it("rejects a backup whose progress history is malformed", () => {
    const source = createProductBackup(
      progress,
      pilotHistory,
      progressHistory,
      DEFAULT_SELECTION_TUNING,
    );
    const draft = JSON.parse(source) as Record<string, unknown>;
    draft.progressHistory = { schemaVersion: 99, mode: "guided", layoutId: "standard", keys: {} };

    expect(parse(JSON.stringify(draft))).toBeNull();
  });

  it("rejects a history that claims more rounds than the backed-up progress", () => {
    const source = createProductBackup(
      progress,
      pilotHistory,
      { ...progressHistory, lastCompletedRound: 5 },
      DEFAULT_SELECTION_TUNING,
    );

    expect(parse(source)).toBeNull();
  });

  it("rejects a history containing a token outside the current support", () => {
    const source = createProductBackup(
      progress,
      pilotHistory,
      {
        ...progressHistory,
        keys: { "zhuyin:not-a-real-token": progressHistory.keys[token]! },
      },
      DEFAULT_SELECTION_TUNING,
    );

    expect(parse(source)).toBeNull();
  });
});
