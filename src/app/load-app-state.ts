import type { ProgressHistory } from "../progress-history/types.js";
import { createEmptyProgressHistory } from "../progress-history/update.js";
import {
  pilotHistoryFromProgress,
  type PilotHistory,
} from "../product/pilot-history.js";
import { createFreshProgressForEnvironment } from "../product/session.js";
import type { ProductEnvironment, ProductProgress } from "../product/types.js";
import type {
  LocalProgressLoadStatus,
} from "./local-progress.js";
import type { StorageLike } from "./persistence-transaction.js";
import { loadLocalPilotHistory } from "./pilot-history.js";
import { loadLocalProductProgress } from "./local-progress.js";
import { loadLocalProgressHistory } from "./local-progress-history.js";

/**
 * The startup read of everything the browser kept from previous sessions.
 *
 * This is the path most able to lose a returning learner's saved work, and it
 * has three separate points of failure: storage can be blocked outright, and
 * each of the three payloads can be unreadable on its own. Every one of them
 * degrades to a usable session rather than an error page -- practice must start
 * even when nothing can be read -- which is exactly why the fallbacks need to be
 * assertable instead of inlined at module scope where nothing can reach them.
 */

const PROGRESS_UNREADABLE =
  "瀏覽器無法讀取本機進度；本次練習仍可使用，但可能無法保存。";
const HISTORY_UNREADABLE =
  "瀏覽器無法讀取完整本機資料；練習仍可使用，但練習歷史可能無法保存。";

export type AppProgressLoadStatus = LocalProgressLoadStatus | "unavailable";

export interface AppBootState {
  readonly progress: ProductProgress;
  readonly pilotHistory: PilotHistory;
  readonly progressHistory: ProgressHistory;
  /** False when nothing valid was stored, which is what makes the first save happen. */
  readonly loadedExistingProgress: boolean;
  readonly progressLoadStatus: AppProgressLoadStatus;
  readonly recoveredPilotHistory: boolean;
  /** Empty when every read succeeded. */
  readonly storageWarning: string;
}

export interface LoadAppStateOptions {
  readonly storage: StorageLike;
  /**
   * The whole-catalog environment, never the practised subset: stored records
   * point at entries drawn before the learner narrowed the levels, and reading
   * them through the narrowed catalog would reject that history as invalid.
   */
  readonly environment: ProductEnvironment;
  readonly mode: ProductProgress["mode"];
  readonly layoutId: ProductProgress["layoutId"];
  readonly newSeed: () => string;
}

export function loadAppState(options: LoadAppStateOptions): AppBootState {
  const { storage, environment, mode, layoutId, newSeed } = options;

  let storageWarning = "";
  let loaded: ProductProgress | null = null;
  let progressLoadStatus: AppProgressLoadStatus = "empty";
  try {
    const result = loadLocalProductProgress(storage, environment, mode, layoutId);
    loaded = result.progress;
    progressLoadStatus = result.status;
  } catch {
    progressLoadStatus = "unavailable";
    storageWarning = PROGRESS_UNREADABLE;
  }

  // A fresh generation is seeded rather than left blank, so an unreadable store
  // still yields a reproducible session instead of an unusable one.
  const progress = loaded ?? createFreshProgressForEnvironment(
    environment,
    newSeed(),
    mode,
    layoutId,
  );

  // Derived from progress first: a Pilot history that cannot be read falls back
  // to whatever the progress summaries can rebuild, not to nothing.
  let pilotHistory = pilotHistoryFromProgress(progress);
  let recoveredPilotHistory = false;
  try {
    const result = loadLocalPilotHistory(storage, progress, environment);
    pilotHistory = result.history;
    recoveredPilotHistory = result.recoveredFromInvalidState;
  } catch {
    storageWarning = HISTORY_UNREADABLE;
  }

  let progressHistory = createEmptyProgressHistory(progress.mode, progress.layoutId);
  try {
    progressHistory = loadLocalProgressHistory(storage, progress, environment).history;
  } catch {
    storageWarning = HISTORY_UNREADABLE;
  }

  return {
    progress,
    pilotHistory,
    progressHistory,
    loadedExistingProgress: loaded !== null,
    progressLoadStatus,
    recoveredPilotHistory,
    storageWarning,
  };
}
