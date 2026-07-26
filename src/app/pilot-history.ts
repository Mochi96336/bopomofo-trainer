import {
  mergePilotHistories,
  parsePilotHistory,
  pilotHistoryFromProgress,
  serializePilotHistory,
  type PilotHistory,
} from "../product/pilot-history.js";
import type { ProductEnvironment, ProductProgress } from "../product/types.js";
import {
  LOCAL_PILOT_HISTORY_KEY,
  type StorageLike,
} from "./persistence-transaction.js";

export { LOCAL_PILOT_HISTORY_KEY };

export interface LocalPilotHistoryLoadResult {
  readonly history: PilotHistory;
  readonly recoveredFromInvalidState: boolean;
}

export function loadLocalPilotHistory(
  storage: StorageLike,
  progress: ProductProgress,
  environment: ProductEnvironment,
): LocalPilotHistoryLoadResult {
  const fromProgress = pilotHistoryFromProgress(progress);
  const source = storage.getItem(LOCAL_PILOT_HISTORY_KEY);
  if (source === null) {
    return { history: fromProgress, recoveredFromInvalidState: false };
  }
  const parsed = parsePilotHistory(source, environment);
  if (parsed === null) {
    return { history: fromProgress, recoveredFromInvalidState: true };
  }
  return {
    history: mergePilotHistories(parsed, fromProgress, progress.practiceRoundsCompleted),
    recoveredFromInvalidState: false,
  };
}

export function saveLocalPilotHistory(
  storage: StorageLike,
  history: PilotHistory,
): void {
  storage.setItem(LOCAL_PILOT_HISTORY_KEY, serializePilotHistory(history));
}

export function clearLocalPilotHistory(storage: StorageLike): void {
  storage.removeItem(LOCAL_PILOT_HISTORY_KEY);
}
