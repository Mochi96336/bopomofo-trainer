import { parseProductProgress, serializeProductProgress } from "../product/progress.js";
import type { ProductEnvironment, ProductProgress } from "../product/types.js";
import { productProgressReferencesAreKnown } from "./product-progress-references.js";

export const LOCAL_PROGRESS_KEY = "bopomofo-trainer.progress.v4";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

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
  liveProductProgress = progress;
  storage.setItem(LOCAL_PROGRESS_KEY, serializeProductProgress(progress));
}

export function clearLocalProductProgress(storage: StorageLike): void {
  liveProductProgress = null;
  storage.removeItem(LOCAL_PROGRESS_KEY);
}
