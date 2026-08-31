import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "../../src/core/model.js";
import {
  createSentenceConstructionPracticePlan,
} from "../../src/curriculum/formal-syntax-construction-practice.js";
import {
  FREQUENCY_FIRST_UTTERANCE_POLICY,
  selectFormalSyntaxUtterance,
} from "../../src/curriculum/frequency-first-utterance.js";
import { FORMAL_SYNTAX_RULES } from "../../src/syntax/grammar.js";
import { SHORT_PASSIVE_CONSTRUCTION_VIEW } from "../../src/syntax/passive-construction-view.js";
import {
  SHORT_PASSIVE_AUX_PASS_SAME_OCCURRENCE_CAPABILITY,
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
  options: {
    readonly valencyFrames?: RuntimeSyntaxProfile["valencyFrames"];
    readonly occurrenceCapability?: boolean;
    readonly dependencyRelationCounts?: Readonly<Record<string, number>>;
  } = {},
): RuntimeSyntaxProfile {
  return {
    id,
    entryId,
    upos,
    functions: [],
    valencyFrames: options.valencyFrames ?? [],
    ...(options.occurrenceCapability
      ? { occurrenceCapabilities: [SHORT_PASSIVE_AUX_PASS_SAME_OCCURRENCE_CAPABILITY] }
      : {}),
    provenanceIds: ["test"],
    dependencyEvidence: {
      dependencyRelationCounts: options.dependencyRelationCounts ?? {},
      surfacePositionCounts: {},
    },
  };
}

function canonicalRule(ruleId: string): ProductionRule {
  const rule = FORMAL_SYNTAX_RULES.find((candidate) => candidate.id === ruleId);
  if (rule === undefined) throw new Error(`missing canonical test rule ${ruleId}`);
  return rule;
}

const SHORT_PASSIVE_RULES: readonly ProductionRule[] = [
  canonicalRule("sentence.declarative"),
  canonicalRule("clause.bei"),
  canonicalRule("phrase.passive.short"),
  canonicalRule("argument.subject.noun"),
  canonicalRule("phrase.noun.bare"),
  canonicalRule("phrase.nominal-head.noun"),
  canonicalRule("predicate.verb.lexical"),
];

const RICE_ENTRY = entry("entry:rice", "飯");
const BEI_ENTRY = entry("entry:bei", "被");
const EAT_ENTRY = entry("entry:eat", "吃");

function shortPassivePlan() {
  return createSentenceConstructionPracticePlan(
    SHORT_PASSIVE_CONSTRUCTION_VIEW,
    { sentenceRuleId: "sentence.declarative", constituentKey: "clause" },
    SHORT_PASSIVE_RULES,
  );
}

function selectWith(predicateProfile: RuntimeSyntaxProfile) {
  return selectFormalSyntaxUtterance({
    entries: [RICE_ENTRY, BEI_ENTRY, EAT_ENTRY],
    bindingEvidence: [],
    mode: "guided",
    layoutId: "standard",
    history: HISTORY,
    policy: FREQUENCY_FIRST_UTTERANCE_POLICY,
    profiles: [
      profile("profile:rice", RICE_ENTRY.id, "NOUN", { valencyFrames: ["avalent"] }),
      profile("profile:bei", BEI_ENTRY.id, "AUX", {
        valencyFrames: ["avalent"],
        dependencyRelationCounts: { "aux:pass": 1 },
      }),
      predicateProfile,
    ],
    random: STABLE_RANDOM,
    formalSyntaxComposition: shortPassivePlan(),
  });
}

describe("formal syntax short-passive construction selection", () => {
  it("routes the reviewed short-passive plan through the production selector", () => {
    const selection = selectWith(profile("profile:eat", EAT_ENTRY.id, "VERB", {
      occurrenceCapability: true,
    }));

    expect(selection.utterance).toMatchObject({
      kind: "formal-syntax",
      text: "飯被吃",
      syntaxRootRuleId: "sentence.declarative",
      entries: [RICE_ENTRY, BEI_ENTRY, EAT_ENTRY],
    });
    expect(selection.score.frequencyBase).toBeGreaterThan(0);
    expect(selection.score.transitionBoost).toBe(1);
    expect(selection.score.transitionTrace).toEqual([]);
    expect(selection.slotSelections).toEqual([]);
    expect(selection.templateCandidates).toEqual([]);
  });

  it("fails closed on legacy transitive evidence without the reviewed short-passive capability", () => {
    expect(() => selectWith(profile("profile:eat", EAT_ENTRY.id, "VERB", {
      valencyFrames: ["transitive"],
    }))).toThrow(/no grammar-valid utterance candidate/u);
  });
});
