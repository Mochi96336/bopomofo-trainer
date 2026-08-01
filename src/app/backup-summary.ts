import type { PilotHistory } from "../product/pilot-history.js";
import type { ProductProgress } from "../product/types.js";
import type { ProgressHistory } from "../progress-history/types.js";

/**
 * What a saved generation contains, in the terms the learner is being asked
 * about before one replaces the other.
 *
 * Only counts the schema states outright: rounds completed, records kept, and
 * whether any trend was ever folded in. Nothing here estimates mastery,
 * confidence, or a percentage of the curriculum -- a backup does not carry those
 * and inventing them would put a number the learner cannot check next to a
 * button that discards their progress. When a fact is not reliably available,
 * the summary says less rather than guessing.
 */

export interface BackupSummarySource {
  readonly progress: ProductProgress;
  readonly pilotHistory: PilotHistory;
  readonly progressHistory: ProgressHistory;
}

export interface BackupSummary {
  readonly completedRounds: number;
  readonly historyRecords: number;
  readonly progressTrendAvailable: boolean;
}

export function summariseBackup(source: BackupSummarySource): BackupSummary {
  return {
    completedRounds: source.progress.practiceRoundsCompleted,
    historyRecords: source.pilotHistory.records.length,
    // The highest round already folded in, so anything above zero means the
    // trend has something to draw.
    progressTrendAvailable: source.progressHistory.lastCompletedRound > 0,
  };
}

/**
 * One line per generation, so the two can be compared by reading down.
 *
 * The record count is stated even when it is zero: an import that replaces
 * twenty-four records with none is exactly the case worth noticing, and a line
 * that silently omits the count reads as though the two sides matched.
 */
export function backupSummaryLabel(summary: BackupSummary): string {
  const { completedRounds, historyRecords, progressTrendAvailable } = summary;
  if (completedRounds === 0 && historyRecords === 0 && !progressTrendAvailable) {
    return "尚未開始練習";
  }
  const parts = [
    `${completedRounds} 句完成`,
    historyRecords === 0 ? "尚無最近紀錄" : `${historyRecords} 筆最近紀錄`,
  ];
  if (progressTrendAvailable) parts.push("有進步趨勢");
  return parts.join(" · ");
}
