import {
  parseProgressHistory,
  serializeProgressHistory,
} from "../progress-history/serialize.js";
import { createEmptyProgressHistory } from "../progress-history/update.js";
import type { ProgressHistory } from "../progress-history/types.js";
import type { ProductEnvironment, ProductProgress } from "../product/types.js";
import {
  commitLocalPersistenceTransaction,
  LOCAL_PROGRESS_HISTORY_KEY,
  type StorageLike,
} from "./persistence-transaction.js";

export { LOCAL_PROGRESS_HISTORY_KEY };

export interface LocalProgressHistoryLoadResult {
  readonly history: ProgressHistory;
  readonly recoveredFromInvalidState: boolean;
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
  if (source === null) return { history: empty, recoveredFromInvalidState: false };
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
    return { history: empty, recoveredFromInvalidState: true };
  }
  return { history: parsed, recoveredFromInvalidState: false };
}

export function saveLocalProgressHistory(
  storage: StorageLike,
  history: ProgressHistory,
): void {
  storage.setItem(LOCAL_PROGRESS_HISTORY_KEY, serializeProgressHistory(history));
  commitLocalPersistenceTransaction(storage);
}

export function clearLocalProgressHistory(storage: StorageLike): void {
  storage.removeItem(LOCAL_PROGRESS_HISTORY_KEY);
  commitLocalPersistenceTransaction(storage);
}
