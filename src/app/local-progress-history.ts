import {
  parseProgressHistory,
  serializeProgressHistory,
} from "../progress-history/serialize.js";
import { createEmptyProgressHistory } from "../progress-history/update.js";
import type { ProgressHistory } from "../progress-history/types.js";
import type { ProductEnvironment, ProductProgress } from "../product/types.js";
import type { StorageLike } from "./local-progress.js";

export const LOCAL_PROGRESS_HISTORY_KEY = "bopomofo-trainer.progress-history.v1";

export interface LocalProgressHistoryLoadResult {
  readonly history: ProgressHistory;
  readonly recoveredFromInvalidState: boolean;
}

// Mirrors the last loaded or saved history so the diagnostic enhancement layer
// can read what the running product is actually using, exactly as it already
// does for cumulative product progress.
let liveProgressHistory: ProgressHistory | null = null;

export function currentLocalProgressHistory(): ProgressHistory | null {
  return liveProgressHistory;
}

function validTokensFor(environment: ProductEnvironment): ReadonlySet<string> {
  return new Set(Object.keys(environment.practiceSupport.byToken));
}

export function loadLocalProgressHistory(
  storage: StorageLike,
  progress: ProductProgress,
  environment: ProductEnvironment,
): LocalProgressHistoryLoadResult {
  const empty = createEmptyProgressHistory(progress.mode, progress.layoutId);
  const source = storage.getItem(LOCAL_PROGRESS_HISTORY_KEY);
  if (source === null) {
    liveProgressHistory = empty;
    return { history: empty, recoveredFromInvalidState: false };
  }
  const parsed = parseProgressHistory(
    source,
    progress.mode,
    progress.layoutId,
    validTokensFor(environment),
  );
  // History is only ever appended by a completed round, so a history that
  // claims more rounds than the progress it belongs to has been separated from
  // that progress. Starting over is the only honest option: the alternative is
  // showing points that no longer correspond to the displayed aggregates.
  if (parsed === null || parsed.lastCompletedRound > progress.practiceRoundsCompleted) {
    liveProgressHistory = empty;
    return { history: empty, recoveredFromInvalidState: true };
  }
  liveProgressHistory = parsed;
  return { history: parsed, recoveredFromInvalidState: false };
}

export function saveLocalProgressHistory(
  storage: StorageLike,
  history: ProgressHistory,
): void {
  liveProgressHistory = history;
  storage.setItem(LOCAL_PROGRESS_HISTORY_KEY, serializeProgressHistory(history));
}

export function clearLocalProgressHistory(storage: StorageLike): void {
  liveProgressHistory = null;
  storage.removeItem(LOCAL_PROGRESS_HISTORY_KEY);
}
