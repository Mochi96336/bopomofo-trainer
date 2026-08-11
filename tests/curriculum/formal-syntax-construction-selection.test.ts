import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "../../src/core/model.js";
import {
  createSentenceConstructionPracticePlan,
} from "../../src/curriculum/formal-syntax-construction-practice.js";
import {
  FREQUENCY_FIRST_UTTERANCE_POLICY,
  selectFormalSyntaxUtterance,
  selectFrequencyFirstUtterance,
} from "../../src/curriculum/frequency-first-utterance.js";
import { CAUSATIVE_FINITE_CCOMP_VIEW } from "../../src/syntax/causative-construction-view.js";
import { FORMAL_SYNTAX_RULES } from "../../src/syntax/grammar.js";
import type { ProductionRule, RuntimeSyntaxProfile } from "../../src/syntax/types.js";
import type { MeasurementSummary } from "../../src/measurement/types.js";

const STABLE_RANDOM = { next: () => 0 };

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

function entry(id: string, text: string): CatalogEntry {
  return {
    id,
    prompt: { text, locale: "zh-TW" },
    syllables: [{ tokens: ["zhuyin:ㄅ", "tone:1"] }],
    commonnessBase: {
      modelVersion: "commonness-v1",
      sourceId: "test",
      sourceVersion: "test-v1",
      sourceRowId: id,
      spokenPerMillion: null,
      writtenPerMillion: null,
      spokenStrength: null,
      writtenStrength: null,
      score: 1,
      selectionWeight: 1,
      confidence: "reviewed",
      reasons: [],
    },
    tags: ["test"],
    provenanceIds: ["test"],
  };
}

function profile(
  id: string,
  entryId: string,
  upos: RuntimeSyntaxProfile["upos"],
  functions: RuntimeSyntaxProfile["functions"],
  valencyFrames: RuntimeSyntaxProfile["valencyFrames"],
  morphologicalFeatureCounts: Readonly<Record<string, number>> = {},
): RuntimeSyntaxProfile {
  return {
    id,
    entryId,
    upos,
    functions,
    valencyFrames,
    provenanceIds: ["test"],
    dependencyEvidence: {
      dependencyRelationCounts: {},
      surfacePositionCounts: {},
      morphologicalFeatureCounts,
    },
  };
}

function canonicalRule(ruleId: string): ProductionRule {
  const rule = FORMAL_SYNTAX_RULES.find((candidate) => candidate.id === ruleId);
  if (rule === undefined) throw new Error(`missing canonical test rule ${ruleId}`);
  return rule;
}

const CAUSATIVE_PRACTICE_RULES: readonly ProductionRule[] = [
  canonicalRule("sentence.declarative"),
  canonicalRule("clause.object-content"),
  canonicalRule("clause.intransitive"),
  canonicalRule("content.clause"),
  canonicalRule("argument.subject.noun"),
  canonicalRule("phrase.noun.bare"),
  canonicalRule("phrase.nominal-head.noun"),
  canonicalRule("predicate.verb.lexical"),
];

const LET_ENTRY = entry("entry:let", "讓");
const HE_ENTRY = entry("entry:he", "他");
const WALK_ENTRY = entry("entry:walk", "走");
const ENTRIES = [LET_ENTRY, HE_ENTRY, WALK_ENTRY] as const;
const PROFILES: readonly RuntimeSyntaxProfile[] = [
  profile(
    "profile:let",
    LET_ENTRY.id,
    "VERB",
    ["predicate"],
    ["clausal-complement"],
    { "Voice=Cau": 1 },
  ),
  profile("profile:he", HE_ENTRY.id, "NOUN", ["subject"], ["avalent"]),
  profile("profile:walk", WALK_ENTRY.id, "VERB", ["predicate"], ["intransitive"]),
];
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
      CAUSATIVE_PRACTICE_RULES,
    );
    const selection = selectFormalSyntaxUtterance({
      entries: ENTRIES,
      profiles: PROFILES,
      measurement: emptyMeasurement(),
      mode: "guided",
      layoutId: "standard",
      history: HISTORY,
      policy: FREQUENCY_FIRST_UTTERANCE_POLICY,
      random: STABLE_RANDOM,
      formalSyntaxComposition: plan,
    });

    expect(selection.utterance).toMatchObject({
      kind: "formal-syntax",
      text: "讓他走",
      syntaxRootRuleId: "sentence.declarative",
      entries: ENTRIES,
    });
    expect(selection.score.entryIds).toEqual(ENTRIES.map((item) => item.id));
    expect(selection.score.frequencyBase).toBeGreaterThan(0);
    expect(selection.score.expectedTokenBoost).toBe(1);
    expect(selection.score.transitionBoost).toBe(1);
    expect(selection.slotSelections).toEqual([]);
    expect(selection.templateCandidates).toEqual([]);

    const profileIds = selection.utterance.syntaxProfileIds ?? [];
    const profilesById = new Map(PROFILES.map((item) => [item.id, item]));
    expect(profileIds).not.toHaveLength(0);
    expect(profileIds.some((profileId) => {
      const selectedProfile = profilesById.get(profileId);
      return selectedProfile !== undefined
        && selectedProfile.valencyFrames.includes("clausal-complement")
        && (selectedProfile.dependencyEvidence.morphologicalFeatureCounts?.["Voice=Cau"] ?? 0) > 0;
    })).toBe(true);
  });

  it("rejects formal syntax composition overrides without runtime profiles", () => {
    const plan = createSentenceConstructionPracticePlan(
      CAUSATIVE_FINITE_CCOMP_VIEW,
      { sentenceRuleId: "sentence.declarative", constituentKey: "clause" },
      CAUSATIVE_PRACTICE_RULES,
    );
    expect(() => selectFrequencyFirstUtterance({
      entries: ENTRIES,
      annotations: {},
      measurement: emptyMeasurement(),
      mode: "guided",
      layoutId: "standard",
      history: HISTORY,
      policy: FREQUENCY_FIRST_UTTERANCE_POLICY,
      random: STABLE_RANDOM,
      formalSyntaxComposition: plan,
    })).toThrow(/formalSyntaxComposition requires formal syntax profiles/u);
  });
});
