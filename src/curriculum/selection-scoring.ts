import type { CatalogEntry, PracticeMode, TokenId } from "../core/model.js";
import type { GrammarUtteranceCandidate } from "../grammar/types.js";
import { catalogEntryFrequencyWeight } from "../commonness/catalog-projection.js";
import { quantile } from "../measurement-v2/selection-evidence.js";
import { clauseConstructionClassification, sentenceConstructionClassification } from "./formal-syntax-taxonomy.js";
import type { LearnerBindingEvidence } from "./types.js";
import type { FrequencyFirstUtterancePolicy } from "./selection-policy.js";

export interface UtteranceSelectionHistory {
  readonly recentWrittenForms?: readonly string[];
  readonly recentConstructionIds?: readonly string[];
  readonly recentEntryIds: readonly string[];
  readonly recentUtteranceIds: readonly string[];
  readonly recentTemplateIds?: readonly string[];
}

export interface ExpectedTokenBoostTrace {
  readonly tokenId: TokenId;
  readonly attempts: number;
  readonly errors: number;
  readonly timingSamples: number;
  readonly errorRate: number | null;
  readonly timingRatio: number | null;
  readonly coverageContribution: number;
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

/** Local lexical weights and the actual whole-candidate acceptance rule.
 * No aggregate frequency score is presented as a sentence probability.
 */
export interface HierarchicalUtteranceScore {
  readonly entryIds: readonly string[];
  readonly entries: readonly EntrySelectionScore[];
  readonly constructionId: string | null;
  readonly rootFamilyId: string | null;
  readonly syllables: number;
  readonly keystrokes: number;
  readonly recentUtteranceFactor: number;
  readonly recentConstructionFactor: number;
  readonly burdenFactor: number;
  readonly acceptanceProbability: number;
}

/** Immutable entry projections reusable while the catalog entry array stays unchanged. */
export interface PreparedFrequencyFirstEntries {
  readonly entries: readonly CatalogEntry[];
  readonly entriesById: ReadonlyMap<string, CatalogEntry>;
  readonly tokenIdsByEntryId: ReadonlyMap<string, readonly TokenId[]>;
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

export type FrequencyFirstScoringInput = Omit<
  FrequencyFirstScoringEvidenceInput,
  "bindingEvidence"
> & {
  readonly bindingsByToken: Readonly<Record<string, LearnerBindingEvidence>>;
  readonly useRecentEvidence?: boolean;
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

export function scopedBindingEvidence(
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
      coverageContribution: input.useRecentEvidence ? input.policy.coverageBoostScale : 0,
      boost: input.useRecentEvidence ? Math.min(input.policy.maximumExpectedTokenBoost, 1 + input.policy.coverageBoostScale) : 1,
    };
  } else {
    const recent = aggregate.selectionEvidence ?? (input.useRecentEvidence ? { correctness: [], timingMs: [] } : undefined);
    const correctness = recent?.correctness;
    const errorRate = correctness === undefined
      ? aggregate.attempts >= input.policy.minimumBindingAttempts ? aggregate.errors / aggregate.attempts : null
      : correctness.length >= input.policy.minimumBindingAttempts
        ? correctness.filter(correct => !correct).length / correctness.length : null;
    const samples = recent?.timingMs;
    const baseline = samples !== undefined && samples.length >= input.policy.minimumBindingTimingSamples
      ? quantile(samples, 0.25) : null;
    const timingRatio = samples === undefined
      ? aggregate.timingSamples >= input.policy.minimumBindingTimingSamples
        && aggregate.currentTimeToTypeMs !== null && aggregate.bestTimeToTypeMs !== null
        && aggregate.bestTimeToTypeMs > 0
          ? aggregate.currentTimeToTypeMs / aggregate.bestTimeToTypeMs : null
      : baseline !== null && baseline > 0 ? quantile(samples.slice(-8), 0.5) / baseline : null;
    const errorContribution = errorRate === null ? 0 : errorRate * input.policy.errorBoostScale;
    const timingContribution = timingRatio === null
      ? 0
      : Math.max(0, timingRatio - 1) * input.policy.timingBoostScale;
    const coverageContribution = input.useRecentEvidence ? input.policy.coverageBoostScale * Math.max(0, 1 - aggregate.attempts / input.policy.coverageTargetAttempts) : 0;
    trace = {
      tokenId,
      coverageContribution,
      attempts: aggregate.attempts,
      errors: aggregate.errors,
      timingSamples: aggregate.timingSamples,
      errorRate,
      timingRatio,
      boost: clamp(
        1 + errorContribution + timingContribution + coverageContribution,
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

function entryRecencyFactor(entry: CatalogEntry, input: FrequencyFirstScoringInput): number {
  const texts = input.history.recentWrittenForms;
  if (texts === undefined) return input.history.recentEntryIds.includes(entry.id) ? input.policy.recentEntryPenalty : 1;
  const index = texts.lastIndexOf(entry.prompt.text);
  if (index < 0) return 1;
  const age = texts.length - 1 - index;
  return 1 - (1 - input.policy.recentEntryPenalty) * Math.max(0, 1 - age / input.policy.recentEntryLimit);
}

export function scoreEntry(
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
  const recentEntryFactor = entryRecencyFactor(entry, input);
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
    && (input.history.recentTemplateIds?.includes(candidate.templateId) ?? false)
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

function rootFamilyIdentity(candidate: GrammarUtteranceCandidate): string | null {
  const root = candidate.syntaxRootRuleId;
  return root === undefined ? candidate.templateId
    : sentenceConstructionClassification(root)?.family ?? root;
}

export function constructionIdentity(candidate: GrammarUtteranceCandidate): string | null {
  const root = rootFamilyIdentity(candidate);
  const clauses = (candidate.syntaxProductionRuleIds ?? []).flatMap(rule => {
    const classification = clauseConstructionClassification(rule);
    return classification === null ? [] : [classification.family];
  });
  // Canonical families avoid turning an executable rule split into new variety.
  return root === null || clauses.length === 0 ? root : `${root}|${clauses.join(">")}`;
}

export function surfaceIdentity(candidate: GrammarUtteranceCandidate): string {
  // Ignore reading/profile/derivation identity: the learner sees written text.
  return `surface:${JSON.stringify(candidate.entries.map(entry => entry.prompt.text))}`;
}

export function scoreHierarchicalCandidate(
  candidate: GrammarUtteranceCandidate,
  input: FrequencyFirstScoringInput,
): HierarchicalUtteranceScore {
  const constructionId = constructionIdentity(candidate);
  const recentUtteranceFactor = input.history.recentUtteranceIds.includes(surfaceIdentity(candidate))
    ? input.policy.recentUtterancePenalty : 1;
  const constructions = input.history.recentConstructionIds ?? [];
  const lastIndex = constructionId === null ? -1 : constructions.lastIndexOf(constructionId);
  // Strongest for the most recent family; decay smoothly to neutral.
  const age = constructions.length - 1 - lastIndex;
  const recentConstructionFactor = lastIndex < 0 ? 1
    : 1 - (1 - input.policy.recentConstructionPenalty) * (1 - age / input.policy.recentConstructionLimit);
  const syllables = candidate.entries.reduce((sum, entry) => sum + entry.syllables.length, 0);
  const keystrokes = candidate.entries.reduce((sum, entry) => sum + entry.syllables.reduce((n, syllable) => n + syllable.tokens.length, 0), 0);
  const burdenFactor = Math.min(1, input.policy.preferredSyllables / syllables, input.policy.preferredKeystrokes / keystrokes);
  return {
    entryIds: candidate.entries.map(entry => entry.id),
    entries: candidate.entries.map(entry => scoreEntry(entry, input)),
    constructionId, rootFamilyId: rootFamilyIdentity(candidate), syllables, keystrokes,
    recentUtteranceFactor, recentConstructionFactor, burdenFactor,
    acceptanceProbability: recentUtteranceFactor * recentConstructionFactor * burdenFactor,
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
