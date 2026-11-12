import type { PracticeMode } from "../core/model.js";
import type { CatalogSupportIndex } from "../curriculum/types.js";
import {
  createFrequencyFirstSelectionState,
  validateFrequencyFirstUtterancePolicy,
  type FrequencyFirstSelectionState,
  type FrequencyFirstUtterancePolicy,
} from "../curriculum/frequency-first-utterance.js";
import { createEmptyMeasurementSummaryV2 } from "../measurement-v2/aggregate.js";
import { parseMeasurementSummaryV2 } from "../measurement-v2/serialize.js";
import {
  PRODUCT_MEASUREMENT_EPOCH,
  PRODUCT_PROGRESS_SCHEMA_VERSION,
  type ProductHistoryRoundSummary,
  type ProductProgress,
  type ProductRoundSummary,
} from "./types.js";

const RECENT_SUMMARY_LIMIT = 12;
const PREVIOUS_PRODUCT_PROGRESS_SCHEMA_VERSION = 8;
const LEGACY_PRODUCT_PROGRESS_SCHEMA_VERSION = 7;
const LEGACY_MEASUREMENT_EPOCH_SCHEMA_VERSION = 6;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

function parseSummary(value: unknown): ProductHistoryRoundSummary | null {
  if (!isRecord(value) || !Array.isArray(value.entryIds)) return null;
  const kind = value.kind;
  const focusEvidence = value.focusEvidence;
  if (
    (kind !== "practice" && kind !== "evaluation")
    || typeof value.exerciseId !== "string"
    || typeof value.completedAt !== "string"
    || Number.isNaN(Date.parse(value.completedAt))
    || value.entryIds.length === 0
    || value.entryIds.some((entryId) => typeof entryId !== "string")
    || (value.focusTokenId !== null && typeof value.focusTokenId !== "string")
    || (focusEvidence !== null && focusEvidence !== "timed" && focusEvidence !== "correctness-only")
    || !isNonNegativeInteger(value.attempts)
    || !isNonNegativeInteger(value.errors)
    || !isNonNegativeInteger(value.timingSamples)
    || (value.errors as number) > (value.attempts as number)
    || (value.timingSamples as number) > (value.attempts as number)
  ) return null;
  if (kind === "evaluation" && (value.focusTokenId !== null || focusEvidence !== null)) return null;
  if ((value.focusTokenId === null) !== (focusEvidence === null)) return null;

  const utteranceId = typeof value.utteranceId === "string" ? value.utteranceId : value.exerciseId;
  const templateId = value.templateId === undefined || value.templateId === null
    ? null
    : typeof value.templateId === "string" ? value.templateId : undefined;
  if (templateId === undefined) return null;

  return {
    kind,
    exerciseId: value.exerciseId,
    completedAt: value.completedAt,
    entryIds: value.entryIds as string[],
    utteranceId,
    templateId,
    focusTokenId: value.focusTokenId as string | null,
    focusEvidence,
    attempts: value.attempts as number,
    errors: value.errors as number,
    timingSamples: value.timingSamples as number,
  };
}

function parseKnownEntryIds(
  value: unknown,
  support: CatalogSupportIndex,
): readonly string[] | null {
  if (
    !Array.isArray(value)
    || value.some((entryId) =>
      typeof entryId !== "string" || support.entriesById[entryId] === undefined)
  ) return null;
  return value as string[];
}

function parseLegacyRecentEntryIds(
  parsed: Record<string, unknown>,
  support: CatalogSupportIndex,
  completedRounds: number,
): readonly string[] | null {
  if (!isRecord(parsed.curriculum)) return null;
  if (
    !isNonNegativeInteger(parsed.curriculum.round)
    || parsed.curriculum.round !== completedRounds
  ) return null;
  return parseKnownEntryIds(parsed.curriculum.recentEntryIds, support);
}

function parseSelectionState(
  value: unknown,
  policy: FrequencyFirstUtterancePolicy,
  support: CatalogSupportIndex,
  legacyRecentEntryIds: readonly string[] | null,
  allowLegacyPolicy: boolean,
): FrequencyFirstSelectionState | null {
  if (!isRecord(value)) return null;
  const legacy = allowLegacyPolicy && value.policyVersion === "frequency-first-utterance-v1"
    && policy.version === "frequency-first-utterance-v2";
  if (!legacy && value.policyVersion !== policy.version) return null;
  const strings = (items: unknown, limit: number): readonly string[] | null =>
    Array.isArray(items) && items.length <= limit && items.every(item => typeof item === "string")
      ? items as string[] : null;
  const oldUtterances = strings(value.recentUtteranceIds, policy.recentUtteranceLimit);
  if (oldUtterances === null) return null;
  const recentEntryIds = legacyRecentEntryIds ?? parseKnownEntryIds(value.recentEntryIds, support);
  if (recentEntryIds === null) return null;
  if (legacy && strings(value.recentTemplateIds, policy.recentTemplateLimit) === null) return null;
  const recentWrittenForms = legacy
    ? [...new Set(recentEntryIds.map(id => support.entriesById[id]!.prompt.text))].slice(-policy.recentEntryLimit)
    : strings(value.recentWrittenForms, policy.recentEntryLimit);
  const recentConstructionIds = legacy ? [] : strings(value.recentConstructionIds, policy.recentConstructionLimit);
  if (recentWrittenForms === null || recentConstructionIds === null
    || (!legacy && recentEntryIds.length > policy.recentEntryLimit)) return null;
  return {
    policyVersion: policy.version,
    recentEntryIds: recentEntryIds.slice(-policy.recentEntryLimit),
    // Old derivation IDs are not visible-text identities. Never reinterpret them.
    recentUtteranceIds: legacy ? [] : oldUtterances,
    recentWrittenForms,
    recentConstructionIds,
  };
}

function validSharedEnvelope(
  parsed: Record<string, unknown>,
  support: CatalogSupportIndex,
  expectedMode: PracticeMode,
  expectedLayoutId: string,
): {
  readonly validTokens: ReadonlySet<string>;
  readonly completedRounds: number;
} | null {
  if (
    typeof parsed.seed !== "string"
    || parsed.seed.length === 0
    || parsed.mode !== expectedMode
    || parsed.layoutId !== expectedLayoutId
    || !isNonNegativeInteger(parsed.practiceRoundsCompleted)
    || !Array.isArray(parsed.recentSummaries)
  ) return null;

  return {
    validTokens: new Set(Object.keys(support.byToken)),
    completedRounds: parsed.practiceRoundsCompleted as number,
  };
}

export function createFreshProductProgress(
  seed: string,
  mode: PracticeMode,
  layoutId: string,
  utterancePolicy: FrequencyFirstUtterancePolicy,
): ProductProgress {
  if (seed.length === 0) throw new Error("product seed must not be empty");
  validateFrequencyFirstUtterancePolicy(utterancePolicy);
  return {
    schemaVersion: PRODUCT_PROGRESS_SCHEMA_VERSION,
    measurementEpoch: PRODUCT_MEASUREMENT_EPOCH,
    seed,
    mode,
    layoutId,
    measurements: createEmptyMeasurementSummaryV2(),
    selection: createFrequencyFirstSelectionState(utterancePolicy),
    practiceRoundsCompleted: 0,
    recentSummaries: [],
  };
}

export function serializeProductProgress(progress: ProductProgress): string {
  return JSON.stringify({
    schemaVersion: progress.schemaVersion,
    measurementEpoch: progress.measurementEpoch,
    seed: progress.seed,
    mode: progress.mode,
    layoutId: progress.layoutId,
    measurements: progress.measurements,
    selection: progress.selection,
    practiceRoundsCompleted: progress.practiceRoundsCompleted,
    recentSummaries: progress.recentSummaries,
  });
}

export function parseProductProgress(
  source: string,
  support: CatalogSupportIndex,
  expectedMode: PracticeMode,
  expectedLayoutId: string,
  utterancePolicy: FrequencyFirstUtterancePolicy,
): ProductProgress | null {
  let parsedUnknown: unknown;
  try {
    parsedUnknown = JSON.parse(source) as unknown;
  } catch {
    return null;
  }
  if (!isRecord(parsedUnknown)) return null;
  const parsed = parsedUnknown;
  const version = parsed.schemaVersion;
  if (
    version !== PRODUCT_PROGRESS_SCHEMA_VERSION
    && version !== PREVIOUS_PRODUCT_PROGRESS_SCHEMA_VERSION
    && version !== LEGACY_PRODUCT_PROGRESS_SCHEMA_VERSION
    && version !== LEGACY_MEASUREMENT_EPOCH_SCHEMA_VERSION
  ) return null;

  validateFrequencyFirstUtterancePolicy(utterancePolicy);
  const envelope = validSharedEnvelope(
    parsed,
    support,
    expectedMode,
    expectedLayoutId,
  );
  if (envelope === null) return null;

  const legacyRecentEntryIds = (version === PRODUCT_PROGRESS_SCHEMA_VERSION || version === PREVIOUS_PRODUCT_PROGRESS_SCHEMA_VERSION)
    ? null
    : parseLegacyRecentEntryIds(parsed, support, envelope.completedRounds);
  if (version !== PRODUCT_PROGRESS_SCHEMA_VERSION && version !== PREVIOUS_PRODUCT_PROGRESS_SCHEMA_VERSION && legacyRecentEntryIds === null) {
    return null;
  }

  const selection = parseSelectionState(
    parsed.selection,
    utterancePolicy,
    support,
    legacyRecentEntryIds,
    version !== PRODUCT_PROGRESS_SCHEMA_VERSION,
  );
  if (selection === null) return null;

  const migratedFromOldMeasurementEpoch =
    version === LEGACY_MEASUREMENT_EPOCH_SCHEMA_VERSION;
  const measurements = migratedFromOldMeasurementEpoch
    ? createEmptyMeasurementSummaryV2()
    : parsed.measurementEpoch === PRODUCT_MEASUREMENT_EPOCH
      ? parseMeasurementSummaryV2(
          parsed.measurements,
          expectedMode,
          expectedLayoutId,
          envelope.validTokens,
        )
      : null;
  if (measurements === null) return null;

  const summaries = (parsed.recentSummaries as unknown[]).map(parseSummary);
  if (summaries.some((summary) => summary === null)) return null;

  return {
    schemaVersion: PRODUCT_PROGRESS_SCHEMA_VERSION,
    measurementEpoch: PRODUCT_MEASUREMENT_EPOCH,
    seed: parsed.seed as string,
    mode: expectedMode,
    layoutId: expectedLayoutId,
    measurements,
    selection,
    practiceRoundsCompleted: envelope.completedRounds,
    recentSummaries: migratedFromOldMeasurementEpoch
      ? []
      : (summaries as ProductHistoryRoundSummary[]).slice(-RECENT_SUMMARY_LIMIT),
  };
}

export function appendRecentSummary(
  progress: ProductProgress,
  summary: ProductRoundSummary,
): readonly ProductHistoryRoundSummary[] {
  return [...progress.recentSummaries, summary].slice(-RECENT_SUMMARY_LIMIT);
}
