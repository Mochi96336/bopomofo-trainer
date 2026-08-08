import { serializeProductProgress } from "../product/progress.js";
import {
  parseProductProgressForLoad,
  type ProductProgressParseStatus,
} from "../product/progress-load.js";
import type { ProductEnvironment, ProductProgress } from "../product/types.js";
import { productProgressReferencesAreKnown } from "./product-progress-references.js";
import {
  beginLocalPersistenceTransaction,
  LOCAL_PROGRESS_KEY,
  type StorageLike,
} from "./persistence-transaction.js";

export { LOCAL_PROGRESS_KEY };
export type { StorageLike };

export type LocalProgressLoadStatus = "empty" | ProductProgressParseStatus;

export interface LocalProgressLoadResult {
  readonly progress: ProductProgress | null;
  readonly status: LocalProgressLoadStatus;
}

export function loadLocalProductProgress(
  storage: StorageLike,
  environment: ProductEnvironment,
  mode: ProductProgress["mode"],
  layoutId: string,
): LocalProgressLoadResult {
  const source = storage.getItem(LOCAL_PROGRESS_KEY);
  if (source === null) return { progress: null, status: "empty" };
  const parsed = parseProductProgressForLoad(
    source,
    environment.practiceSupport,
    mode,
    layoutId,
    environment.curriculumPolicy.version,
    environment.utterancePolicy,
  );
  if (parsed.progress === null) return { progress: null, status: "invalid" };
  if (!productProgressReferencesAreKnown(parsed.progress, environment)) {
    return { progress: null, status: "invalid" };
  }
  return { progress: parsed.progress, status: parsed.status };
}

export function saveLocalProductProgress(
  storage: StorageLike,
  progress: ProductProgress,
): void {
  beginLocalPersistenceTransaction(storage);
  storage.setItem(LOCAL_PROGRESS_KEY, serializeProductProgress(progress));
}

export function clearLocalProductProgress(storage: StorageLike): void {
  beginLocalPersistenceTransaction(storage);
  storage.removeItem(LOCAL_PROGRESS_KEY);
}
