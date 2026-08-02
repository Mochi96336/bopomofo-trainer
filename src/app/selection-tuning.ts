import { COMMONNESS_TIERS, type CommonnessTier } from "../commonness/tiers.js";
import {
  FREQUENCY_FIRST_UTTERANCE_POLICY,
  type FrequencyFirstUtterancePolicy,
} from "../curriculum/frequency-first-utterance.js";
import type { StorageLike } from "./local-progress.js";

export const LOCAL_SELECTION_TUNING_KEY = "bopomofo-trainer.selection-tuning.v1";

export interface SelectionTuning {
  readonly errorInfluence: number;
  readonly timingInfluence: number;
  /**
   * Commonness levels the learner wants practised, which is a wish rather than
   * a state: levels not yet unlocked stay listed here and start being drawn on
   * the round they open. What is actually practised is this narrowed to the
   * unlocked levels by `effectiveCommonnessTiers`.
   */
  readonly rarityTiers: readonly CommonnessTier[];
}

export const DEFAULT_SELECTION_TUNING: SelectionTuning = {
  errorInfluence: 1,
  timingInfluence: 1,
  rarityTiers: COMMONNESS_TIERS,
};

function validInfluence(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 3;
}

function parseRarityTiers(value: unknown): readonly CommonnessTier[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const tiers = COMMONNESS_TIERS.filter((tier) => value.includes(tier));
  if (tiers.length !== new Set(value).size || tiers.length !== value.length) return null;
  return tiers;
}

export function parseSelectionTuning(source: string): SelectionTuning | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(source) as unknown;
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
  const candidate = parsed as Record<string, unknown>;
  const rarityTiers = parseRarityTiers(candidate.rarityTiers);
  if (!validInfluence(candidate.errorInfluence)
    || !validInfluence(candidate.timingInfluence)
    || rarityTiers === null) return null;
  return {
    errorInfluence: candidate.errorInfluence,
    timingInfluence: candidate.timingInfluence,
    rarityTiers,
  };
}

export function loadSelectionTuning(storage: StorageLike): SelectionTuning {
  const source = storage.getItem(LOCAL_SELECTION_TUNING_KEY);
  const tuning = source === null
    ? DEFAULT_SELECTION_TUNING
    : parseSelectionTuning(source) ?? DEFAULT_SELECTION_TUNING;
  return tuning;
}

export function saveSelectionTuning(storage: StorageLike, tuning: SelectionTuning): void {
  storage.setItem(LOCAL_SELECTION_TUNING_KEY, JSON.stringify(tuning));
}

export function policyForSelectionTuning(
  tuning: SelectionTuning,
): FrequencyFirstUtterancePolicy {
  if (!validInfluence(tuning.errorInfluence)
    || !validInfluence(tuning.timingInfluence)) {
    throw new RangeError("selection tuning influences must be between 0 and 3");
  }
  return {
    ...FREQUENCY_FIRST_UTTERANCE_POLICY,
    errorBoostScale:
      FREQUENCY_FIRST_UTTERANCE_POLICY.errorBoostScale * tuning.errorInfluence,
    timingBoostScale:
      FREQUENCY_FIRST_UTTERANCE_POLICY.timingBoostScale * tuning.timingInfluence,
    transitionBoostScale:
      FREQUENCY_FIRST_UTTERANCE_POLICY.transitionBoostScale * tuning.timingInfluence,
  };
}
