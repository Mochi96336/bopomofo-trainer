import type { PracticeMode } from "../core/model.js";
import { createEmptyCurriculumProfile, profileFromAggregates } from "../curriculum/simulator.js";
import type {
  CatalogSupportIndex,
  CurriculumBindingRecord,
  CurriculumProfile,
} from "../curriculum/types.js";
import {
  createFrequencyFirstSelectionState,
  validateFrequencyFirstUtterancePolicy,
  type FrequencyFirstSelectionState,
  type FrequencyFirstUtterancePolicy,
} from "../curriculum/frequency-first-utterance.js";
import { createEmptyMeasurementSummaryV2 } from "../measurement-v2/aggregate.js";
import { legacySelectionMeasurementView } from "../measurement-v2/legacy-selection-view.js";
import { parseMeasurementSummaryV2 } from "../measurement-v2/serialize.js";
import {
  PRODUCT_MEASUREMENT_EPOCH,
  PRODUCT_PROGRESS_SCHEMA_VERSION,
  type ProductProgress,
  type ProductRoundSummary,
} from "./types.js";

const RECENT_SUMMARY_LIMIT = 12;
const LEGACY_PRODUCT_PROGRESS_SCHEMA_VERSION = 6;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0;
}

function parseSummary(value: unknown): ProductRoundSummary | null {
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

function parseSelectionState(
  value: unknown,
  policy: FrequencyFirstUtterancePolicy,
): FrequencyFirstSelectionState | null {
  if (
    !isRecord(value)
    || value.policyVersion !== policy.version
    || !Array.isArray(value.recentUtteranceIds)
    || !Array.isArray(value.recentTemplateIds)
    || value.recentUtteranceIds.some((item) => typeof item !== "string")
    || value.recentTemplateIds.some((item) => typeof item !== "string")
    || value.recentUtteranceIds.length > policy.recentUtteranceLimit
    || value.recentTemplateIds.length > policy.recentTemplateLimit
  ) return null;
  return {
    policyVersion: policy.version,
    recentUtteranceIds: value.recentUtteranceIds as string[],
    recentTemplateIds: value.recentTemplateIds as string[],
  };
}

function validSharedEnvelope(
  parsed: Record<string, unknown>,
  support: CatalogSupportIndex,
  expectedMode: PracticeMode,
  expectedLayoutId: string,
  expectedCurriculumPolicyVersion: string,
): {
  readonly validTokens: ReadonlySet<string>;
  readonly completedRounds: number;
  readonly recentEntryIds: readonly string[];
  readonly recentTokenIds: readonly string[];
} | null {
  if (
    typeof parsed.seed !== "string"
    || parsed.seed.length === 0
    || parsed.mode !== expectedMode
    || parsed.layoutId !== expectedLayoutId
    || parsed.curriculumPolicyVersion !== expectedCurriculumPolicyVersion
    || !isNonNegativeInteger(parsed.practiceRoundsCompleted)
    || !Array.isArray(parsed.recentSummaries)
    || !isRecord(parsed.curriculum)
    || !isNonNegativeInteger(parsed.curriculum.round)
    || parsed.curriculum.round !== parsed.practiceRoundsCompleted
    || !isRecord(parsed.curriculum.lastFocusedRounds)
    || !Array.isArray(parsed.curriculum.recentEntryIds)
    || !Array.isArray(parsed.curriculum.recentTokenIds)
  ) return null;

  const validTokens = new Set(Object.keys(support.byToken));
  const recentEntryIds = parsed.curriculum.recentEntryIds;
  const recentTokenIds = parsed.curriculum.recentTokenIds;
  if (
    recentEntryIds.some((entryId) =>
      typeof entryId !== "string" || support.entriesById[entryId] === undefined,
    )
    || recentTokenIds.some((tokenId) => typeof tokenId !== "string" || !validTokens.has(tokenId))
  ) return null;
  return {
    validTokens,
    completedRounds: parsed.practiceRoundsCompleted as number,
    recentEntryIds: recentEntryIds as string[],
    recentTokenIds: recentTokenIds as string[],
  };
}

function rebuildCurriculum(
  parsed: Record<string, unknown>,
  support: CatalogSupportIndex,
  mode: PracticeMode,
  layoutId: string,
  progress: Pick<ProductProgress, "measurements" | "practiceRoundsCompleted">,
  recentEntryIds: readonly string[],
  recentTokenIds: readonly string[],
): CurriculumProfile | null {
  if (!isRecord(parsed.curriculum) || !isRecord(parsed.curriculum.lastFocusedRounds)) return null;
  const legacyBindings = Object.values(legacySelectionMeasurementView(progress.measurements).bindings);
  const base = profileFromAggregates(
    support,
    mode,
    layoutId,
    legacyBindings,
    progress.practiceRoundsCompleted,
  );
  const bindings: Record<string, CurriculumBindingRecord> = {};
  for (const [tokenId, record] of Object.entries(base.bindings)) {
    const value = parsed.curriculum.lastFocusedRounds[tokenId];
    if (value !== null && value !== undefined
      && (!isNonNegativeInteger(value) || (value as number) > base.round)) return null;
    bindings[tokenId] = {
      ...record,
      lastFocusedRound: value === undefined ? null : value as number | null,
    };
  }
  return {
    ...base,
    bindings,
    recentEntryIds,
    recentTokenIds,
  };
}

export function createFreshProductProgress(
  support: CatalogSupportIndex,
  seed: string,
  mode: PracticeMode,
  layoutId: string,
  curriculumPolicyVersion: string,
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
    curriculumPolicyVersion,
    curriculum: createEmptyCurriculumProfile(support, mode, layoutId),
    selection: createFrequencyFirstSelectionState(utterancePolicy),
    practiceRoundsCompleted: 0,
    recentSummaries: [],
  };
}

export function serializeProductProgress(progress: ProductProgress): string {
  const lastFocusedRounds = Object.fromEntries(
    Object.entries(progress.curriculum.bindings).map(([tokenId, record]) => [
      tokenId,
      record.lastFocusedRound,
    ]),
  );
  return JSON.stringify({
    schemaVersion: progress.schemaVersion,
    measurementEpoch: progress.measurementEpoch,
    seed: progress.seed,
    mode: progress.mode,
    layoutId: progress.layoutId,
    measurements: progress.measurements,
    curriculumPolicyVersion: progress.curriculumPolicyVersion,
    curriculum: {
      round: progress.curriculum.round,
      lastFocusedRounds,
      recentEntryIds: progress.curriculum.recentEntryIds,
      recentTokenIds: progress.curriculum.recentTokenIds,
    },
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
  expectedCurriculumPolicyVersion: string,
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
  if (version !== PRODUCT_PROGRESS_SCHEMA_VERSION && version !== LEGACY_PRODUCT_PROGRESS_SCHEMA_VERSION) {
    return null;
  }

  validateFrequencyFirstUtterancePolicy(utterancePolicy);
  const envelope = validSharedEnvelope(
    parsed,
    support,
    expectedMode,
    expectedLayoutId,
    expectedCurriculumPolicyVersion,
  );
  if (envelope === null) return null;

  const summaries = (parsed.recentSummaries as unknown[]).map(parseSummary);
  if (summaries.some((summary) => summary === null)) return null;
  const selection = parseSelectionState(parsed.selection, utterancePolicy);
  if (selection === null) return null;

  // Schema 6 evidence was gathered under strict canonical input order. Carrying
  // any measurement-derived record into the unordered model would preserve false
  // errors/confusions and fake timing. The migration therefore starts a complete
  // measurement epoch while retaining identity, round count, curriculum recency,
  // and selection continuity only.
  const migratedFromLegacy = version === LEGACY_PRODUCT_PROGRESS_SCHEMA_VERSION;
  const measurements = migratedFromLegacy
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

  const progressBase = {
    measurements,
    practiceRoundsCompleted: envelope.completedRounds,
  };
  const curriculum = rebuildCurriculum(
    parsed,
    support,
    expectedMode,
    expectedLayoutId,
    progressBase,
    envelope.recentEntryIds,
    envelope.recentTokenIds,
  );
  if (curriculum === null) return null;

  return {
    schemaVersion: PRODUCT_PROGRESS_SCHEMA_VERSION,
    measurementEpoch: PRODUCT_MEASUREMENT_EPOCH,
    seed: parsed.seed as string,
    mode: expectedMode,
    layoutId: expectedLayoutId,
    measurements,
    curriculumPolicyVersion: expectedCurriculumPolicyVersion,
    curriculum,
    selection,
    practiceRoundsCompleted: envelope.completedRounds,
    recentSummaries: migratedFromLegacy
      ? []
      : (summaries as ProductRoundSummary[]).slice(-RECENT_SUMMARY_LIMIT),
  };
}

export function appendRecentSummary(
  progress: ProductProgress,
  summary: ProductRoundSummary,
): readonly ProductRoundSummary[] {
  return [...progress.recentSummaries, summary].slice(-RECENT_SUMMARY_LIMIT);
}
