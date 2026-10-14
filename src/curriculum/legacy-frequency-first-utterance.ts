import type { CatalogEntry, TokenId } from "../core/model.js";
import { transitionScopeKey } from "../measurement/aggregate.js";
import type { MeasurementSummary } from "../measurement/types.js";
import {
  selectFrequencyFirstUtteranceFromEvidence,
  type EntrySelectionScore,
  type FrequencyFirstSelectionEvidenceInput,
  type FrequencyFirstUtteranceSelection,
  type SlotSelectionScore,
  type UtteranceCandidateScore,
} from "./frequency-first-utterance.js";

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

export interface LegacySlotSelectionScore extends Omit<SlotSelectionScore, "candidates"> {
  readonly candidates: readonly LegacyEntrySelectionScore[];
}

export interface LegacyUtteranceCandidateScore extends UtteranceCandidateScore {
  readonly transitionBoost: number;
  readonly transitionTrace: readonly TransitionBoostTrace[];
}

export interface LegacyFrequencyFirstUtteranceSelection extends Omit<
  FrequencyFirstUtteranceSelection,
  "score" | "slotSelections"
> {
  readonly score: LegacyUtteranceCandidateScore;
  readonly slotSelections: readonly LegacySlotSelectionScore[];
}

export interface FrequencyFirstUtteranceInput extends Omit<
  FrequencyFirstSelectionEvidenceInput,
  "bindingEvidence" | "additionalLearnerBoost"
> {
  readonly measurement: MeasurementSummary;
  /** Binding-only reproduces the former production seam for compatibility tests. */
  readonly learnerEvidenceMode?: LearnerEvidenceMode;
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

/**
 * Archived/research compatibility selector retaining canonical token-pair
 * transition semantics. Current browser production must not import this module.
 */
export function selectFrequencyFirstUtterance(
  input: FrequencyFirstUtteranceInput,
): LegacyFrequencyFirstUtteranceSelection {
  const { measurement, learnerEvidenceMode: _mode, transitionPolicy: _transitionPolicy, ...selectionInput } = input;
  const selected = selectFrequencyFirstUtteranceFromEvidence({
    ...selectionInput,
    bindingEvidence: Object.values(measurement.bindings),
    additionalLearnerBoost: input.learnerEvidenceMode === "binding-only"
      ? undefined
      : (entries) => transitionBoost(entries, input),
  });
  const entriesById = new Map(input.entries.map((entry) => [entry.id, entry]));
  const selectedTrace = transitionTrace(selected.utterance.entries, input);
  return {
    ...selected,
    score: {
      ...selected.score,
      transitionBoost: Math.max(1, ...selectedTrace.map((item) => item.boost)),
      transitionTrace: selectedTrace,
    },
    slotSelections: selected.slotSelections.map((slot) => ({
      ...slot,
      candidates: slot.candidates.map((candidate) => {
        const entry = entriesById.get(candidate.entryId);
        if (entry === undefined) throw new Error(`legacy slot candidate disappeared: ${candidate.entryId}`);
        return enrichEntryScore(candidate, entry, input);
      }),
    })),
  };
}
