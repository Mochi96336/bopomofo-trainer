import { describe, expect, it } from "vitest";
import {
  backupSummaryLabel,
  summariseBackup,
  type BackupSummarySource,
} from "../../src/app/backup-summary.js";
import type { PilotHistory, PilotRoundRecord } from "../../src/product/pilot-history.js";
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
const emptyTrend = createEmptyProgressHistory("guided", "standard");

function record(roundNumber: number): PilotRoundRecord {
  return {
    roundNumber,
    kind: "practice",
    exerciseId: `exercise-${roundNumber}`,
    completedAt: "2026-01-01T00:00:00.000Z",
    entryIds: [],
    focusTokenId: null,
    focusEvidence: null,
    attempts: 10,
    errors: 1,
    timingSamples: 8,
    cleanLatencyMedianMs: 300,
  };
}

function source(
  completedRounds: number,
  records: readonly PilotRoundRecord[],
  lastTrendRound: number,
): BackupSummarySource {
  const progress = { ...freshProgress, practiceRoundsCompleted: completedRounds };
  const pilotHistory: PilotHistory = { ...pilotHistoryFromProgress(progress), records };
  const progressHistory: ProgressHistory = {
    ...emptyTrend,
    lastCompletedRound: lastTrendRound,
  };
  return { progress, pilotHistory, progressHistory };
}

describe("backup summary", () => {
  it("counts only what the schema states outright", () => {
    expect(summariseBackup(source(128, [record(1), record(2)], 128))).toEqual({
      completedRounds: 128,
      historyRecords: 2,
      progressTrendAvailable: true,
    });
  });

  it("reads a trend as available only once a round has been folded in", () => {
    expect(summariseBackup(source(4, [], 0)).progressTrendAvailable).toBe(false);
    expect(summariseBackup(source(4, [], 1)).progressTrendAvailable).toBe(true);
  });

  it("says a generation that has never been practised is empty", () => {
    expect(backupSummaryLabel(summariseBackup(source(0, [], 0)))).toBe("尚未開始練習");
  });

  it("reads as one line per generation", () => {
    expect(backupSummaryLabel(summariseBackup(source(128, [record(1)], 128))))
      .toBe("128 句完成 · 1 筆最近紀錄 · 有進步趨勢");
  });

  // An import that replaces records with none is the case worth noticing, and a
  // line that omitted the count would read as though the two sides matched.
  it("states an absent record count rather than dropping the line", () => {
    expect(backupSummaryLabel(summariseBackup(source(94, [], 0))))
      .toBe("94 句完成 · 尚無最近紀錄");
  });

  // Nothing here may imply mastery, confidence, or a share of the curriculum:
  // a backup does not carry them, so a number for them could not be checked.
  it("offers no reading the backup cannot support", () => {
    const label = backupSummaryLabel(summariseBackup(source(128, [record(1)], 128)));
    expect(label).not.toMatch(/%|熟練|掌握|完成度/);
  });
});
