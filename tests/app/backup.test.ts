import { describe, expect, it } from "vitest";
import { createProductBackup, parseProductBackup } from "../../src/app/backup.js";
import {
  loadLocalProductProgress,
  LOCAL_PROGRESS_KEY,
  type StorageLike,
} from "../../src/app/local-progress.js";
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
const entryId = Object.keys(environment.practiceSupport.entriesById)[0]!;

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();
  getItem(key: string): string | null { return this.values.get(key) ?? null; }
  setItem(key: string, value: string): void { this.values.set(key, value); }
  removeItem(key: string): void { this.values.delete(key); }
}

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

function progressWithSummary(entryIds: string[], focusTokenId: string | null) {
  return {
    ...progress,
    recentSummaries: [{
      kind: "practice" as const,
      exerciseId: "practice-1",
      completedAt: "2026-07-25T00:00:00.000Z",
      entryIds,
      utteranceId: "utterance:test",
      templateId: null,
      focusTokenId,
      focusEvidence: focusTokenId === null ? null : "timed" as const,
      attempts: 1,
      errors: 0,
      timingSamples: 0,
    }],
  };
}

function backupFor(candidate: typeof progress): string {
  return createProductBackup(
    candidate,
    pilotHistory,
    progressHistory,
    DEFAULT_SELECTION_TUNING,
  );
}

function localLoadFor(candidate: typeof progress) {
  const storage = new MemoryStorage();
  const backup = JSON.parse(backupFor(candidate)) as { progress: unknown };
  storage.setItem(LOCAL_PROGRESS_KEY, JSON.stringify(backup.progress));
  return loadLocalProductProgress(storage, environment, "guided", "standard");
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

  it.each([
    ["unknown entry", ["entry:not-known"], null],
    ["duplicate entry", [entryId, entryId], null],
    ["unknown focus token", [entryId], "zhuyin:not-known"],
  ])("rejects %s consistently on import and local reload", (_label, entryIds, focusTokenId) => {
    const candidate = progressWithSummary(entryIds, focusTokenId);

    expect(parse(backupFor(candidate))).toBeNull();
    expect(localLoadFor(candidate)).toEqual({
      progress: null,
      recoveredFromInvalidState: true,
    });
  });

  it("accepts known summary references consistently on import and local reload", () => {
    const candidate = progressWithSummary([entryId], token);

    expect(parse(backupFor(candidate))?.progress).toEqual(candidate);
    expect(localLoadFor(candidate)).toEqual({
      progress: candidate,
      recoveredFromInvalidState: false,
    });
  });
});
