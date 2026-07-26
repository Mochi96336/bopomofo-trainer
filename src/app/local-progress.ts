import { parseProductProgress, serializeProductProgress } from "../product/progress.js";
import type { ProductEnvironment, ProductProgress } from "../product/types.js";
import { productProgressReferencesAreKnown } from "./product-progress-references.js";
import {
  beginLocalPersistenceTransaction,
  LOCAL_PROGRESS_KEY,
  type StorageLike,
} from "./persistence-transaction.js";

export { LOCAL_PROGRESS_KEY };
export type { StorageLike };

export interface LocalProgressLoadResult {
  readonly progress: ProductProgress | null;
  readonly recoveredFromInvalidState: boolean;
}

// Mirrors the last loaded/saved progress so diagnostics can read the value the
// running product is actually using without re-parsing and re-validating storage.
let liveProductProgress: ProductProgress | null = null;

export function currentLocalProductProgress(): ProductProgress | null {
  return liveProductProgress;
}

export function loadLocalProductProgress(
  storage: StorageLike,
  environment: ProductEnvironment,
  mode: ProductProgress["mode"],
  layoutId: string,
): LocalProgressLoadResult {
  const source = storage.getItem(LOCAL_PROGRESS_KEY);
  if (source === null) {
    liveProductProgress = null;
    return { progress: null, recoveredFromInvalidState: false };
  }
  const progress = parseProductProgress(
    source,
    environment.practiceSupport,
    mode,
    layoutId,
    environment.measurementPolicy,
    environment.curriculumPolicy.version,
    environment.utterancePolicy,
  );
  const validProgress = progress !== null && productProgressReferencesAreKnown(progress, environment)
    ? progress
    : null;
  liveProductProgress = validProgress;
  return {
    progress: validProgress,
    recoveredFromInvalidState: validProgress === null,
  };
}

export function saveLocalProductProgress(
  storage: StorageLike,
  progress: ProductProgress,
): void {
  beginLocalPersistenceTransaction(storage);
  storage.setItem(LOCAL_PROGRESS_KEY, serializeProductProgress(progress));
  liveProductProgress = progress;
}

export function clearLocalProductProgress(storage: StorageLike): void {
  beginLocalPersistenceTransaction(storage);
  storage.removeItem(LOCAL_PROGRESS_KEY);
  liveProductProgress = null;
}
