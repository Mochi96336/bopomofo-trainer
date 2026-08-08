import type { FrequencyFirstUtterancePolicy } from "../curriculum/frequency-first-utterance.js";
import { reinforcementStateLabel } from "./labels.js";
import type { DiagnosticReinforcementState } from "./types.js";

export interface BindingSelectionEvidence {
  readonly attempts: number;
  readonly errors: number;
  readonly timingSamples: number;
  readonly currentTimeToTypeMs: number | null;
  readonly bestTimeToTypeMs: number | null;
}

export interface SelectionInfluence {
  readonly state: DiagnosticReinforcementState;
  readonly label: string;
  readonly reason: string;
  readonly expectedTokenBoost: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

/**
 * Projects the same binding evidence the frequency-first selector consumes into
 * human-readable UI state. This owns no persistence and no selection side
 * effects; callers may pass either the legacy aggregate shape or Measurement V2
 * binding evidence because only their shared semantic fields are inspected.
 */
export function selectionInfluence(
  aggregate: BindingSelectionEvidence | undefined,
  timingAvailable: boolean,
  policy: FrequencyFirstUtterancePolicy,
): SelectionInfluence {
  const attempts = aggregate?.attempts ?? 0;
  const errors = aggregate?.errors ?? 0;
  const timingSamples = aggregate?.timingSamples ?? 0;
  const errorEligible = attempts >= policy.minimumBindingAttempts;
  const timingEligible = timingAvailable
    && timingSamples >= policy.minimumBindingTimingSamples
    && aggregate?.currentTimeToTypeMs !== null
    && aggregate?.currentTimeToTypeMs !== undefined
    && aggregate.bestTimeToTypeMs !== null
    && aggregate.bestTimeToTypeMs > 0;
  const errorRate = errorEligible ? errors / attempts : null;
  const timingRatio = timingEligible
    ? aggregate.currentTimeToTypeMs / aggregate.bestTimeToTypeMs
    : null;
  const errorSignal = errorRate !== null && errorRate > 0;
  const timingSignal = timingRatio !== null && timingRatio > 1;
  const errorContribution = errorRate === null ? 0 : errorRate * policy.errorBoostScale;
  const timingContribution = timingRatio === null
    ? 0
    : Math.max(0, timingRatio - 1) * policy.timingBoostScale;
  const expectedTokenBoost = clamp(
    1 + errorContribution + timingContribution,
    1,
    policy.maximumExpectedTokenBoost,
  );

  let state: DiagnosticReinforcementState;
  let reason: string;
  if (expectedTokenBoost > 1) {
    state = "reinforced";
    reason = errorContribution > 0 && timingContribution > 0
      ? "錯誤觀察與有效鍵間時間"
      : errorContribution > 0
        ? "錯誤觀察較多"
        : "有效鍵間時間較長";
  } else if (!errorEligible && !timingEligible) {
    state = "sampling";
    if (!timingAvailable) {
      reason = "錯誤觀察樣本仍不足";
    } else if (attempts < policy.minimumBindingAttempts
      && timingSamples < policy.minimumBindingTimingSamples) {
      reason = "錯誤與時間樣本仍不足";
    } else if (attempts < policy.minimumBindingAttempts) {
      reason = "錯誤觀察樣本仍不足";
    } else {
      reason = "有效鍵間時間樣本仍不足";
    }
  } else {
    state = "neutral";
    reason = (errorSignal || timingSignal)
      ? "已有弱點觀察，但相關選題權重目前為 0%"
      : "目前觀察未產生額外加權";
  }

  return {
    state,
    label: reinforcementStateLabel(state),
    reason,
    expectedTokenBoost,
  };
}
