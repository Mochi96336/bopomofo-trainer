export interface FrequencyFirstUtterancePolicy {
  readonly version: string;
  readonly minimumBindingAttempts: number;
  readonly minimumBindingTimingSamples: number;
  readonly maximumExpectedTokenBoost: number;
  readonly maximumCombinedLearnerBoost: number;
  readonly errorBoostScale: number;
  readonly timingBoostScale: number;
  readonly coverageBoostScale: number;
  readonly coverageTargetAttempts: number;
  readonly recentEntryPenalty: number;
  readonly recentUtterancePenalty: number;
  /** Historical reading-identity adapter only; product uses construction history. */
  readonly recentTemplatePenalty: number;
  readonly recentUtteranceLimit: number;
  /** Historical import/replay limit, not a product history window. */
  readonly recentTemplateLimit: number;
  readonly recentEntryLimit: number;
  readonly recentConstructionPenalty: number;
  readonly recentConstructionLimit: number;
  readonly maximumCandidateDraws: number;
  readonly preferredSyllables: number;
  readonly preferredKeystrokes: number;
}

export const FREQUENCY_FIRST_UTTERANCE_POLICY: FrequencyFirstUtterancePolicy = {
  version: "frequency-first-utterance-v2",
  minimumBindingAttempts: 4,
  minimumBindingTimingSamples: 8,
  maximumExpectedTokenBoost: 1.45,
  maximumCombinedLearnerBoost: 1.5,
  errorBoostScale: 1.5,
  timingBoostScale: 0.35,
  coverageBoostScale: 0.1,
  coverageTargetAttempts: 8,
  recentEntryPenalty: 0.72,
  recentUtterancePenalty: 0.3,
  recentTemplatePenalty: 0.78,
  recentUtteranceLimit: 8,
  recentTemplateLimit: 6,
  recentEntryLimit: 24,
  recentConstructionPenalty: 0.78,
  recentConstructionLimit: 4,
  maximumCandidateDraws: 4,
  preferredSyllables: 12,
  preferredKeystrokes: 40,
};

export function validateFrequencyFirstUtterancePolicy(
  policy: FrequencyFirstUtterancePolicy,
): void {
  if (policy.version.length === 0) throw new Error("utterance policy version must not be empty");
  const positiveIntegers = [
    policy.minimumBindingAttempts,
    policy.coverageTargetAttempts,
    policy.minimumBindingTimingSamples,
    policy.recentUtteranceLimit,
    policy.recentTemplateLimit,
    policy.recentEntryLimit,
    policy.recentConstructionLimit,
    policy.maximumCandidateDraws,
    policy.preferredSyllables,
    policy.preferredKeystrokes,
  ];
  if (positiveIntegers.some((value) => !Number.isInteger(value) || value <= 0)) {
    throw new RangeError("utterance policy counts must be positive integers");
  }
  for (const factor of [
    policy.recentEntryPenalty,
    policy.recentUtterancePenalty,
    policy.recentTemplatePenalty,
    policy.recentConstructionPenalty,
  ]) {
    if (!Number.isFinite(factor) || factor <= 0 || factor > 1) {
      throw new RangeError("recent penalties must be in (0, 1]");
    }
  }
  for (const scale of [policy.errorBoostScale, policy.timingBoostScale, policy.coverageBoostScale]) {
    if (!Number.isFinite(scale) || scale < 0) throw new RangeError("learner boost scales must be finite and non-negative");
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
