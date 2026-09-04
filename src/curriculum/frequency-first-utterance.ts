import type {
  CatalogEntry,
  PracticeMode,
  RandomSource,
  TokenId,
} from "../core/model.js";
import { catalogEntryFrequencyWeight } from "../commonness/catalog-projection.js";
import { transitionScopeKey } from "../measurement/aggregate.js";
import type { MeasurementSummary } from "../measurement/types.js";
import type {
  GrammarAnnotation,
  GrammarRole,
  GrammarTemplate,
  GrammarUtteranceCandidate,
} from "../grammar/types.js";
import { countStructuralDerivationShapes } from "../syntax/count.js";
import { DEFAULT_DERIVATION_BOUNDS } from "../syntax/features.js";
import { FORMAL_SYNTAX_RULES } from "../syntax/grammar.js";
import type { DerivationBounds, RuntimeSyntaxProfile } from "../syntax/types.js";
import {
  composeFormalSyntaxUtterances,
  type FormalSyntaxUtteranceInput,
} from "./formal-syntax-utterance.js";
import {
  generateSlotWeightedGrammar,
  type GrammarSlotSelectionTrace,
  type SlotWeightedGrammarGeneration,
} from "./slot-weighted-grammar.js";
import type { LearnerBindingEvidence } from "./types.js";

const MAXIMUM_RECENT_UTTERANCE_ATTEMPTS = 4;

export interface FrequencyFirstUtterancePolicy {
  readonly version: string;
  readonly minimumBindingAttempts: number;
  readonly minimumBindingTimingSamples: number;
  readonly minimumTransitionTimingSamples: number;
  readonly maximumExpectedTokenBoost: number;
  readonly maximumTransitionBoost: number;
  readonly maximumCombinedLearnerBoost: number;
  readonly errorBoostScale: number;
  readonly timingBoostScale: number;
  readonly transitionBoostScale: number;
  readonly recentEntryPenalty: number;
  readonly recentUtterancePenalty: number;
  readonly recentTemplatePenalty: number;
  readonly recentUtteranceLimit: number;
  readonly recentTemplateLimit: number;
}

export const FREQUENCY_FIRST_UTTERANCE_POLICY: FrequencyFirstUtterancePolicy = {
  version: "frequency-first-utterance-v1",
  minimumBindingAttempts: 4,
  minimumBindingTimingSamples: 3,
  minimumTransitionTimingSamples: 3,
  maximumExpectedTokenBoost: 1.45,
  maximumTransitionBoost: 1.25,
  maximumCombinedLearnerBoost: 1.5,
  errorBoostScale: 1.5,
  timingBoostScale: 0.35,
  transitionBoostScale: 0.3,
  recentEntryPenalty: 0.72,
  recentUtterancePenalty: 0.3,
  recentTemplatePenalty: 0.78,
  recentUtteranceLimit: 8,
  recentTemplateLimit: 6,
};

export interface FrequencyFirstSelectionState {
  readonly policyVersion: string;
  readonly recentUtteranceIds: readonly string[];
  readonly recentTemplateIds: readonly string[];
}

export interface UtteranceSelectionHistory {
  readonly recentEntryIds: readonly string[];
  readonly recentUtteranceIds: readonly string[];
  readonly recentTemplateIds: readonly string[];
}

export interface ExpectedTokenBoostTrace {
  readonly tokenId: TokenId;
  readonly attempts: number;
  readonly errors: number;
  readonly timingSamples: number;
  readonly errorRate: number | null;
  readonly timingRatio: number | null;
  readonly boost: number;
}

export interface TransitionBoostTrace {
  readonly fromToken: TokenId;
  readonly toToken: TokenId;
  readonly timingSamples: number;
  readonly timingRatio: number | null;
  readonly boost: number;
}

export interface EntrySelectionScore {
  readonly entryId: string;
  readonly frequencyBase: number;
  readonly expectedTokenBoost: number;
  readonly transitionBoost: number;
  readonly combinedLearnerBoost: number;
  readonly recentEntryFactor: number;
  readonly totalWeight: number;
  readonly expectedTokenTrace: readonly ExpectedTokenBoostTrace[];
  readonly transitionTrace: readonly TransitionBoostTrace[];
}

export interface TemplateSelectionScore {
  readonly templateId: string;
  readonly recentTemplateFactor: number;
  readonly totalWeight: number;
}

export interface SlotSelectionScore {
  readonly slotKey: string;
  readonly role: GrammarRole;
  readonly selectedEntryId: string;
  readonly candidates: readonly EntrySelectionScore[];
}

export interface UtteranceCandidateScore {
  readonly utteranceId: string;
  readonly templateId: string | null;
  readonly entryIds: readonly string[];
  readonly frequencyBase: number;
  readonly expectedTokenBoost: number;
  readonly transitionBoost: number;
  readonly combinedLearnerBoost: number;
  readonly recentEntryFactor: number;
  readonly recentUtteranceFactor: number;
  readonly recentTemplateFactor: number;
  readonly totalWeight: number;
  readonly expectedTokenTrace: readonly ExpectedTokenBoostTrace[];
  readonly transitionTrace: readonly TransitionBoostTrace[];
}

export interface FrequencyFirstUtteranceSelection {
  readonly policyVersion: string;
  readonly utterance: GrammarUtteranceCandidate;
  readonly score: UtteranceCandidateScore;
  readonly templateCandidates: readonly TemplateSelectionScore[];
  readonly slotSelections: readonly SlotSelectionScore[];
  readonly generationAttempts: number;
  readonly grammarFallbackReasons: readonly string[];
}

export type LearnerEvidenceMode = "binding-only" | "legacy-binding-transition";

export type FormalSyntaxCompositionOverride = Pick<
  FormalSyntaxUtteranceInput,
  "rules" | "samplingMode" | "structuralTarget"
>;

export interface FrequencyFirstUtteranceInput {
  readonly entries: readonly CatalogEntry[];
  readonly annotations: Readonly<Record<string, GrammarAnnotation>>;
  readonly measurement: MeasurementSummary;
  readonly mode: PracticeMode;
  readonly layoutId: string;
  readonly history: UtteranceSelectionHistory;
  readonly policy: FrequencyFirstUtterancePolicy;
  readonly random: RandomSource;
  /** Legacy/research callers opt into canonical token-pair scoring by omission or explicitly. */
  readonly learnerEvidenceMode?: LearnerEvidenceMode;
  /** Production path: compact profiles admitted by the formal syntax gate. */
  readonly profiles?: readonly RuntimeSyntaxProfile[];
  /**
   * Optional construction-specific formal-syntax search space. This may narrow
   * grammar composition only; frequency/learner/history scoring stays owned by
   * this selector. It is meaningful only when runtime syntax profiles are used.
   */
  readonly formalSyntaxComposition?: FormalSyntaxCompositionOverride;
  /** Explicit compatibility-only templates. Production has no built-in list. */
  readonly templates?: readonly GrammarTemplate[];
}

export type FormalSyntaxUtteranceSelectionInput = Omit<
  FrequencyFirstUtteranceInput,
  "annotations" | "measurement" | "profiles" | "templates" | "learnerEvidenceMode"
> & {
  /** Measurement V2 semantic binding aggregates satisfy this contract directly. */
  readonly bindingEvidence: readonly LearnerBindingEvidence[];
  readonly profiles: readonly RuntimeSyntaxProfile[];
};

type FrequencyFirstScoringInput = Omit<
  FrequencyFirstUtteranceInput,
  "measurement" | "learnerEvidenceMode"
> & {
  readonly bindingsByToken: Readonly<Record<string, LearnerBindingEvidence>>;
  /** Canonical transition evidence exists only on the legacy/research path. */
  readonly legacyTransitions: MeasurementSummary["transitions"] | null;
};

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function geometricMean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return Math.exp(values.reduce((sum, value) => sum + Math.log(value), 0) / values.length);
}

function uniqueTokens(entries: readonly CatalogEntry[]): readonly TokenId[] {
  return [...new Set(
    entries.flatMap((entry) =>
      entry.syllables.flatMap((syllable) => syllable.tokens),
    ),
  )].sort(compareText);
}

function scopedBindingEvidence(
  evidence: readonly LearnerBindingEvidence[],
  mode: PracticeMode,
  layoutId: string,
): Readonly<Record<string, LearnerBindingEvidence>> {
  const bindings: Record<string, LearnerBindingEvidence> = {};
  for (const aggregate of evidence) {
    if (aggregate.scope.mode !== mode || aggregate.scope.layoutId !== layoutId) continue;
    bindings[aggregate.scope.tokenId] = aggregate;
  }
  return bindings;
}

function exactTransitions(
  entries: readonly CatalogEntry[],
): readonly { readonly fromToken: TokenId; readonly toToken: TokenId }[] {
  const keys = new Map<string, { fromToken: TokenId; toToken: TokenId }>();
  for (const entry of entries) {
    for (const syllable of entry.syllables) {
      for (let index = 1; index < syllable.tokens.length; index += 1) {
        const fromToken = syllable.tokens[index - 1]!;
        const toToken = syllable.tokens[index]!;
        keys.set(`${fromToken}\u0000${toToken}`, { fromToken, toToken });
      }
    }
  }
  return [...keys.values()].sort((left, right) =>
    compareText(left.fromToken, right.fromToken)
    || compareText(left.toToken, right.toToken)
  );
}

function expectedTokenTrace(
  entries: readonly CatalogEntry[],
  input: FrequencyFirstScoringInput,
): readonly ExpectedTokenBoostTrace[] {
  return uniqueTokens(entries).map((tokenId) => {
    const aggregate = input.bindingsByToken[tokenId];
    if (aggregate === undefined) {
      return {
        tokenId,
        attempts: 0,
        errors: 0,
        timingSamples: 0,
        errorRate: null,
        timingRatio: null,
        boost: 1,
      };
    }
    const errorRate = aggregate.attempts >= input.policy.minimumBindingAttempts
      ? aggregate.errors / aggregate.attempts
      : null;
    const timingRatio = aggregate.timingSamples >= input.policy.minimumBindingTimingSamples
      && aggregate.currentTimeToTypeMs !== null
      && aggregate.bestTimeToTypeMs !== null
      && aggregate.bestTimeToTypeMs > 0
      ? aggregate.currentTimeToTypeMs / aggregate.bestTimeToTypeMs
      : null;
    const errorContribution = errorRate === null ? 0 : errorRate * input.policy.errorBoostScale;
    const timingContribution = timingRatio === null
      ? 0
      : Math.max(0, timingRatio - 1) * input.policy.timingBoostScale;
    return {
      tokenId,
      attempts: aggregate.attempts,
      errors: aggregate.errors,
      timingSamples: aggregate.timingSamples,
      errorRate,
      timingRatio,
      boost: clamp(
        1 + errorContribution + timingContribution,
        1,
        input.policy.maximumExpectedTokenBoost,
      ),
    };
  });
}

function transitionTrace(
  entries: readonly CatalogEntry[],
  input: FrequencyFirstScoringInput,
): readonly TransitionBoostTrace[] {
  if (input.legacyTransitions === null) return [];
  return exactTransitions(entries).map(({ fromToken, toToken }) => {
    const aggregate = input.legacyTransitions![transitionScopeKey({
      mode: input.mode,
      layoutId: input.layoutId,
      fromToken,
      toToken,
    })];
    const timingRatio = aggregate !== undefined
      && aggregate.timingSamples >= input.policy.minimumTransitionTimingSamples
      && aggregate.bestTimeToTypeMs > 0
      ? aggregate.currentTimeToTypeMs / aggregate.bestTimeToTypeMs
      : null;
    return {
      fromToken,
      toToken,
      timingSamples: aggregate?.timingSamples ?? 0,
      timingRatio,
      boost: clamp(
        1 + (timingRatio === null
          ? 0
          : Math.max(0, timingRatio - 1) * input.policy.transitionBoostScale),
        1,
        input.policy.maximumTransitionBoost,
      ),
    };
  });
}

function learnerTransitionTrace(
  entries: readonly CatalogEntry[],
  input: FrequencyFirstScoringInput,
): readonly TransitionBoostTrace[] {
  return input.legacyTransitions === null ? [] : transitionTrace(entries, input);
}

function scoreEntry(
  entry: CatalogEntry,
  input: FrequencyFirstScoringInput,
): EntrySelectionScore {
  const frequencyBase = catalogEntryFrequencyWeight(entry);
  const expectedTrace = expectedTokenTrace([entry], input);
  const transitions = learnerTransitionTrace([entry], input);
  const expectedTokenBoost = Math.max(1, ...expectedTrace.map((item) => item.boost));
  const transitionBoost = Math.max(1, ...transitions.map((item) => item.boost));
  const combinedLearnerBoost = Math.min(
    input.policy.maximumCombinedLearnerBoost,
    expectedTokenBoost * transitionBoost,
  );
  const recentEntryFactor = input.history.recentEntryIds.includes(entry.id)
    ? input.policy.recentEntryPenalty
    : 1;
  return {
    entryId: entry.id,
    frequencyBase,
    expectedTokenBoost,
    transitionBoost,
    combinedLearnerBoost,
    recentEntryFactor,
    totalWeight: frequencyBase * combinedLearnerBoost * recentEntryFactor,
    expectedTokenTrace: expectedTrace,
    transitionTrace: transitions,
  };
}

function scoreTemplate(
  template: GrammarTemplate,
  input: FrequencyFirstScoringInput,
): TemplateSelectionScore {
  const recentTemplateFactor = input.history.recentTemplateIds.includes(template.id)
    ? input.policy.recentTemplatePenalty
    : 1;
  return {
    templateId: template.id,
    recentTemplateFactor,
    totalWeight: recentTemplateFactor,
  };
}

function scoreCandidate(
  candidate: GrammarUtteranceCandidate,
  input: FrequencyFirstScoringInput,
): UtteranceCandidateScore {
  const frequencyBase = geometricMean(
    candidate.entries.map((entry) => catalogEntryFrequencyWeight(entry)),
  );
  const expectedTrace = expectedTokenTrace(candidate.entries, input);
  const transitions = learnerTransitionTrace(candidate.entries, input);
  const expectedTokenBoost = Math.max(1, ...expectedTrace.map((item) => item.boost));
  const transitionBoost = Math.max(1, ...transitions.map((item) => item.boost));
  const combinedLearnerBoost = Math.min(
    input.policy.maximumCombinedLearnerBoost,
    expectedTokenBoost * transitionBoost,
  );
  const recentEntrySet = new Set(input.history.recentEntryIds);
  const recentEntryCount = candidate.entries.reduce(
    (count, entry) => count + (recentEntrySet.has(entry.id) ? 1 : 0),
    0,
  );
  const recentEntryFactor = Math.pow(input.policy.recentEntryPenalty, recentEntryCount);
  const recentUtteranceFactor = input.history.recentUtteranceIds.includes(candidate.id)
    ? input.policy.recentUtterancePenalty
    : 1;
  const recentTemplateFactor = candidate.templateId !== null
    && input.history.recentTemplateIds.includes(candidate.templateId)
    ? input.policy.recentTemplatePenalty
    : 1;
  return {
    utteranceId: candidate.id,
    templateId: candidate.templateId,
    entryIds: candidate.entries.map((entry) => entry.id),
    frequencyBase,
    expectedTokenBoost,
    transitionBoost,
    combinedLearnerBoost,
    recentEntryFactor,
    recentUtteranceFactor,
    recentTemplateFactor,
    totalWeight: frequencyBase
      * combinedLearnerBoost
      * recentEntryFactor
      * recentUtteranceFactor
      * recentTemplateFactor,
    expectedTokenTrace: expectedTrace,
    transitionTrace: transitions,
  };
}

function formalSyntaxExecutionBounds(maximumClauseNesting: number): DerivationBounds {
  return {
    maximumPhraseDepth: 3,
    maximumClauseNesting,
    maximumClausesPerSentence: 2,
    maximumCoordinationItems: 2,
    maximumConsecutiveModifiers: 2,
    maximumComplementsPerPredicate: 1,
    maximumLexicalEntriesPerUtterance: 6,
  };
}

function derivedConstructionClauseNesting(
  input: FrequencyFirstScoringInput,
): number {
  const composition = input.formalSyntaxComposition;
  const target = composition?.structuralTarget;
  if (target === undefined) return 1;
  if (composition?.samplingMode !== "raw") {
    throw new Error("formalSyntaxComposition structuralTarget requires raw samplingMode");
  }
  const rules = composition.rules ?? FORMAL_SYNTAX_RULES;
  for (
    let maximumClauseNesting = 1;
    maximumClauseNesting <= DEFAULT_DERIVATION_BOUNDS.maximumClauseNesting;
    maximumClauseNesting += 1
  ) {
    const count = countStructuralDerivationShapes({
      rootCategory: "Sentence",
      rules,
      bounds: formalSyntaxExecutionBounds(maximumClauseNesting),
      ...(target.rootProductionRuleId === undefined
        ? {}
        : { rootProductionRuleId: target.rootProductionRuleId }),
      ...(target.nestedProductionTargets === undefined
        ? {}
        : { nestedProductionTargets: target.nestedProductionTargets }),
    });
    if (count !== "0") return maximumClauseNesting;
  }
  throw new RangeError("formalSyntaxComposition structuralTarget exceeds selector clause ceiling");
}

function composerCompositionOverride(
  input: FrequencyFirstScoringInput,
): Pick<FormalSyntaxUtteranceInput, "rules" | "samplingMode" | "structuralTarget"> {
  const composition = input.formalSyntaxComposition;
  if (composition === undefined) return {};
  return {
    ...(composition.rules === undefined ? {} : { rules: composition.rules }),
    ...(composition.samplingMode === undefined ? {} : { samplingMode: composition.samplingMode }),
    ...(composition.structuralTarget === undefined
      ? {}
      : { structuralTarget: composition.structuralTarget }),
  };
}

function enrichSlotSelections(
  traces: readonly GrammarSlotSelectionTrace[],
  entriesById: ReadonlyMap<string, CatalogEntry>,
  input: FrequencyFirstScoringInput,
): readonly SlotSelectionScore[] {
  return traces.map((trace) => ({
    slotKey: trace.slotKey,
    role: trace.role,
    selectedEntryId: trace.selectedEntryId,
    candidates: trace.candidates.map((candidate) => {
      const entry = entriesById.get(candidate.entryId);
      if (entry === undefined) throw new Error(`slot candidate disappeared: ${candidate.entryId}`);
      const score = scoreEntry(entry, input);
      if (score.totalWeight !== candidate.weight) {
        throw new Error(`slot candidate weight drift: ${candidate.entryId}`);
      }
      return score;
    }),
  }));
}

function generateOnce(
  eligibleEntries: readonly CatalogEntry[],
  input: FrequencyFirstScoringInput,
  maximumClauseNesting: number,
): SlotWeightedGrammarGeneration {
  const entryScores = new Map<string, EntrySelectionScore>();
  const entryWeight = (entry: CatalogEntry): number => {
    const existing = entryScores.get(entry.id);
    if (existing !== undefined) return existing.totalWeight;
    const score = scoreEntry(entry, input);
    entryScores.set(entry.id, score);
    return score.totalWeight;
  };
  if (input.profiles !== undefined) {
    const composition = composeFormalSyntaxUtterances({
      eligibleEntries,
      profiles: input.profiles,
      random: input.random,
      entryWeightsById: Object.fromEntries(
        eligibleEntries.map((entry) => [entry.id, entryWeight(entry)]),
      ),
      minimumLexicalEntries: 2,
      maximumCandidates: 1,
      maximumAttempts: 64,
      ...composerCompositionOverride(input),
      bounds: formalSyntaxExecutionBounds(maximumClauseNesting),
    });
    return {
      candidate: composition.candidates[0] ?? null,
      templateCandidates: [],
      slotSelections: [],
      slotAttempts: 0,
      fallbackReasons: composition.fallbackReasons,
    };
  }
  if (input.formalSyntaxComposition !== undefined) {
    throw new Error("formalSyntaxComposition requires formal syntax profiles");
  }
  const templateScores = new Map<string, TemplateSelectionScore>();
  return generateSlotWeightedGrammar({
    entries: eligibleEntries,
    annotations: input.annotations,
    ...(input.templates === undefined ? {} : { templates: input.templates }),
    random: input.random,
    entryWeight,
    templateWeight: (template) => {
      const existing = templateScores.get(template.id);
      if (existing !== undefined) return existing.totalWeight;
      const score = scoreTemplate(template, input);
      templateScores.set(template.id, score);
      return score.totalWeight;
    },
  });
}

export function validateFrequencyFirstUtterancePolicy(
  policy: FrequencyFirstUtterancePolicy,
): void {
  if (policy.version.length === 0) throw new Error("utterance policy version must not be empty");
  const positiveIntegers = [
    policy.minimumBindingAttempts,
    policy.minimumBindingTimingSamples,
    policy.minimumTransitionTimingSamples,
    policy.recentUtteranceLimit,
    policy.recentTemplateLimit,
  ];
  if (positiveIntegers.some((value) => !Number.isInteger(value) || value <= 0)) {
    throw new RangeError("utterance policy counts must be positive integers");
  }
  for (const factor of [
    policy.recentEntryPenalty,
    policy.recentUtterancePenalty,
    policy.recentTemplatePenalty,
  ]) {
    if (!Number.isFinite(factor) || factor <= 0 || factor > 1) {
      throw new RangeError("recent penalties must be in (0, 1]");
    }
  }
  for (const boost of [
    policy.maximumExpectedTokenBoost,
    policy.maximumTransitionBoost,
    policy.maximumCombinedLearnerBoost,
  ]) {
    if (!Number.isFinite(boost) || boost < 1) {
      throw new RangeError("maximum boosts must be finite and at least 1");
    }
  }
}

export function createFrequencyFirstSelectionState(
  policy: FrequencyFirstUtterancePolicy,
): FrequencyFirstSelectionState {
  validateFrequencyFirstUtterancePolicy(policy);
  return {
    policyVersion: policy.version,
    recentUtteranceIds: [],
    recentTemplateIds: [],
  };
}

function selectFrequencyFirstUtteranceFromEvidence(
  input: FrequencyFirstScoringInput,
): FrequencyFirstUtteranceSelection {
  validateFrequencyFirstUtterancePolicy(input.policy);
  const eligibleEntries = input.entries;
  const entriesById = new Map(eligibleEntries.map((entry) => [entry.id, entry]));
  const maximumClauseNesting = input.profiles === undefined
    ? 1
    : derivedConstructionClauseNesting(input);
  let generation: SlotWeightedGrammarGeneration | null = null;
  let score: UtteranceCandidateScore | null = null;
  let generationAttempts = 0;

  while (generationAttempts < MAXIMUM_RECENT_UTTERANCE_ATTEMPTS) {
    generationAttempts += 1;
    generation = generateOnce(eligibleEntries, input, maximumClauseNesting);
    if (generation.candidate === null) {
      throw new Error(`no grammar-valid utterance candidate: ${generation.fallbackReasons.join(",")}`);
    }
    score = scoreCandidate(generation.candidate, input);
    if (score.recentUtteranceFactor === 1
      || generationAttempts >= MAXIMUM_RECENT_UTTERANCE_ATTEMPTS
      || input.random.next() < score.recentUtteranceFactor) {
      break;
    }
  }

  if (generation?.candidate === null || generation === null || score === null) {
    throw new Error("slot-weighted utterance generation did not produce a candidate");
  }
  return {
    policyVersion: input.policy.version,
    utterance: generation.candidate,
    score,
    templateCandidates: generation.templateCandidates.map((candidate) => {
      const template: GrammarTemplate = {
        id: candidate.templateId,
        slots: [],
        punctuation: null,
      };
      const templateScore = scoreTemplate(template, input);
      if (templateScore.totalWeight !== candidate.weight) {
        throw new Error(`template candidate weight drift: ${candidate.templateId}`);
      }
      return templateScore;
    }),
    slotSelections: enrichSlotSelections(generation.slotSelections, entriesById, input),
    generationAttempts,
    grammarFallbackReasons: generation.fallbackReasons,
  };
}

/** Legacy/research selector retaining canonical transition semantics. */
export function selectFrequencyFirstUtterance(
  input: FrequencyFirstUtteranceInput,
): FrequencyFirstUtteranceSelection {
  const { measurement, learnerEvidenceMode, ...selectionInput } = input;
  return selectFrequencyFirstUtteranceFromEvidence({
    ...selectionInput,
    bindingsByToken: scopedBindingEvidence(
      Object.values(measurement.bindings),
      input.mode,
      input.layoutId,
    ),
    legacyTransitions: learnerEvidenceMode === "binding-only"
      ? null
      : measurement.transitions,
  });
}

/**
 * Production selector. It accepts only binding evidence, so Measurement V2 motor
 * transitions cannot be reinterpreted as canonical curriculum transitions by
 * accident. Legacy/research transition scoring remains isolated above.
 */
export function selectFormalSyntaxUtterance(
  input: FormalSyntaxUtteranceSelectionInput,
): FrequencyFirstUtteranceSelection {
  const { bindingEvidence, ...selectionInput } = input;
  return selectFrequencyFirstUtteranceFromEvidence({
    ...selectionInput,
    annotations: {},
    bindingsByToken: scopedBindingEvidence(bindingEvidence, input.mode, input.layoutId),
    legacyTransitions: null,
  });
}

function appendRecent(
  values: readonly string[],
  value: string | null,
  limit: number,
): readonly string[] {
  if (value === null) return values.slice(-limit);
  return [...values.filter((item) => item !== value), value].slice(-limit);
}

export function updateFrequencyFirstSelectionState(
  state: FrequencyFirstSelectionState,
  selection: FrequencyFirstUtteranceSelection,
  policy: FrequencyFirstUtterancePolicy,
): FrequencyFirstSelectionState {
  if (state.policyVersion !== policy.version || selection.policyVersion !== policy.version) {
    throw new Error("utterance policy version mismatch");
  }
  return {
    policyVersion: policy.version,
    recentUtteranceIds: appendRecent(
      state.recentUtteranceIds,
      selection.utterance.id,
      policy.recentUtteranceLimit,
    ),
    recentTemplateIds: appendRecent(
      state.recentTemplateIds,
      selection.utterance.templateId,
      policy.recentTemplateLimit,
    ),
  };
}
