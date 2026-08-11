import { describe, expect, it } from "vitest";
import {
  FREQUENCY_FIRST_UTTERANCE_POLICY,
  selectFormalSyntaxUtterance,
  selectFrequencyFirstUtterance,
} from "../../src/curriculum/frequency-first-utterance.js";
import { createSeededRandom } from "../../src/curriculum/random.js";
import { bindingScopeKey, transitionScopeKey } from "../../src/measurement/aggregate.js";
import type { MeasurementSummary } from "../../src/measurement/types.js";
import {
  bindingAggregateKey,
  createEmptyMeasurementSummaryV2,
  type MeasurementSummaryV2,
} from "../../src/measurement-v2/aggregate.js";
import { PRACTICE, SYNTAX_PROFILES } from "../product/fixtures.js";

const mode = "guided" as const;
const layoutId = "standard";
const history = {
  recentEntryIds: [] as string[],
  recentUtteranceIds: [] as string[],
  recentTemplateIds: [] as string[],
};

function evidencePair(): {
  readonly v2: MeasurementSummaryV2;
  readonly legacy: MeasurementSummary;
} {
  const scope = { mode, layoutId, tokenId: "tone:1" };
  const binding = {
    scope,
    attempts: 12,
    errors: 5,
    timingSamples: 6,
    currentTimeToTypeMs: 420,
    bestTimeToTypeMs: 210,
  } as const;
  const empty = createEmptyMeasurementSummaryV2();
  const v2: MeasurementSummaryV2 = {
    ...empty,
    semantic: {
      ...empty.semantic,
      bindings: {
        [bindingAggregateKey(scope)]: binding,
      },
    },
  };
  const transitionScope = {
    mode,
    layoutId,
    fromToken: "zhuyin:ㄇ",
    toToken: "zhuyin:ㄚ",
  } as const;
  const legacy: MeasurementSummary = {
    policyVersion: "legacy-selection-test",
    traceCount: 999,
    bindingObservationCount: 12,
    confusionObservationCount: 77,
    transitionObservationCount: 9,
    bindings: {
      [bindingScopeKey(scope)]: {
        ...binding,
        timingExclusions: {
          syllableStart: 101,
          incorrect: 102,
          recovery: 103,
          interactionNoise: 104,
        },
      },
    },
    confusions: {},
    transitions: {
      [transitionScopeKey(transitionScope)]: {
        scope: transitionScope,
        timingSamples: 9,
        currentTimeToTypeMs: 900,
        bestTimeToTypeMs: 100,
      },
    },
  };
  return { v2, legacy };
}

describe("production selection learner-evidence seam", () => {
  it("selects identically from V2 binding evidence and the former legacy binding-only path", () => {
    const { v2, legacy } = evidencePair();
    const seed = "selection-evidence-contract";

    const previous = selectFrequencyFirstUtterance({
      entries: PRACTICE,
      annotations: {},
      measurement: legacy,
      mode,
      layoutId,
      history,
      policy: FREQUENCY_FIRST_UTTERANCE_POLICY,
      random: createSeededRandom(seed),
      learnerEvidenceMode: "binding-only",
      profiles: SYNTAX_PROFILES,
    });
    const native = selectFormalSyntaxUtterance({
      entries: PRACTICE,
      bindingEvidence: Object.values(v2.semantic.bindings),
      mode,
      layoutId,
      history,
      policy: FREQUENCY_FIRST_UTTERANCE_POLICY,
      random: createSeededRandom(seed),
      profiles: SYNTAX_PROFILES,
    });

    expect(native).toEqual(previous);
    expect(native.score.transitionBoost).toBe(1);
    expect(native.score.transitionTrace).toEqual([]);
  });
});
