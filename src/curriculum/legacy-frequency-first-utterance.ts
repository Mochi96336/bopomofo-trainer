import type {
  CatalogEntry,
  PracticeMode,
  RandomSource,
  TokenId,
} from "../core/model.js";
import type {
  GrammarAnnotation,
  GrammarRole,
  GrammarTemplate,
  GrammarUtteranceCandidate,
} from "../grammar/types.js";
import { transitionScopeKey } from "../measurement/aggregate.js";
import type { MeasurementSummary } from "../measurement/types.js";
import {
  scoreFrequencyFirstCandidate,
  scoreFrequencyFirstEntry,
  type EntrySelectionScore,
  type FrequencyFirstUtterancePolicy,
  type UtteranceCandidateScore,
  type UtteranceSelectionHistory,
} from "./frequency-first-utterance.js";
import {
  generateSlotWeightedGrammar,
  type GrammarSlotSelectionTrace,
} from "./slot-weighted-grammar.js";

const MAXIMUM_RECENT_UTTERANCE_ATTEMPTS = 4;

export type LearnerEvidenceMode = "binding-only" | "legacy-binding-transition";

export interface LegacyTransitionScoringPolicy {
  readonly minimumTimingSamples: number;
  readonly maximumBoost: number;
  readonly boostScale: number;
}

export const LEGACY_TRANSITION_SCORING_POLICY: LegacyTransitionScoringPolicy = {
  minimumTimingSamples: 3,
  maximumBoost: 1.25,
  boostScale: 0.3,
};

export interface TransitionBoostTrace {
  readonly fromToken: TokenId;
  readonly toToken: TokenId;
  readonly timingSamples: number;
  readonly timingRatio: number | null;
  readonly boost: number;
}

export interface LegacyEntrySelectionScore extends EntrySelectionScore {
  readonly transitionBoost: number;
  readonly transitionTrace: readonly TransitionBoostTrace[];
}

export interface LegacyTemplateSelectionScore {
  readonly templateId: string;
  readonly recentTemplateFactor: number;
  readonly totalWeight: number;
}

export interface LegacySlotSelectionScore {
  readonly slotKey: string;
  readonly role: GrammarRole;
  readonly selectedEntryId: string;
  readonly candidates: readonly LegacyEntrySelectionScore[];
}

export interface LegacyUtteranceCandidateScore extends UtteranceCandidateScore {
  readonly transitionBoost: number;
  readonly transitionTrace: readonly TransitionBoostTrace[];
}

export interface LegacyFrequencyFirstUtteranceSelection {
  readonly policyVersion: string;
  readonly utterance: GrammarUtteranceCandidate;
  readonly score: LegacyUtteranceCandidateScore;
  readonly templateCandidates: readonly LegacyTemplateSelectionScore[];
  readonly slotSelections: readonly LegacySlotSelectionScore[];
  readonly generationAttempts: number;
  readonly grammarFallbackReasons: readonly string[];
}

export interface FrequencyFirstUtteranceInput {
  readonly entries: readonly CatalogEntry[];
  readonly annotations: Readonly<Record<string, GrammarAnnotation>>;
  readonly measurement: MeasurementSummary;
  readonly mode: PracticeMode;
  readonly layoutId: string;
  readonly history: UtteranceSelectionHistory;
  readonly policy: FrequencyFirstUtterancePolicy;
  readonly random: RandomSource;
  readonly learnerEvidenceMode?: LearnerEvidenceMode;
  readonly templates?: readonly GrammarTemplate[];
  readonly transitionPolicy?: LegacyTransitionScoringPolicy;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
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

function transitionTrace(
  entries: readonly CatalogEntry[],
  input: FrequencyFirstUtteranceInput,
): readonly TransitionBoostTrace[] {
  if (input.learnerEvidenceMode === "binding-only") return [];
  const policy = input.transitionPolicy ?? LEGACY_TRANSITION_SCORING_POLICY;
  return exactTransitions(entries).map(({ fromToken, toToken }) => {
    const aggregate = input.measurement.transitions[transitionScopeKey({
      mode: input.mode,
      layoutId: input.layoutId,
      fromToken,
      toToken,
    })];
    const timingRatio = aggregate !== undefined
      && aggregate.timingSamples >= policy.minimumTimingSamples
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
          : Math.max(0, timingRatio - 1) * policy.boostScale),
        1,
        policy.maximumBoost,
      ),
    };
  });
}

function transitionBoost(
  entries: readonly CatalogEntry[],
  input: FrequencyFirstUtteranceInput,
): number {
  return Math.max(1, ...transitionTrace(entries, input).map((item) => item.boost));
}

function scoringEvidence(input: FrequencyFirstUtteranceInput) {
  return {
    entries: input.entries,
    bindingEvidence: Object.values(input.measurement.bindings),
    mode: input.mode,
    layoutId: input.layoutId,
    history: input.history,
    policy: input.policy,
    ...(input.learnerEvidenceMode === "binding-only"
      ? {}
      : { additionalLearnerBoost: (entries: readonly CatalogEntry[]) => transitionBoost(entries, input) }),
  };
}

function enrichEntryScore(
  score: EntrySelectionScore,
  entry: CatalogEntry,
  input: FrequencyFirstUtteranceInput,
): LegacyEntrySelectionScore {
  const trace = transitionTrace([entry], input);
  return {
    ...score,
    transitionBoost: Math.max(1, ...trace.map((item) => item.boost)),
    transitionTrace: trace,
  };
}

function enrichCandidateScore(
  score: UtteranceCandidateScore,
  candidate: GrammarUtteranceCandidate,
  input: FrequencyFirstUtteranceInput,
): LegacyUtteranceCandidateScore {
  const trace = transitionTrace(candidate.entries, input);
  return {
    ...score,
    transitionBoost: Math.max(1, ...trace.map((item) => item.boost)),
    transitionTrace: trace,
  };
}

function templateScore(
  templateId: string,
  input: FrequencyFirstUtteranceInput,
): LegacyTemplateSelectionScore {
  const recentTemplateFactor = input.history.recentTemplateIds.includes(templateId)
    ? input.policy.recentTemplatePenalty
    : 1;
  return {
    templateId,
    recentTemplateFactor,
    totalWeight: recentTemplateFactor,
  };
}

function enrichSlotSelections(
  traces: readonly GrammarSlotSelectionTrace[],
  input: FrequencyFirstUtteranceInput,
): readonly LegacySlotSelectionScore[] {
  const entriesById = new Map(input.entries.map((entry) => [entry.id, entry]));
  const evidence = scoringEvidence(input);
  return traces.map((trace) => ({
    slotKey: trace.slotKey,
    role: trace.role,
    selectedEntryId: trace.selectedEntryId,
    candidates: trace.candidates.map((candidate) => {
      const entry = entriesById.get(candidate.entryId);
      if (entry === undefined) throw new Error(`legacy slot candidate disappeared: ${candidate.entryId}`);
      const score = enrichEntryScore(scoreFrequencyFirstEntry(entry, evidence), entry, input);
      if (score.totalWeight !== candidate.weight) {
        throw new Error(`legacy slot candidate weight drift: ${candidate.entryId}`);
      }
      return score;
    }),
  }));
}

/**
 * Archived/research compatibility selector retaining the old annotation/template
 * grammar and canonical token-pair transition semantics.
 */
export function selectFrequencyFirstUtterance(
  input: FrequencyFirstUtteranceInput,
): LegacyFrequencyFirstUtteranceSelection {
  const evidence = scoringEvidence(input);
  let generation: ReturnType<typeof generateSlotWeightedGrammar> | null = null;
  let score: LegacyUtteranceCandidateScore | null = null;
  let generationAttempts = 0;

  while (generationAttempts < MAXIMUM_RECENT_UTTERANCE_ATTEMPTS) {
    generationAttempts += 1;
    generation = generateSlotWeightedGrammar({
      entries: input.entries,
      annotations: input.annotations,
      ...(input.templates === undefined ? {} : { templates: input.templates }),
      random: input.random,
      entryWeight: (entry) => scoreFrequencyFirstEntry(entry, evidence).totalWeight,
      templateWeight: (template) => templateScore(template.id, input).totalWeight,
    });
    if (generation.candidate === null) {
      throw new Error(`no grammar-valid legacy utterance candidate: ${generation.fallbackReasons.join(",")}`);
    }
    score = enrichCandidateScore(
      scoreFrequencyFirstCandidate(generation.candidate, evidence),
      generation.candidate,
      input,
    );
    if (score.recentUtteranceFactor === 1
      || generationAttempts >= MAXIMUM_RECENT_UTTERANCE_ATTEMPTS
      || input.random.next() < score.recentUtteranceFactor) {
      break;
    }
  }

  if (generation?.candidate === null || generation === null || score === null) {
    throw new Error("legacy slot-weighted generation did not produce a candidate");
  }
  return {
    policyVersion: input.policy.version,
    utterance: generation.candidate,
    score,
    templateCandidates: generation.templateCandidates.map((candidate) => {
      const resolved = templateScore(candidate.templateId, input);
      if (resolved.totalWeight !== candidate.weight) {
        throw new Error(`legacy template candidate weight drift: ${candidate.templateId}`);
      }
      return resolved;
    }),
    slotSelections: enrichSlotSelections(generation.slotSelections, input),
    generationAttempts,
    grammarFallbackReasons: generation.fallbackReasons,
  };
}
