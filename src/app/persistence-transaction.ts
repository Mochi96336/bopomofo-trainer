export const LOCAL_PROGRESS_KEY = "bopomofo-trainer.progress.v4";
export const LOCAL_PILOT_HISTORY_KEY = "bopomofo-trainer.pilot-history.v3";
export const LOCAL_PROGRESS_HISTORY_KEY = "bopomofo-trainer.progress-history.v1";
export const LOCAL_PERSISTENCE_JOURNAL_KEY = "bopomofo-trainer.persistence-journal.v1";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

interface PersistenceSnapshot {
  readonly progress: string | null;
  readonly pilotHistory: string | null;
  readonly progressHistory: string | null;
}

interface PersistenceJournal {
  readonly version: 1;
  readonly previous: PersistenceSnapshot;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStoredValue(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function snapshot(storage: StorageLike): PersistenceSnapshot {
  return {
    progress: storage.getItem(LOCAL_PROGRESS_KEY),
    pilotHistory: storage.getItem(LOCAL_PILOT_HISTORY_KEY),
    progressHistory: storage.getItem(LOCAL_PROGRESS_HISTORY_KEY),
  };
}

function parseJournal(source: string): PersistenceJournal | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source) as unknown;
  } catch {
    return null;
  }
  if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.previous)) return null;
  if (
    !isStoredValue(parsed.previous.progress)
    || !isStoredValue(parsed.previous.pilotHistory)
    || !isStoredValue(parsed.previous.progressHistory)
  ) return null;
  return {
    version: 1,
    previous: {
      progress: parsed.previous.progress,
      pilotHistory: parsed.previous.pilotHistory,
      progressHistory: parsed.previous.progressHistory,
    },
  };
}

function restoreValue(storage: StorageLike, key: string, value: string | null): void {
  if (value === null) storage.removeItem(key);
  else storage.setItem(key, value);
}

/**
 * Records the last fully committed three-key state before the first write or
 * removal in a persistence batch. Repeated calls deliberately preserve the
 * original snapshot so a retry can finish the same logical transaction.
 */
export function beginLocalPersistenceTransaction(storage: StorageLike): void {
  if (storage.getItem(LOCAL_PERSISTENCE_JOURNAL_KEY) !== null) return;
  const journal: PersistenceJournal = { version: 1, previous: snapshot(storage) };
  storage.setItem(LOCAL_PERSISTENCE_JOURNAL_KEY, JSON.stringify(journal));
}

/** Marks the ordered progress, Pilot-history, and trend-history batch complete. */
export function commitLocalPersistenceTransaction(storage: StorageLike): void {
  storage.removeItem(LOCAL_PERSISTENCE_JOURNAL_KEY);
}

/**
 * Rolls back a browser reload that encountered an interrupted persistence
 * batch. The journal is removed only after every prior value is restored.
 */
export function recoverLocalPersistenceTransaction(storage: StorageLike): boolean {
  const source = storage.getItem(LOCAL_PERSISTENCE_JOURNAL_KEY);
  if (source === null) return false;
  const journal = parseJournal(source);
  if (journal === null) {
    storage.removeItem(LOCAL_PERSISTENCE_JOURNAL_KEY);
    return false;
  }
  restoreValue(storage, LOCAL_PROGRESS_KEY, journal.previous.progress);
  restoreValue(storage, LOCAL_PILOT_HISTORY_KEY, journal.previous.pilotHistory);
  restoreValue(storage, LOCAL_PROGRESS_HISTORY_KEY, journal.previous.progressHistory);
  storage.removeItem(LOCAL_PERSISTENCE_JOURNAL_KEY);
  return true;
}
