import { clearLocalProgressHistory } from "./local-progress-history.js";
import { clearLocalProductProgress } from "./local-progress.js";
import type { StorageLike } from "./persistence-transaction.js";
import { clearLocalPilotHistory } from "./pilot-history.js";

/**
 * The counterpart to `loadAppState`: everything the browser kept, removed.
 *
 * The three removals are one journalled batch. Progress goes first because it
 * opens the transaction, and the trend history goes last because it commits it,
 * so a removal that fails partway leaves the journal behind and the next boot
 * rolls the whole batch back rather than starting from a half-cleared store.
 * That ordering was previously an unremarked property of three lines inside a
 * `try` in `main.ts`, where nothing could assert it.
 *
 * A refusal is not an error the learner has to act on: the page has already
 * restarted from a fresh generation by the time this returns, so the report says
 * what could not be written rather than stopping the reset.
 */

const CLEAR_FAILED = "瀏覽器無法清除舊進度，但本頁已重新開始。";

export interface ClearLocalRecordsResult {
  /** False when storage refused, which is what suppresses the first save. */
  readonly cleared: boolean;
  /** Empty when every removal succeeded. */
  readonly storageWarning: string;
}

export function clearLocalRecords(storage: StorageLike): ClearLocalRecordsResult {
  try {
    clearLocalProductProgress(storage);
    clearLocalPilotHistory(storage);
    clearLocalProgressHistory(storage);
  } catch {
    return { cleared: false, storageWarning: CLEAR_FAILED };
  }
  return { cleared: true, storageWarning: "" };
}
