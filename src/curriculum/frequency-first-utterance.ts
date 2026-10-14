import type {
  CatalogEntry,
  PracticeMode,
  RandomSource,
  TokenId,
} from "../core/model.js";
import { catalogEntryFrequencyWeight } from "../commonness/catalog-projection.js";
import type {
  GrammarCompositionResult,
  GrammarUtteranceCandidate,
} from "../grammar/types.js";
import { countStructuralDerivationShapes } from "../syntax/count.js";
import { DEFAULT_DERIVATION_BOUNDS } from "../syntax/features.js";
import { FORMAL_SYNTAX_RULES } from "../syntax/grammar.js";
import {
  prepareStructuralSamplingContext,
  type PreparedStructuralSamplingContext,
} from "../syntax/sample.js";
import type { DerivationBounds, ProductionRule, RuntimeSyntaxProfile } from "../syntax/types.js";
import {
  composeFormalSyntaxUtterances,
  prepareFormalSyntaxLexicon,
  type FormalSyntaxUtteranceInput,
  type PreparedFormalSyntaxLexicon,
} from "./formal-syntax-utterance.js";
import type { LearnerBindingEvidence } from "./types.js";

const MAXIMUM_RECENT_UTTERANCE_ATTEMPTS = 4;

export interface FrequencyFirstUtterancePolicy {
  readonly version: string;
  readonly minimumBindingAttempts: number;
  readonly minimumBindingTimingSamples: number;
  readonly maximumExpectedTokenBoost: number;
  readonly maximumCombinedLearnerBoost: number;
  readonly errorBoostScale: number;
  readonly timingBoostScale: number;
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
  maximumExpectedTokenBoost: 1.45,
  maximumCombinedLearnerBoost: 1.5,
  errorBoostScale: 1.5,
  timingBoostScale: 0.35,
  recentEntryPenalty: 0.72,
  recentUtterancePenalty: 0.3,
  recentTemplatePenalty: 0.78,
  recentUtteranceLimit: 8,
  recentTemplateLimit: 6,
};

export interface FrequencyFirstSelectionState {
  readonly policyVersion: string;
  readonly recentEntryIds: readonly string[];
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

export interface EntrySelectionScore {
  readonly entryId: string;
  readonly frequencyBase: number;
  readonly expectedTokenBoost: number;
  readonly combinedLearnerBoost: number;
  readonly recentEntryFactor: number;
  readonly totalWeight: number;
  readonly expectedTokenTrace: readonly ExpectedTokenBoostTrace[];
}

export interface UtteranceCandidateScore {
  readonly utteranceId: string;
  readonly templateId: string | null;
  readonly entryIds: readonly string[];
  readonly frequencyBase: number;
  readonly expectedTokenBoost: number;
  readonly combinedLearnerBoost: number;
  readonly recentEntryFactor: number;
  readonly recentUtteranceFactor: number;
  readonly recentTemplateFactor: number;
  readonly totalWeight: number;
  readonly expectedTokenTrace: readonly ExpectedTokenBoostTrace[];
}

export interface FrequencyFirstUtteranceSelection {
  readonly policyVersion: string;
  readonly utterance: GrammarUtteranceCandidate;
  readonly score: UtteranceCandidateScore;
  readonly generationAttempts: number;
  readonly grammarFallbackReasons: readonly string[];
}

export type FormalSyntaxCompositionOverride = Pick<
  FormalSyntaxUtteranceInput,
  "rules" | "samplingMode" | "structuralTarget"
>;

/** Immutable entry projections reusable while the catalog entry array stays unchanged. */
export interface PreparedFrequencyFirstEntries {
  readonly entries: readonly CatalogEntry[];
  readonly entriesById: ReadonlyMap<string, CatalogEntry>;
  readonly tokenIdsByEntryId: ReadonlyMap<string, readonly TokenId[]>;
}

export interface PreparedFormalSyntaxExecution {
  readonly maximumClauseNesting: number;
  readonly bounds: DerivationBounds;
  readonly structuralSamplingContext: PreparedStructuralSamplingContext;
}

export interface FrequencyFirstScoringEvidenceInput {
  readonly entries: readonly CatalogEntry[];
  /** Binding evidence may come from current Measurement V2 or an isolated legacy adapter. */
  readonly bindingEvidence: readonly LearnerBindingEvidence[];
  readonly mode: PracticeMode;
  readonly layoutId: string;
  readonly history: UtteranceSelectionHistory;
  readonly policy: FrequencyFirstUtterancePolicy;
  /**
   * Generic compatibility extension used only by explicit archived adapters.
   * Current browser production leaves this absent.
   */
  readonly additionalLearnerBoost?: (entries: readonly CatalogEntry[]) => number;
  readonly preparedFrequencyFirstEntries?: PreparedFrequencyFirstEntries;
}

export interface FormalSyntaxUtteranceSelectionInput
  extends FrequencyFirstScoringEvidenceInput {
  readonly random: RandomSource;
  readonly profiles: readonly RuntimeSyntaxProfile[];
  readonly formalSyntaxComposition?: FormalSyntaxCompositionOverride;
  readonly preparedFormalSyntaxLexicon?: PreparedFormalSyntaxLexicon;
  readonly preparedFormalSyntaxExecution?: PreparedFormalSyntaxExecution;
}

type FrequencyFirstScoringInput = Omit<
  FrequencyFirstScoringEvidenceInput,
  "bindingEvidence"
> & {
  readonly bindingsByToken: Readonly<Record<string, LearnerBindingEvidence>>;
};

type FormalSyntaxScoringInput = FrequencyFirstScoringInput & Omit<
  FormalSyntaxUtteranceSelectionInput,
  keyof FrequencyFirstScoringEvidenceInput
>;

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

export function prepareFrequencyFirstEntries(
  entries: readonly CatalogEntry[],
): PreparedFrequencyFirstEntries {
  return {
    entries,
    entriesById: new Map(entries.map((entry) => [entry.id, entry])),
    tokenIdsByEntryId: new Map(entries.map((entry) => [entry.id, uniqueTokens([entry])])),
  };
}

function scoringTokens(
  entries: readonly CatalogEntry[],
  input: FrequencyFirstScoringInput,
): readonly TokenId[] {
  const prepared = input.preparedFrequencyFirstEntries;
  if (prepared === undefined) return uniqueTokens(entries);
  if (entries.length === 1) {
    const tokens = prepared.tokenIdsByEntryId.get(entries[0]!.id);
    if (tokens === undefined) throw new Error(`prepared frequency-first entry disappeared: ${entries[0]!.id}`);
    return tokens;
  }
  const tokens = new Set<TokenId>();
  for (const entry of entries) {
    const entryTokens = prepared.tokenIdsByEntryId.get(entry.id);
    if (entryTokens === undefined) throw new Error(`prepared frequency-first entry disappeared: ${entry.id}`);
    for (const token of entryTokens) tokens.add(token);
  }
  return [...tokens].sort(compareText);
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

const expectedTokenTraceCache = new WeakMap<
  FrequencyFirstScoringInput,
  Map<TokenId, ExpectedTokenBoostTrace>
>();

function expectedTokenTraceForToken(
  tokenId: TokenId,
  input: FrequencyFirstScoringInput,
): ExpectedTokenBoostTrace {
  let byToken = expectedTokenTraceCache.get(input);
  if (byToken === undefined) {
    byToken = new Map<TokenId, ExpectedTokenBoostTrace>();
    expectedTokenTraceCache.set(input, byToken);
  }
  const cached = byToken.get(tokenId);
  if (cached !== undefined) return cached;

  const aggregate = input.bindingsByToken[tokenId];
  let trace: ExpectedTokenBoostTrace;
  if (aggregate === undefined) {
    trace = {
      tokenId,
      attempts: 0,
      errors: 0,
      timingSamples: 0,
      errorRate: null,
      timingRatio: null,
      boost: 1,
    };
  } else {
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
    trace = {
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
  }
  byToken.set(tokenId, trace);
  return trace;
}

function expectedTokenTrace(
  entries: readonly CatalogEntry[],
  input: FrequencyFirstScoringInput,
): readonly ExpectedTokenBoostTrace[] {
  return scoringTokens(entries, input).map((tokenId) =>
    expectedTokenTraceForToken(tokenId, input)
  );
}

function formalEntryTotalWeight(
  entry: CatalogEntry,
  input: FrequencyFirstScoringInput,
  hasBindingEvidence: boolean,
): number {
  const frequencyBase = catalogEntryFrequencyWeight(entry);
  let expectedTokenBoost = 1;
  if (hasBindingEvidence) {
    for (const tokenId of scoringTokens([entry], input)) {
      expectedTokenBoost = Math.max(
        expectedTokenBoost,
        expectedTokenTraceForToken(tokenId, input).boost,
      );
    }
  }
  const additionalLearnerBoost = input.additionalLearnerBoost?.([entry]) ?? 1;
  const combinedLearnerBoost = Math.min(
    input.policy.maximumCombinedLearnerBoost,
    expectedTokenBoost * additionalLearnerBoost,
  );
  const recentEntryFactor = input.history.recentEntryIds.includes(entry.id)
    ? input.policy.recentEntryPenalty
    : 1;
  return frequencyBase * combinedLearnerBoost * recentEntryFactor;
}

function scoreEntry(
  entry: CatalogEntry,
  input: FrequencyFirstScoringInput,
): EntrySelectionScore {
  const frequencyBase = catalogEntryFrequencyWeight(entry);
  const expectedTrace = expectedTokenTrace([entry], input);
  const expectedTokenBoost = Math.max(1, ...expectedTrace.map((item) => item.boost));
  const additionalLearnerBoost = input.additionalLearnerBoost?.([entry]) ?? 1;
  const combinedLearnerBoost = Math.min(
    input.policy.maximumCombinedLearnerBoost,
    expectedTokenBoost * additionalLearnerBoost,
  );
  const recentEntryFactor = input.history.recentEntryIds.includes(entry.id)
    ? input.policy.recentEntryPenalty
    : 1;
  return {
    entryId: entry.id,
    frequencyBase,
    expectedTokenBoost,
    combinedLearnerBoost,
    recentEntryFactor,
    totalWeight: frequencyBase * combinedLearnerBoost * recentEntryFactor,
    expectedTokenTrace: expectedTrace,
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
  const expectedTokenBoost = Math.max(1, ...expectedTrace.map((item) => item.boost));
  const additionalLearnerBoost = input.additionalLearnerBoost?.(candidate.entries) ?? 1;
  const combinedLearnerBoost = Math.min(
    input.policy.maximumCombinedLearnerBoost,
    expectedTokenBoost * additionalLearnerBoost,
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

export function prepareFormalSyntaxExecution(
  maximumClauseNesting: number,
  rules: readonly ProductionRule[] = FORMAL_SYNTAX_RULES,
): PreparedFormalSyntaxExecution {
  const bounds = formalSyntaxExecutionBounds(maximumClauseNesting);
  return {
    maximumClauseNesting,
    bounds,
    structuralSamplingContext: prepareStructuralSamplingContext(rules, bounds),
  };
}

function derivedConstructionClauseNesting(
  input: FormalSyntaxScoringInput,
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
  input: FormalSyntaxScoringInput,
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

function generateOnce(
  eligibleEntries: readonly CatalogEntry[],
  input: FormalSyntaxScoringInput,
  maximumClauseNesting: number,
  preparedFormalSyntaxLexicon: PreparedFormalSyntaxLexicon | null,
  preparedFormalSyntaxExecution: PreparedFormalSyntaxExecution | null,
): GrammarCompositionResult {
  // Without scoped binding evidence every expected-token boost is exactly 1.
  // Avoid rescanning each candidate entry's token list in that common fresh-user path.
  const hasBindingEvidence = Object.keys(input.bindingsByToken).length !== 0;
  const useStaticFormalEntryWeight = input.additionalLearnerBoost === undefined
    && !hasBindingEvidence
    && input.history.recentEntryIds.length === 0;
  const entryWeights = new Map<string, number>();
  const entryWeight = (entry: CatalogEntry): number => {
    const existing = entryWeights.get(entry.id);
    if (existing !== undefined) return existing;
    const weight = input.additionalLearnerBoost === undefined
      ? formalEntryTotalWeight(entry, input, hasBindingEvidence)
      : scoreEntry(entry, input).totalWeight;
    entryWeights.set(entry.id, weight);
    return weight;
  };
  if (preparedFormalSyntaxLexicon === null) {
    throw new Error("formal syntax profiles require prepared lexical context");
  }
  const compositionOverride = composerCompositionOverride(input);
  const executionRules = compositionOverride.rules ?? FORMAL_SYNTAX_RULES;
  if (preparedFormalSyntaxExecution !== null) {
    if (preparedFormalSyntaxExecution.maximumClauseNesting !== maximumClauseNesting) {
      throw new Error("prepared formal syntax execution clause nesting mismatch");
    }
    if (preparedFormalSyntaxExecution.structuralSamplingContext.rules !== executionRules) {
      throw new Error("prepared formal syntax execution rules identity mismatch");
    }
  }
  const executionBounds = preparedFormalSyntaxExecution?.bounds
    ?? formalSyntaxExecutionBounds(maximumClauseNesting);
  return composeFormalSyntaxUtterances({
    eligibleEntries,
    profiles: input.profiles,
    random: input.random,
    ...(useStaticFormalEntryWeight ? {} : { entryWeight }),
    minimumLexicalEntries: 2,
    maximumCandidates: 1,
    maximumAttempts: 64,
    ...compositionOverride,
    bounds: executionBounds,
  }, preparedFormalSyntaxLexicon, preparedFormalSyntaxExecution?.structuralSamplingContext);
}

export function validateFrequencyFirstUtterancePolicy(
  policy: FrequencyFirstUtterancePolicy,
): void {
  if (policy.version.length === 0) throw new Error("utterance policy version must not be empty");
  const positiveIntegers = [
    policy.minimumBindingAttempts,
    policy.minimumBindingTimingSamples,
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
    recentEntryIds: [],
    recentUtteranceIds: [],
    recentTemplateIds: [],
  };
}

function selectFormalSyntaxUtteranceFromScoring(
  input: FormalSyntaxScoringInput,
): FrequencyFirstUtteranceSelection {
  validateFrequencyFirstUtterancePolicy(input.policy);
  const eligibleEntries = input.entries;
  const preparedEntries = input.preparedFrequencyFirstEntries;
  if (preparedEntries !== undefined && preparedEntries.entries !== eligibleEntries) {
    throw new Error("prepared frequency-first entries input identity mismatch");
  }
  const maximumClauseNesting = derivedConstructionClauseNesting(input);
  const preparedFormalSyntaxLexicon = input.preparedFormalSyntaxLexicon
    ?? prepareFormalSyntaxLexicon(eligibleEntries, input.profiles);
  const preparedFormalSyntaxExecution = input.preparedFormalSyntaxExecution ?? null;
  if (preparedFormalSyntaxExecution !== null
    && preparedFormalSyntaxExecution.maximumClauseNesting !== maximumClauseNesting) {
    throw new Error("prepared formal syntax execution clause nesting mismatch");
  }
  let generation: GrammarCompositionResult | null = null;
  let score: UtteranceCandidateScore | null = null;
  let generationAttempts = 0;

  while (generationAttempts < MAXIMUM_RECENT_UTTERANCE_ATTEMPTS) {
    generationAttempts += 1;
    generation = generateOnce(
      eligibleEntries,
      input,
      maximumClauseNesting,
      preparedFormalSyntaxLexicon,
      preparedFormalSyntaxExecution,
    );
    const candidate = generation.candidates[0] ?? null;
    if (candidate === null) {
      throw new Error(`no grammar-valid utterance candidate: ${generation.fallbackReasons.join(",")}`);
    }
    score = scoreCandidate(candidate, input);
    if (score.recentUtteranceFactor === 1
      || generationAttempts >= MAXIMUM_RECENT_UTTERANCE_ATTEMPTS
      || input.random.next() < score.recentUtteranceFactor) {
      break;
    }
  }

  const candidate = generation?.candidates[0] ?? null;
  if (candidate === null || generation === null || score === null) {
    throw new Error("formal syntax generation did not produce a candidate");
  }
  return {
    policyVersion: input.policy.version,
    utterance: candidate,
    score,
    generationAttempts,
    grammarFallbackReasons: generation.fallbackReasons,
  };
}

function scopedScoringInput(
  input: FrequencyFirstScoringEvidenceInput,
): FrequencyFirstScoringInput {
  const { bindingEvidence, ...scoring } = input;
  return {
    ...scoring,
    bindingsByToken: scopedBindingEvidence(bindingEvidence, input.mode, input.layoutId),
  };
}

/** Shared scoring primitive used by the isolated legacy compatibility module. */
export function scoreFrequencyFirstEntry(
  entry: CatalogEntry,
  input: FrequencyFirstScoringEvidenceInput,
): EntrySelectionScore {
  return scoreEntry(entry, scopedScoringInput(input));
}

/** Shared candidate scoring primitive used by the isolated legacy compatibility module. */
export function scoreFrequencyFirstCandidate(
  candidate: GrammarUtteranceCandidate,
  input: FrequencyFirstScoringEvidenceInput,
): UtteranceCandidateScore {
  return scoreCandidate(candidate, scopedScoringInput(input));
}

/**
 * Production selector. It accepts only current binding evidence and formal
 * syntax profiles. Legacy/research evidence adapters live in a separate module.
 */
export function selectFormalSyntaxUtterance(
  input: FormalSyntaxUtteranceSelectionInput,
): FrequencyFirstUtteranceSelection {
  const { bindingEvidence, ...selectionInput } = input;
  return selectFormalSyntaxUtteranceFromScoring({
    ...selectionInput,
    bindingsByToken: scopedBindingEvidence(bindingEvidence, input.mode, input.layoutId),
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
    recentEntryIds: selection.utterance.entries.map((entry) => entry.id),
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
