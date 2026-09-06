import { describe, expect, it } from "vitest";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import type { CatalogEntry } from "../../src/core/model.js";
import {
  FREQUENCY_FIRST_UTTERANCE_POLICY,
  selectFormalSyntaxUtterance,
} from "../../src/curriculum/frequency-first-utterance.js";
import { FORMAL_SYNTAX_RULES } from "../../src/syntax/grammar.js";
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
  options: {
    readonly functions?: RuntimeSyntaxProfile["functions"];
    readonly valencyFrames?: RuntimeSyntaxProfile["valencyFrames"];
    readonly dependencyRelationCounts?: RuntimeSyntaxProfile["dependencyEvidence"]["dependencyRelationCounts"];
  } = {},
): RuntimeSyntaxProfile {
  return {
    id,
    entryId,
    upos,
    functions: options.functions ?? [],
    valencyFrames: options.valencyFrames ?? [],
    provenanceIds: ["test"],
    dependencyEvidence: {
      dependencyRelationCounts: options.dependencyRelationCounts ?? {},
      surfacePositionCounts: {},
      morphologicalFeatureCounts: {},
    },
  };
}

function canonicalRule(ruleId: string): ProductionRule {
  const rule = FORMAL_SYNTAX_RULES.find((candidate) => candidate.id === ruleId);
  if (rule === undefined) throw new Error(`missing canonical test rule ${ruleId}`);
  return rule;
}

const BA_RULES: readonly ProductionRule[] = [
  canonicalRule("sentence.declarative"),
  canonicalRule("clause.ba"),
  canonicalRule("argument.subject.noun"),
  canonicalRule("argument.disposal-patient.noun"),
  canonicalRule("phrase.noun.bare"),
  canonicalRule("phrase.nominal-head.noun"),
  canonicalRule("predicate.verb.lexical"),
  canonicalRule("ba-predicate.attested"),
  canonicalRule("ba-predicate.completed.complement"),
  canonicalRule("ba-predicate.completed.aspect"),
  canonicalRule("complement.directional"),
];

const HE = entry("entry:he", "他");
const BA = entry(catalogEntryId("把", "ㄅㄚ3"), "把");
const BOOK = entry("entry:book", "書");
const TAKE = entry("entry:take", "拿");
const WALK = entry("entry:walk", "走");
const COME = entry("entry:come", "來");

const BA_PRODUCTIVE_DIRECTIONAL_PLAN = {
  rules: BA_RULES,
  samplingMode: "raw" as const,
  structuralTarget: {
    rootProductionRuleId: "sentence.declarative",
    nestedProductionTargets: [
      {
        parentRuleId: "sentence.declarative",
        constituentKey: "clause",
        childRuleId: "clause.ba",
      },
      {
        parentRuleId: "clause.ba",
        constituentKey: "predicate",
        childRuleId: "ba-predicate.completed.complement",
      },
      {
        parentRuleId: "ba-predicate.completed.complement",
        constituentKey: "complement",
        childRuleId: "complement.directional",
      },
    ],
  },
};

function sharedProfiles(
  predicate: CatalogEntry,
  valencyFrames: RuntimeSyntaxProfile["valencyFrames"],
): readonly RuntimeSyntaxProfile[] {
  return [
    profile("profile:he", HE.id, "NOUN"),
    profile("profile:ba", BA.id, "ADP", {
      functions: ["adposition"],
      dependencyRelationCounts: { case: 1 },
    }),
    profile("profile:book", BOOK.id, "NOUN"),
    profile("profile:predicate", predicate.id, "VERB", {
      functions: ["predicate"],
      valencyFrames,
    }),
    profile("profile:come", COME.id, "VERB", {
      dependencyRelationCounts: { "compound:dir": 1 },
    }),
  ];
}

function selectWith(
  predicate: CatalogEntry,
  valencyFrames: RuntimeSyntaxProfile["valencyFrames"],
) {
  return selectFormalSyntaxUtterance({
    entries: [HE, BA, BOOK, predicate, COME],
    bindingEvidence: [],
    mode: "guided",
    layoutId: "standard",
    history: HISTORY,
    policy: FREQUENCY_FIRST_UTTERANCE_POLICY,
    profiles: sharedProfiles(predicate, valencyFrames),
    random: STABLE_RANDOM,
    formalSyntaxComposition: BA_PRODUCTIVE_DIRECTIONAL_PLAN,
  });
}

describe("productive BA construction selection", () => {
  it("activates an unseen patient-taking predicate through explicit productive BA practice", () => {
    const selection = selectWith(TAKE, ["transitive"]);

    const predicateProfile = sharedProfiles(TAKE, ["transitive"])
      .find((candidate) => candidate.entryId === TAKE.id);
    expect(predicateProfile?.occurrenceCapabilities ?? []).toEqual([]);

    expect(selection.utterance.kind).toBe("formal-syntax");
    expect(selection.utterance.syntaxRootRuleId).toBe("sentence.declarative");
    expect(["他把書拿來", "書把他拿來"]).toContain(selection.utterance.text);
    expect(selection.utterance.entries.map((candidate) => candidate.id)).toEqual(
      selection.utterance.text === "他把書拿來"
        ? [HE.id, BA.id, BOOK.id, TAKE.id, COME.id]
        : [BOOK.id, BA.id, HE.id, TAKE.id, COME.id],
    );
    expect(selection.score.frequencyBase).toBeGreaterThan(0);
    expect(selection.score.transitionBoost).toBe(1);
    expect(selection.score.transitionTrace).toEqual([]);
    expect(selection.slotSelections).toEqual([]);
    expect(selection.templateCandidates).toEqual([]);
  });

  it("does not let the selector override the productive BA patient-taking gate", () => {
    expect(() => selectWith(WALK, ["intransitive"]))
      .toThrow(/no grammar-valid utterance candidate/u);
  });
});
