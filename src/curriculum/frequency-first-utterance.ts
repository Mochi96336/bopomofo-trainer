import {
  validateFrequencyFirstUtterancePolicy,
  type FrequencyFirstUtterancePolicy,
} from "./selection-policy.js";
import {
  scopedBindingEvidence, scoreEntry,
  scoreHierarchicalCandidate, constructionIdentity, surfaceIdentity,
  type FrequencyFirstScoringEvidenceInput, type FrequencyFirstScoringInput,
  type HierarchicalUtteranceScore,
} from "./selection-scoring.js";
export { FREQUENCY_FIRST_UTTERANCE_POLICY, validateFrequencyFirstUtterancePolicy } from "./selection-policy.js";
export type { FrequencyFirstUtterancePolicy } from "./selection-policy.js";
export { prepareFrequencyFirstEntries, scoreFrequencyFirstEntry, scoreFrequencyFirstCandidate } from "./selection-scoring.js";
export type {
  FrequencyFirstScoringEvidenceInput, PreparedFrequencyFirstEntries,
  HierarchicalUtteranceScore, EntrySelectionScore, UtteranceCandidateScore,
  ExpectedTokenBoostTrace, UtteranceSelectionHistory,
} from "./selection-scoring.js";

import type {
  CatalogEntry,
  RandomSource,
} from "../core/model.js";
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
import {
  PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY,
  type FormalSyntaxSamplingPolicy,
} from "./formal-syntax-sampling-policy.js";



/**
 * Failure-only recovery for a lexically narrowed catalog.
 *
 * Product practice axes are curriculum preferences, not grammar requirements.
 * If the complete bounded product-family pass cannot realize any sentence, keep
 * the same root-family prior/catalog/reading gate but remove all optional
 * practice targets. This is deliberately a second bounded pass instead of
 * increasing the primary 64-attempt budget: successful primary draws never
 * consume recovery draws or pay for another search.
 */
const PRODUCT_AVAILABILITY_RECOVERY_POLICY: FormalSyntaxSamplingPolicy = {
  ...PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY,
  version: `${PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY.version}:availability-recovery-v1`,
  predicateMarkingPracticeWeights: {
    ordinary: 1,
    modal: 0,
    aspect: 0,
    negation: 0,
  },
  argumentRealizationPracticeWeights: {
    ordinary: 1,
    subjectOmission: 0,
    objectOmission: 0,
  },
  comparativePracticeWeights: {
    inactive: 1,
    adjectival: 0,
    verbal: 0,
  },
};

export interface FrequencyFirstSelectionState {
  readonly policyVersion: string;
  readonly recentEntryIds: readonly string[];
  readonly recentUtteranceIds: readonly string[];
  readonly recentWrittenForms: readonly string[];
  readonly recentConstructionIds: readonly string[];
}

export interface FrequencyFirstUtteranceSelection {
  readonly policyVersion: string;
  readonly utterance: GrammarUtteranceCandidate;
  readonly score: HierarchicalUtteranceScore;
  readonly acceptance: "accepted" | "bounded-best-effort";
  readonly generationAttempts: number;
  readonly grammarFallbackReasons: readonly string[];
  readonly rootAvailability?: GrammarCompositionResult["rootAvailability"];
}

export type FormalSyntaxCompositionOverride = Pick<
  FormalSyntaxUtteranceInput,
  "rules" | "samplingMode" | "structuralTarget"
>;

export interface PreparedFormalSyntaxExecution {
  readonly maximumClauseNesting: number;
  readonly bounds: DerivationBounds;
  readonly structuralSamplingContext: PreparedStructuralSamplingContext;
}

export interface FormalSyntaxUtteranceSelectionInput
  extends FrequencyFirstScoringEvidenceInput {
  readonly random: RandomSource;
  readonly profiles: readonly RuntimeSyntaxProfile[];
  /** Optional reading permission policy, independent of research/grammar overrides. */
  readonly readingEligibility?: FormalSyntaxUtteranceInput["readingEligibility"];
  readonly preDrawReadingEligibility?: FormalSyntaxUtteranceInput["preDrawReadingEligibility"];
  readonly finalCandidateReadingEligibility?: FormalSyntaxUtteranceInput["finalCandidateReadingEligibility"];
  readonly subsequentFinalCandidateReadingEligibility?: FormalSyntaxUtteranceInput["subsequentFinalCandidateReadingEligibility"];
  readonly additionalFinalCandidateReadingEligibilities?: FormalSyntaxUtteranceInput["additionalFinalCandidateReadingEligibilities"];
  readonly formalSyntaxComposition?: FormalSyntaxCompositionOverride;
  readonly preparedFormalSyntaxLexicon?: PreparedFormalSyntaxLexicon;
  readonly preparedFormalSyntaxExecution?: PreparedFormalSyntaxExecution;
}

type FormalSyntaxScoringInput = FrequencyFirstScoringInput & Omit<
  FormalSyntaxUtteranceSelectionInput,
  keyof FrequencyFirstScoringEvidenceInput
>;

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
    && input.history.recentEntryIds.length === 0
    && (input.history.recentWrittenForms?.length ?? 0) === 0;
  const entryWeights = new Map<string, number>();
  const entryWeight = (entry: CatalogEntry): number => {
    const existing = entryWeights.get(entry.id);
    if (existing !== undefined) return existing;
    const weight = scoreEntry(entry, input).totalWeight;
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
  const composerInput: FormalSyntaxUtteranceInput = {
    lexicalSampling: "written-form",
    eligibleEntries,
    profiles: input.profiles,
    random: input.random,
    ...(useStaticFormalEntryWeight ? {} : { entryWeight }),
    ...(input.readingEligibility === undefined ? {} : { readingEligibility: input.readingEligibility }),
    ...(input.preDrawReadingEligibility === undefined ? {} : { preDrawReadingEligibility: input.preDrawReadingEligibility }),
    ...(input.finalCandidateReadingEligibility === undefined
      ? {} : { finalCandidateReadingEligibility: input.finalCandidateReadingEligibility }),
    ...(input.subsequentFinalCandidateReadingEligibility === undefined
      ? {} : { subsequentFinalCandidateReadingEligibility: input.subsequentFinalCandidateReadingEligibility }),
    ...(input.additionalFinalCandidateReadingEligibilities === undefined
      ? {} : { additionalFinalCandidateReadingEligibilities: input.additionalFinalCandidateReadingEligibilities }),
    minimumLexicalEntries: 2,
    maximumCandidates: 1,
    maximumAttempts: 64,
    ...compositionOverride,
    bounds: executionBounds,
  };
  const primary = composeFormalSyntaxUtterances(
    composerInput,
    preparedFormalSyntaxLexicon,
    preparedFormalSyntaxExecution?.structuralSamplingContext,
  );
  if (primary.candidates.length > 0 || input.formalSyntaxComposition !== undefined) {
    return primary;
  }

  const recovery = composeFormalSyntaxUtterances({
    ...composerInput,
    samplingMode: "product-family",
    samplingPolicy: PRODUCT_AVAILABILITY_RECOVERY_POLICY,
  }, preparedFormalSyntaxLexicon, preparedFormalSyntaxExecution?.structuralSamplingContext);
  return {
    candidates: recovery.candidates,
    ...(recovery.rootAvailability === undefined ? {} : { rootAvailability: recovery.rootAvailability }),
    fallbackReasons: [...new Set([
      ...primary.fallbackReasons,
      "formal-syntax-practice-availability-recovery",
      ...recovery.fallbackReasons,
    ])].sort(),
  };
}

export function createFrequencyFirstSelectionState(
  policy: FrequencyFirstUtterancePolicy,
): FrequencyFirstSelectionState {
  validateFrequencyFirstUtterancePolicy(policy);
  return {
    policyVersion: policy.version,
    recentEntryIds: [],
    recentUtteranceIds: [],
    recentWrittenForms: [],
    recentConstructionIds: [],
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
  let best: FrequencyFirstUtteranceSelection | null = null;
  const fallbackReasons = new Set<string>();
  for (let attempt = 1; attempt <= input.policy.maximumCandidateDraws; attempt += 1) {
    const generation = generateOnce(
      eligibleEntries, input, maximumClauseNesting,
      preparedFormalSyntaxLexicon, preparedFormalSyntaxExecution,
    );
    for (const reason of generation.fallbackReasons) fallbackReasons.add(reason);
    const candidate = generation.candidates[0];
    if (candidate === undefined) continue;
    const score = scoreHierarchicalCandidate(candidate, input);
    const selected: FrequencyFirstUtteranceSelection = {
      policyVersion: input.policy.version, utterance: candidate, score,
      acceptance: "accepted", generationAttempts: attempt,
      grammarFallbackReasons: [...fallbackReasons].sort(),
      ...(generation.rootAvailability === undefined ? {} : { rootAvailability: generation.rootAvailability }),
    };
    if (score.acceptanceProbability === 1 || input.random.next() < score.acceptanceProbability) {
      return selected;
    }
    if (best === null || score.acceptanceProbability > best.score.acceptanceProbability) best = selected;
  }
  if (best === null) {
    throw new Error(`no grammar-valid utterance candidate: ${[...fallbackReasons].sort().join(",")}`);
  }
  return {
    ...best, acceptance: "bounded-best-effort",
    generationAttempts: input.policy.maximumCandidateDraws,
    grammarFallbackReasons: [...fallbackReasons, "candidate-acceptance-budget-exhausted"].sort(),
  };
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
    useRecentEvidence: true,
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
  selection: Pick<FrequencyFirstUtteranceSelection, "policyVersion" | "utterance">,
  policy: FrequencyFirstUtterancePolicy,
): FrequencyFirstSelectionState {
  if (state.policyVersion !== policy.version || selection.policyVersion !== policy.version) {
    throw new Error("utterance policy version mismatch");
  }
  const constructionId = constructionIdentity(selection.utterance);
  let recentEntryIds = state.recentEntryIds;
  let recentWrittenForms = state.recentWrittenForms;
  for (const entry of selection.utterance.entries) {
    recentEntryIds = appendRecent(recentEntryIds, entry.id, policy.recentEntryLimit);
    recentWrittenForms = appendRecent(recentWrittenForms, entry.prompt.text, policy.recentEntryLimit);
  }
  return {
    policyVersion: policy.version, recentEntryIds,
    recentUtteranceIds: appendRecent(state.recentUtteranceIds, surfaceIdentity(selection.utterance), policy.recentUtteranceLimit),
    recentWrittenForms,
    recentConstructionIds: appendRecent(state.recentConstructionIds, constructionId, policy.recentConstructionLimit),
  };
}
