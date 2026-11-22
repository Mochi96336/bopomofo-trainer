import { createSeededRandom } from "./random.js";

/**
 * Research-only isolation of NEW sentence reading candidates.
 *
 * Baseline is already selected by the unchanged product. Exploration uses
 * independent, versioned seeds and NEVER mutates/consumes its RNG.
 * No successful target => return the identical baseline object, not a fresh
 * sentence that merely happens to be grammatical.
 *
 * The caller must validate reading-specific grammar/evidence on each trial.
 */
export function selectIsolatedReadingExploration<T>(input: {
  readonly baseline: T;
  readonly seed: string;
  readonly explorationRate: number;
  readonly maximumExplorationAttempts: number;
  readonly generateTrial: (isolatedSeed: string) => T | null;
  readonly gainsVerifiedTarget: (trial: T, baseline: T) => boolean;
}): {
  readonly chosen: T;
  readonly outcome: "skipped" | "restored" | "reverted";
  readonly trialAttempts: number;
} {
  if (!Number.isFinite(input.explorationRate)
    || input.explorationRate < 0 || input.explorationRate > 1) {
    throw new RangeError("exploration rate must be in [0, 1]");
  }
  if (!Number.isInteger(input.maximumExplorationAttempts)
    || input.maximumExplorationAttempts < 1 || input.maximumExplorationAttempts > 16) {
    throw new RangeError("exploration attempts must be an integer in [1, 16]");
  }
  if (createSeededRandom(input.seed + ":reading-explore-gate-v1").next()
    >= input.explorationRate) {
    return { chosen: input.baseline, outcome: "skipped", trialAttempts: 0 };
  }
  for (let attempt = 0; attempt < input.maximumExplorationAttempts; attempt++) {
    const isolatedSeed = input.seed + ":reading-explore-candidate-v1:" + attempt;
    const trial = input.generateTrial(isolatedSeed);
    if (trial !== null && input.gainsVerifiedTarget(trial, input.baseline)) {
      return { chosen: trial, outcome: "restored", trialAttempts: attempt + 1 };
    }
  }
  return {
    chosen: input.baseline,
    outcome: "reverted",
    trialAttempts: input.maximumExplorationAttempts,
  };
}
