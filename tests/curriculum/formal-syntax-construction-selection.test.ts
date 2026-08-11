import { describe, expect, it } from "vitest";
import {
  PRACTICE_CATALOG,
  SYNTAX_PROFILES,
} from "../../src/app/generated/catalog.js";
import type { RandomSource } from "../../src/core/model.js";
import {
  createSentenceConstructionPracticePlan,
} from "../../src/curriculum/formal-syntax-construction-practice.js";
import {
  FREQUENCY_FIRST_UTTERANCE_POLICY,
  selectFormalSyntaxUtterance,
  selectFrequencyFirstUtterance,
} from "../../src/curriculum/frequency-first-utterance.js";
import { CAUSATIVE_FINITE_CCOMP_VIEW } from "../../src/syntax/causative-construction-view.js";
import type { MeasurementSummary } from "../../src/measurement/types.js";

class DeterministicRandom implements RandomSource {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  next(): number {
    this.state = (Math.imul(this.state, 1664525) + 1013904223) >>> 0;
    return this.state / 0x1_0000_0000;
  }
}

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

const HISTORY = {
  recentEntryIds: [],
  recentUtteranceIds: [],
  recentTemplateIds: [],
} as const;

describe("frequency-first formal syntax construction selection", () => {
  it("keeps frequency-first candidate scoring while constraining syntax practice", () => {
    const plan = createSentenceConstructionPracticePlan(
      CAUSATIVE_FINITE_CCOMP_VIEW,
      { sentenceRuleId: "sentence.declarative", constituentKey: "clause" },
    );
    const selection = selectFormalSyntaxUtterance({
      entries: PRACTICE_CATALOG,
      profiles: SYNTAX_PROFILES,
      measurement: emptyMeasurement(),
      mode: "guided",
      layoutId: "standard",
      history: HISTORY,
      policy: FREQUENCY_FIRST_UTTERANCE_POLICY,
      random: new DeterministicRandom(0x51ec710),
      formalSyntaxComposition: plan,
    });

    expect(selection.utterance.kind).toBe("formal-syntax");
    expect(selection.utterance.syntaxRootRuleId).toBe("sentence.declarative");
    expect(selection.utterance.entries.length).toBeGreaterThan(1);
    expect(selection.score.entryIds).toEqual(
      selection.utterance.entries.map((entry) => entry.id),
    );
    expect(selection.score.frequencyBase).toBeGreaterThan(0);
    expect(selection.score.expectedTokenBoost).toBe(1);
    expect(selection.score.transitionBoost).toBe(1);
    expect(selection.slotSelections).toEqual([]);
    expect(selection.templateCandidates).toEqual([]);

    const profileIds = selection.utterance.syntaxProfileIds ?? [];
    const profilesById = new Map(SYNTAX_PROFILES.map((profile) => [profile.id, profile]));
    expect(profileIds).not.toHaveLength(0);
    expect(profileIds.some((profileId) => {
      const profile = profilesById.get(profileId);
      return profile !== undefined
        && profile.valencyFrames.includes("clausal-complement")
        && (profile.dependencyEvidence.morphologicalFeatureCounts?.["Voice=Cau"] ?? 0) > 0;
    })).toBe(true);
  });

  it("rejects formal syntax composition overrides without runtime profiles", () => {
    const plan = createSentenceConstructionPracticePlan(
      CAUSATIVE_FINITE_CCOMP_VIEW,
      { sentenceRuleId: "sentence.declarative", constituentKey: "clause" },
    );
    expect(() => selectFrequencyFirstUtterance({
      entries: PRACTICE_CATALOG,
      annotations: {},
      measurement: emptyMeasurement(),
      mode: "guided",
      layoutId: "standard",
      history: HISTORY,
      policy: FREQUENCY_FIRST_UTTERANCE_POLICY,
      random: new DeterministicRandom(1),
      formalSyntaxComposition: plan,
    })).toThrow(/formalSyntaxComposition requires formal syntax profiles/u);
  });
});
