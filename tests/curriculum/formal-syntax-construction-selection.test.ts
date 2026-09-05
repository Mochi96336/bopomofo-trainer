import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "../../src/core/model.js";
import {
  createSentenceConstructionPracticePlan,
} from "../../src/curriculum/formal-syntax-construction-practice.js";
import {
  FREQUENCY_FIRST_UTTERANCE_POLICY,
  selectFormalSyntaxUtterance,
} from "../../src/curriculum/frequency-first-utterance.js";
import { CAUSATIVE_FINITE_CCOMP_VIEW } from "../../src/syntax/causative-construction-view.js";
import { FORMAL_SYNTAX_RULES } from "../../src/syntax/grammar.js";
import {
  CAUSATIVE_CCOMP_SAME_OCCURRENCE_CAPABILITY,
} from "../../src/syntax/runtime-occurrence-capabilities.js";
import type { ProductionRule, RuntimeSyntaxProfile } from "../../src/syntax/types.js";

const STABLE_RANDOM = { next: () => 0 };
const HISTORY = {
  recentEntryIds: [],
  recentUtteranceIds: [],
  recentTemplateIds: [],
} as const;

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
  options: {
    readonly occurrenceCapability?: boolean;
    readonly morphologicalFeatureCounts?: Readonly<Record<string, number>>;
  } = {},
): RuntimeSyntaxProfile {
  return {
    id,
    entryId,
    upos,
    functions,
    valencyFrames,
    ...(options.occurrenceCapability
      ? { occurrenceCapabilities: [CAUSATIVE_CCOMP_SAME_OCCURRENCE_CAPABILITY] }
      : {}),
    provenanceIds: ["test"],
    dependencyEvidence: {
      dependencyRelationCounts: {},
      surfacePositionCounts: {},
      ...(options.morphologicalFeatureCounts === undefined
        ? {}
        : { morphologicalFeatureCounts: options.morphologicalFeatureCounts }),
    },
  };
}

function canonicalRule(ruleId: string): ProductionRule {
  const rule = FORMAL_SYNTAX_RULES.find((candidate) => candidate.id === ruleId);
  if (rule === undefined) throw new Error(`missing canonical test rule ${ruleId}`);
  return rule;
}

const CAUSATIVE_RULES: readonly ProductionRule[] = [
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
const STOP_ENTRY = entry("entry:stop", "阻止");
const HE_ENTRY = entry("entry:he", "他");
const WALK_ENTRY = entry("entry:walk", "走");

function causativePlan() {
  return createSentenceConstructionPracticePlan(
    CAUSATIVE_FINITE_CCOMP_VIEW,
    { sentenceRuleId: "sentence.declarative", constituentKey: "clause" },
    CAUSATIVE_RULES,
  );
}

function selectWith(
  entries: readonly CatalogEntry[],
  profiles: readonly RuntimeSyntaxProfile[],
  formalSyntaxComposition = causativePlan(),
) {
  return selectFormalSyntaxUtterance({
    entries,
    bindingEvidence: [],
    mode: "guided",
    layoutId: "standard",
    history: HISTORY,
    policy: FREQUENCY_FIRST_UTTERANCE_POLICY,
    profiles,
    random: STABLE_RANDOM,
    formalSyntaxComposition,
  });
}

function causativeProfiles(): readonly RuntimeSyntaxProfile[] {
  return [
    profile(
      "profile:let",
      LET_ENTRY.id,
      "VERB",
      ["predicate"],
      ["clausal-complement"],
      { occurrenceCapability: true },
    ),
    profile("profile:he", HE_ENTRY.id, "NOUN", ["subject"], ["avalent"]),
    profile("profile:walk", WALK_ENTRY.id, "VERB", ["predicate"], ["intransitive"]),
  ];
}

describe("formal syntax construction selection", () => {
  it("carries grammar intent without exposing an execution-bound knob", () => {
    const plan = causativePlan();
    expect("minimumClauseNesting" in plan).toBe(false);
    expect(plan.samplingMode).toBe("raw");
    expect(plan.structuralTarget).toEqual({
      rootProductionRuleId: "sentence.declarative",
      nestedProductionTargets: [{
        parentRuleId: "sentence.declarative",
        constituentKey: "clause",
        childRuleId: "clause.object-content",
      }],
    });
  });

  it("derives the finite-ccomp execution depth and realizes same-occurrence causative practice", () => {
    const selection = selectWith(
      [LET_ENTRY, HE_ENTRY, WALK_ENTRY],
      causativeProfiles(),
    );

    expect(selection.utterance).toMatchObject({
      kind: "formal-syntax",
      text: "讓他走",
      syntaxRootRuleId: "sentence.declarative",
      entries: [LET_ENTRY, HE_ENTRY, WALK_ENTRY],
    });
    expect(selection.score.frequencyBase).toBeGreaterThan(0);
    expect(selection.score.transitionBoost).toBe(1);
    expect(selection.score.transitionTrace).toEqual([]);
    expect(selection.slotSelections).toEqual([]);
    expect(selection.templateCandidates).toEqual([]);
  });

  it("still rejects aggregate Voice=Cau + ccomp without same-occurrence capability", () => {
    expect(() => selectWith(
      [STOP_ENTRY, HE_ENTRY, WALK_ENTRY],
      [
        profile(
          "profile:stop",
          STOP_ENTRY.id,
          "VERB",
          ["predicate"],
          ["clausal-complement"],
          { morphologicalFeatureCounts: { "Voice=Cau": 1 } },
        ),
        profile("profile:he", HE_ENTRY.id, "NOUN", ["subject"], ["avalent"]),
        profile("profile:walk", WALK_ENTRY.id, "VERB", ["predicate"], ["intransitive"]),
      ],
    )).toThrow(/no grammar-valid utterance candidate/u);
  });

  it("fails closed when the structural target stays recursive past the selector ceiling", () => {
    const plan = causativePlan();
    expect(() => selectWith(
      [LET_ENTRY, HE_ENTRY, WALK_ENTRY],
      causativeProfiles(),
      {
        ...plan,
        structuralTarget: {
          rootProductionRuleId: "sentence.declarative",
          nestedProductionTargets: [
            {
              parentRuleId: "sentence.declarative",
              constituentKey: "clause",
              childRuleId: "clause.object-content",
            },
            {
              parentRuleId: "clause.object-content",
              constituentKey: "objectClause",
              childRuleId: "content.clause",
            },
            {
              parentRuleId: "content.clause",
              constituentKey: "clause",
              childRuleId: "clause.object-content",
            },
          ],
        },
      },
    )).toThrow(/structuralTarget exceeds selector clause ceiling/u);
  });
});
