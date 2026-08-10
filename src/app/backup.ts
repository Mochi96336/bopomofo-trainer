import {
  parsePilotHistory,
  pilotHistoryFromProgress,
  serializePilotHistory,
  type PilotHistory,
} from "../product/pilot-history.js";
import { parseProductProgress, serializeProductProgress } from "../product/progress.js";
import type { ProductEnvironment, ProductProgress } from "../product/types.js";
import {
  parseProgressHistory,
  serializeProgressHistory,
} from "../progress-history/serialize.js";
import { createEmptyProgressHistory } from "../progress-history/update.js";
import type { ProgressHistory } from "../progress-history/types.js";
import { productProgressReferencesAreKnown } from "./product-progress-references.js";
import { parseSelectionTuning, type SelectionTuning } from "./selection-tuning.js";

export const PRODUCT_BACKUP_VERSION = 2 as const;
const LEGACY_PRODUCT_PROGRESS_SCHEMA_VERSION = 6;

export interface ProductBackup {
  readonly backupVersion: typeof PRODUCT_BACKUP_VERSION;
  readonly exportedAt: string;
  readonly progress: ProductProgress;
  readonly pilotHistory: PilotHistory;
  readonly progressHistory: ProgressHistory;
  readonly selectionTuning: SelectionTuning;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createProductBackup(
  progress: ProductProgress,
  pilotHistory: PilotHistory,
  progressHistory: ProgressHistory,
  selectionTuning: SelectionTuning,
  exportedAt = new Date().toISOString(),
): string {
  return `${JSON.stringify({
    backupVersion: PRODUCT_BACKUP_VERSION,
    exportedAt,
    progress: JSON.parse(serializeProductProgress(progress)) as unknown,
    pilotHistory: JSON.parse(serializePilotHistory(pilotHistory)) as unknown,
    progressHistory: JSON.parse(serializeProgressHistory(progressHistory)) as unknown,
    selectionTuning,
  }, null, 2)}\n`;
}

export function parseProductBackup(
  source: string,
  environment: ProductEnvironment,
  mode: ProductProgress["mode"],
  layoutId: string,
): ProductBackup | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source) as unknown;
  } catch {
    return null;
  }
  if (!isRecord(parsed)
    || parsed.backupVersion !== PRODUCT_BACKUP_VERSION
    || typeof parsed.exportedAt !== "string"
    || !isRecord(parsed.progress)
    || !isRecord(parsed.pilotHistory)
    || !isRecord(parsed.progressHistory)
    || !isRecord(parsed.selectionTuning)) return null;

  const legacyMeasurementEpoch = parsed.progress.schemaVersion === LEGACY_PRODUCT_PROGRESS_SCHEMA_VERSION;
  const progress = parseProductProgress(
    JSON.stringify(parsed.progress),
    environment.practiceSupport,
    mode,
    layoutId,
    environment.curriculumPolicy.version,
    environment.utterancePolicy,
  );
  const selectionTuning = parseSelectionTuning(JSON.stringify(parsed.selectionTuning));
  if (progress === null
    || !productProgressReferencesAreKnown(progress, environment)
    || selectionTuning === null) return null;

  const completedRounds = progress.practiceRoundsCompleted;
  let pilotHistory: PilotHistory;
  let progressHistory: ProgressHistory;

  if (legacyMeasurementEpoch) {
    // Schema 6 progress is deliberately migrated into a new measurement epoch.
    // Its companion Pilot/trend payloads describe the same strict-order evidence
    // that was just discarded, so importing them would silently reintroduce it.
    pilotHistory = pilotHistoryFromProgress(progress);
    progressHistory = createEmptyProgressHistory(mode, layoutId);
  } else {
    const parsedPilotHistory = parsePilotHistory(JSON.stringify(parsed.pilotHistory), environment);
    if (parsedPilotHistory === null
      || parsedPilotHistory.records.some((record) => record.roundNumber > completedRounds)) {
      return null;
    }
    pilotHistory = parsedPilotHistory;

    const parsedProgressHistory = parseProgressHistory(
      JSON.stringify(parsed.progressHistory),
      mode,
      layoutId,
      new Set(Object.keys(environment.practiceSupport.byToken)),
    );
    if (parsedProgressHistory === null
      || parsedProgressHistory.lastCompletedRound > completedRounds) {
      return null;
    }
    progressHistory = parsedProgressHistory;
  }

  return {
    backupVersion: PRODUCT_BACKUP_VERSION,
    exportedAt: parsed.exportedAt,
    progress,
    pilotHistory,
    progressHistory,
    selectionTuning,
  };
}
