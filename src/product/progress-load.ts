import type { PracticeMode } from "../core/model.js";
import type { CatalogSupportIndex } from "../curriculum/types.js";
import type { FrequencyFirstUtterancePolicy } from "../curriculum/frequency-first-utterance.js";
import { parseProductProgress } from "./progress.js";
import {
  PRODUCT_PROGRESS_SCHEMA_VERSION,
  type ProductProgress,
} from "./types.js";

export type ProductProgressParseStatus = "loaded" | "migrated" | "invalid";

export interface ProductProgressParseResult {
  readonly progress: ProductProgress | null;
  readonly status: ProductProgressParseStatus;
}

function sourceSchemaVersion(source: string): unknown {
  try {
    const parsed = JSON.parse(source) as unknown;
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>).schemaVersion
      : null;
  } catch {
    return null;
  }
}

/**
 * Parses persisted progress and reports whether a successful parse crossed a
 * schema boundary. `parseProductProgress` remains the authority on which legacy
 * schemas are actually migratable; this wrapper only labels that successful
 * outcome instead of making UI code infer it from a recovery boolean.
 */
export function parseProductProgressForLoad(
  source: string,
  support: CatalogSupportIndex,
  expectedMode: PracticeMode,
  expectedLayoutId: string,
  expectedCurriculumPolicyVersion: string,
  utterancePolicy: FrequencyFirstUtterancePolicy,
): ProductProgressParseResult {
  const progress = parseProductProgress(
    source,
    support,
    expectedMode,
    expectedLayoutId,
    expectedCurriculumPolicyVersion,
    utterancePolicy,
  );
  if (progress === null) return { progress: null, status: "invalid" };
  return {
    progress,
    status: sourceSchemaVersion(source) === PRODUCT_PROGRESS_SCHEMA_VERSION
      ? "loaded"
      : "migrated",
  };
}
