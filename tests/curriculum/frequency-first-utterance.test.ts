import { describe, expect, it } from "vitest";
import type { CatalogEntry, RandomSource } from "../../src/core/model.js";
import {
  FREQUENCY_FIRST_UTTERANCE_POLICY,
  createFrequencyFirstSelectionState,
  selectFrequencyFirstUtterance,
  updateFrequencyFirstSelectionState,
  type EntrySelectionScore,
  type FrequencyFirstUtteranceSelection,
} from "../../src/curriculum/frequency-first-utterance.js";
import { bindingScopeKey, confusionScopeKey, transitionScopeKey } from "../../src/measurement/aggregate.js";
import type { MeasurementSummary } from "../../src/measurement/types.js";
import type { GrammarAnnotation } from "../../src/grammar/types.js";

const mode = "guided" as const;
const layoutId = "standard";

function random(value: number): RandomSource {
  return { next: () => value };
}

function entry(
  id: string,
  text: string,
  selectionWeight: number,
  tokens: readonly string[],
): CatalogEntry {
  return {
    id,
    prompt: { text, locale: "zh-TW" },
    syllables: [{ tokens }],
    commonnessBase: {
      modelVersion: "commonness-v1",
      sourceId: "test",
      sourceVersion: "test-v1",
      sourceRowId: id,
      spokenPerMillion: null,
      writtenPerMillion: null,
      spokenStrength: null,
      writtenStrength: null,
      score: selectionWeight,
      selectionWeight,
      confidence: "reviewed",
      reasons: [],
    },
    tags: ["test"],
    provenanceIds: ["test:frequency"],
  };
}

const common = entry("common", "謝謝", 0.9, ["zhuyin:ㄒ", "zhuyin:ㄧ", "tone:4"]);
const lessCommon = entry("less-common", "再見", 0.3, ["zhuyin:ㄗ", "zhuyin:ㄞ", "tone:4"]);

const annotations: Readonly<Record<string, GrammarAnnotation>> = {
  common: {
    entryId: "common",
    roles: ["formulaic"],
    predicateFrame: "none",
    standaloneKind: "utterance",
    provenanceIds: ["test:frequency"],
  },
  "less-common": {
    entryId: "less-common",
    roles: ["formulaic"],
    predicateFrame: "none",
    standaloneKind: "utterance",
    provenanceIds: ["test:frequency"],
  },
};

function emptyMeasurement(): MeasurementSummary {
  return {
    policyVersion: "phase-3-v1",
    traceCount: 0,
    bindingObservationCount: 0,
    confusionObservationCount: 0,
    transitionObservationCount: 0,
    bindings: {},
    confusions: {},
    transitions: {},
  };
}

function input(
  measurement: MeasurementSummary = emptyMeasurement(),
  entries: readonly CatalogEntry[] = [common, lessCommon],
) {
  return {
    entries,
    annotations,
    measurement,
    mode,
    layoutId,
    history: {
      recentEntryIds: [],
      recentUtteranceIds: [],
      recentTemplateIds: [],
    },
    policy: FREQUENCY_FIRST_UTTERANCE_POLICY,
    random: random(0),
  } as const;
}

function slotCandidate(
  selection: FrequencyFirstUtteranceSelection,
  entryId: string,
): EntrySelectionScore {
  const candidate = selection.slotSelections
    .flatMap((slot) => slot.candidates)
    .find((item) => item.entryId === entryId);
  if (candidate === undefined) throw new Error(`missing slot candidate: ${entryId}`);
  return candidate;
}

function weakLessCommonMeasurement(): MeasurementSummary {
  const tokenId = "zhuyin:ㄗ";
  const bindingKey = bindingScopeKey({ mode, layoutId, tokenId });
  const transitionKey = transitionScopeKey({
    mode,
    layoutId,
    fromToken: "zhuyin:ㄗ",
    toToken: "zhuyin:ㄞ",
  });
  return {
    policyVersion: "phase-3-v1",
    traceCount: 20,
    bindingObservationCount: 10,
    confusionObservationCount: 0,
    transitionObservationCount: 4,
    bindings: {
      [bindingKey]: {
        scope: { mode, layoutId, tokenId },
        attempts: 10,
        errors: 5,
        timingSamples: 4,
        currentTimeToTypeMs: 600,
        bestTimeToTypeMs: 300,
        timingExclusions: {
          syllableStart: 0,
          incorrect: 0,
          recovery: 0,
          interactionNoise: 0,
        },
      },
    },
    confusions: {},
    transitions: {
      [transitionKey]: {
        scope: {
          mode,
          layoutId,
          fromToken: "zhuyin:ㄗ",
          toToken: "zhuyin:ㄞ",
        },
        timingSamples: 4,
        currentTimeToTypeMs: 500,
        bestTimeToTypeMs: 250,
      },
    },
  };
}

describe("frequency-first grammatical utterance policy", () => {
  it("adds bounded expected-token and exact-transition weight without erasing frequency priority", () => {
    const selection = selectFrequencyFirstUtterance(input(weakLessCommonMeasurement()));
    const commonScore = slotCandidate(selection, "common");
    const weakScore = slotCandidate(selection, "less-common");
    expect(weakScore.expectedTokenBoost).toBeGreaterThan(1);
    expect(weakScore.transitionBoost).toBeGreaterThan(1);
    expect(weakScore.combinedLearnerBoost)
      .toBeLessThanOrEqual(FREQUENCY_FIRST_UTTERANCE_POLICY.maximumCombinedLearnerBoost);
    expect(weakScore.totalWeight).toBeLessThan(commonScore.totalWeight);
  });

  it("does not read expected-to-actual confusion aggregates for curriculum scoring", () => {
    const measurement = weakLessCommonMeasurement();
    const confusionKey = confusionScopeKey({
      mode,
      layoutId,
      expectedToken: "zhuyin:ㄗ",
      actualToken: "zhuyin:ㄓ",
    });
    const withConfusion: MeasurementSummary = {
      ...measurement,
      traceCount: measurement.traceCount + 99,
      confusionObservationCount: 99,
      confusions: {
        [confusionKey]: {
          scope: {
            mode,
            layoutId,
            expectedToken: "zhuyin:ㄗ",
            actualToken: "zhuyin:ㄓ",
          },
          occurrences: 99,
        },
      },
    };
    expect(selectFrequencyFirstUtterance(input(withConfusion)).slotSelections)
      .toEqual(selectFrequencyFirstUtterance(input(measurement)).slotSelections);
  });

  it("penalizes recent utterances without making them invalid", () => {
    const baseline = selectFrequencyFirstUtterance(input());
    const repeated = selectFrequencyFirstUtterance({
      ...input(),
      history: {
        recentEntryIds: ["common"],
        recentUtteranceIds: [baseline.utterance.id],
        recentTemplateIds: [baseline.utterance.templateId!],
      },
    });
    expect(repeated.utterance.id).toBe(baseline.utterance.id);
    expect(repeated.score.recentEntryFactor).toBeLessThan(1);
    expect(repeated.score.recentUtteranceFactor).toBeLessThan(1);
    expect(repeated.score.recentTemplateFactor).toBe(1);
    expect(repeated.score.totalWeight).toBeLessThan(baseline.score.totalWeight);
  });

  it("replays identically after reversing catalog and annotation order", () => {
    const forward = selectFrequencyFirstUtterance(input(weakLessCommonMeasurement()));
    const reversedAnnotations = Object.fromEntries(Object.entries(annotations).reverse());
    const reversed = selectFrequencyFirstUtterance({
      ...input(weakLessCommonMeasurement(), [lessCommon, common]),
      annotations: reversedAnnotations,
    });
    expect(reversed).toEqual(forward);
  });

  // The selection state carries only what the next round needs: what was just
  // practiced. There is no stage to unlock and no per-stage tally to keep.
  it("remembers only the recent utterance and template", () => {
    const policy = FREQUENCY_FIRST_UTTERANCE_POLICY;
    const selection = selectFrequencyFirstUtterance(input());
    let state = createFrequencyFirstSelectionState(policy);
    state = updateFrequencyFirstSelectionState(state, selection, policy);
    expect(state).toEqual({
      policyVersion: policy.version,
      recentUtteranceIds: [selection.utterance.id],
      recentTemplateIds: selection.utterance.templateId === null
        ? []
        : [selection.utterance.templateId],
    });
  });
});
