import type { PracticeInput } from "../practice/interaction-input.js";
import type { InteractionTraceV2 } from "../practice/interaction-session-v2.js";
import {
  applyInteractionInputV2,
  createInteractionSessionV2,
} from "../practice/interaction-session-v2.js";
import {
  aggregateMeasurementObservationsV2,
  type MeasurementSummaryV2,
} from "../measurement-v2/aggregate.js";
import { deriveMeasurementObservationsV2 } from "../measurement-v2/derive-observations.js";
import {
  FREQUENCY_FIRST_UTTERANCE_POLICY,
  selectFormalSyntaxUtterance,
  updateFrequencyFirstSelectionState,
  validateFrequencyFirstUtterancePolicy,
  type FrequencyFirstUtterancePolicy,
} from "../curriculum/frequency-first-utterance.js";
import { PHASE_4_CURRICULUM_POLICY } from "../curriculum/policy.js";
import { createSeededRandom } from "../curriculum/random.js";
import { createCatalogSupportIndex, entryTokenSet } from "../curriculum/support.js";
import type {
  CurriculumBindingRecord,
  CurriculumProfile,
} from "../curriculum/types.js";
import {
  appendRecentSummary,
  createFreshProductProgress,
} from "./progress.js";
import type {
  ProductCatalogs,
  ProductEnvironment,
  ProductProgress,
  ProductRound,
  ProductRoundSummary,
  ProductState,
} from "./types.js";

function validateSyntaxProfileCoverage(catalogs: ProductCatalogs): void {
  const entryIds = new Set(
    [...catalogs.practice, ...catalogs.evaluation].map((entry) => entry.id),
  );
  const profileIds = new Set<string>();
  const profiledEntryIds = new Set<string>();
  for (const profile of catalogs.syntaxProfiles) {
    if (profileIds.has(profile.id)) {
      throw new Error(`product syntax profiles contain duplicate ID: ${profile.id}`);
    }
    if (!entryIds.has(profile.entryId)) {
      throw new Error(`product syntax profile references unknown entry: ${profile.entryId}`);
    }
    profileIds.add(profile.id);
    profiledEntryIds.add(profile.entryId);
  }
  const missing = [...entryIds].filter((entryId) => !profiledEntryIds.has(entryId));
  if (missing.length > 0) {
    throw new Error(`product catalog entry is missing syntax profiles: ${missing.join(", ")}`);
  }
}

export function createProductEnvironment(
  catalogs: ProductCatalogs,
  utterancePolicy: FrequencyFirstUtterancePolicy = FREQUENCY_FIRST_UTTERANCE_POLICY,
): ProductEnvironment {
  if (catalogs.practice.length === 0) {
    throw new Error("product requires practice catalog entries");
  }
  const practiceIds = new Set(catalogs.practice.map((entry) => entry.id));
  const evaluationIds = new Set(catalogs.evaluation.map((entry) => entry.id));
  if (practiceIds.size !== catalogs.practice.length) {
    throw new Error("practice catalog contains duplicate entry IDs");
  }
  if (evaluationIds.size !== catalogs.evaluation.length) {
    throw new Error("evaluation catalog contains duplicate entry IDs");
  }
  if ([...evaluationIds].some((entryId) => practiceIds.has(entryId))) {
    throw new Error("practice and evaluation catalogs must be disjoint");
  }
  validateSyntaxProfileCoverage(catalogs);
  validateFrequencyFirstUtterancePolicy(utterancePolicy);
  return {
    catalogs,
    practiceSupport: createCatalogSupportIndex(catalogs.practice),
    evaluationSupport: createCatalogSupportIndex(catalogs.evaluation),
    curriculumPolicy: PHASE_4_CURRICULUM_POLICY,
    utterancePolicy,
  };
}

export function createFreshProgressForEnvironment(
  environment: ProductEnvironment,
  seed: string,
  mode: ProductProgress["mode"],
  layoutId: string,
): ProductProgress {
  return createFreshProductProgress(
    environment.practiceSupport,
    seed,
    mode,
    layoutId,
    environment.curriculumPolicy.version,
    environment.utterancePolicy,
  );
}

function selectRound(
  environment: ProductEnvironment,
  progress: ProductProgress,
): ProductRound {
  const selection = selectFormalSyntaxUtterance({
    entries: environment.catalogs.practice,
    bindingEvidence: Object.values(progress.measurements.semantic.bindings),
    mode: progress.mode,
    layoutId: progress.layoutId,
    history: {
      recentEntryIds: progress.curriculum.recentEntryIds,
      recentUtteranceIds: progress.selection.recentUtteranceIds,
      recentTemplateIds: progress.selection.recentTemplateIds,
    },
    policy: environment.utterancePolicy,
    profiles: environment.catalogs.syntaxProfiles,
    random: createSeededRandom(
      `${progress.seed}:practice:${progress.practiceRoundsCompleted}`,
    ),
  });
  return {
    kind: "practice",
    exercise: {
      id: `practice-${progress.practiceRoundsCompleted + 1}`,
      mode: progress.mode,
      layoutId: progress.layoutId,
      entries: selection.utterance.entries,
    },
    focus: null,
    selection,
  };
}

export function createProductState(
  environment: ProductEnvironment,
  progress: ProductProgress,
  startedAtMs: number,
): ProductState {
  const round = selectRound(environment, progress);
  return {
    progress,
    round,
    session: createInteractionSessionV2(round.exercise, startedAtMs),
    summary: null,
  };
}

function isMappedAttempt(trace: InteractionTraceV2): boolean {
  return trace.outcome === "accepted-component"
    || trace.outcome === "accepted-tone"
    || trace.outcome === "unexpected-component"
    || trace.outcome === "unexpected-tone"
    || trace.outcome === "duplicate-component"
    || trace.outcome === "premature-tone";
}

function isMappedError(trace: InteractionTraceV2): boolean {
  return isMappedAttempt(trace) && !trace.accepted;
}

function sumSessionMetrics(
  traces: readonly InteractionTraceV2[],
  measurements: MeasurementSummaryV2,
): {
  readonly attempts: number;
  readonly errors: number;
  readonly timingSamples: number;
} {
  const attempts = traces.filter(isMappedAttempt).length;
  const errors = traces.filter(isMappedError).length;
  const timingSamples = Object.values(measurements.semantic.bindings).reduce(
    (total, aggregate) => total + aggregate.timingSamples,
    0,
  );
  return { attempts, errors, timingSamples };
}

function updateCurriculumAfterPractice(
  profile: CurriculumProfile,
  cumulativeMeasurements: ProductProgress["measurements"],
  round: ProductRound,
): CurriculumProfile {
  const aggregates = new Map(
    Object.values(cumulativeMeasurements.semantic.bindings).map((aggregate) => [
      aggregate.scope.tokenId,
      aggregate,
    ]),
  );
  const bindings: Record<string, CurriculumBindingRecord> = {};
  for (const [tokenId, record] of Object.entries(profile.bindings)) {
    bindings[tokenId] = {
      ...record,
      aggregate: aggregates.get(tokenId) ?? record.aggregate,
    };
  }
  const recentTokenIds = [
    ...new Set(round.exercise.entries.flatMap((entry) => [...entryTokenSet(entry)])),
  ];
  return {
    ...profile,
    round: profile.round + 1,
    bindings,
    recentEntryIds: round.exercise.entries.map((entry) => entry.id),
    recentTokenIds,
  };
}

function finalizeRound(
  environment: ProductEnvironment,
  state: ProductState,
  completedAt: string,
): ProductState {
  const observations = deriveMeasurementObservationsV2(
    state.round.exercise,
    state.session.traces,
  );
  const sessionMeasurements = aggregateMeasurementObservationsV2(observations);
  const metrics = sumSessionMetrics(state.session.traces, sessionMeasurements);
  const summary: ProductRoundSummary = {
    kind: "practice",
    exerciseId: state.round.exercise.id,
    completedAt,
    entryIds: state.round.exercise.entries.map((entry) => entry.id),
    utteranceId: state.round.selection.utterance.id,
    templateId: state.round.selection.utterance.templateId,
    focusTokenId: null,
    focusEvidence: null,
    ...metrics,
  };

  const measurements = aggregateMeasurementObservationsV2(
    observations,
    state.progress.measurements,
  );
  const curriculum = updateCurriculumAfterPractice(
    state.progress.curriculum,
    measurements,
    state.round,
  );
  const selection = updateFrequencyFirstSelectionState(
    state.progress.selection,
    state.round.selection,
    environment.utterancePolicy,
  );
  const progress: ProductProgress = {
    ...state.progress,
    measurements,
    curriculum,
    selection,
    practiceRoundsCompleted: state.progress.practiceRoundsCompleted + 1,
    recentSummaries: appendRecentSummary(state.progress, summary),
  };
  return { ...state, progress, summary };
}

export function applyProductInput(
  environment: ProductEnvironment,
  state: ProductState,
  input: PracticeInput,
  completedAt: string,
): ProductState {
  if (state.summary !== null || state.session.completed) return state;
  const session = applyInteractionInputV2(state.session, input);
  const next = { ...state, session };
  return session.completed ? finalizeRound(environment, next, completedAt) : next;
}

export function startNextProductRound(
  environment: ProductEnvironment,
  state: ProductState,
  startedAtMs: number,
): ProductState {
  if (state.summary === null) {
    throw new Error("cannot start the next round before completing the current round");
  }
  return createProductState(environment, state.progress, startedAtMs);
}
