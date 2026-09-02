import { describe, expect, it } from "vitest";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import type { CatalogEntry } from "../../src/core/model.js";
import { composeFormalSyntaxUtterances } from "../../src/curriculum/formal-syntax-utterance.js";
import { FORMAL_SYNTAX_RULES } from "../../src/syntax/grammar.js";
import { BA_PATIENT_CASE_SAME_OCCURRENCE_CAPABILITY } from "../../src/syntax/runtime-occurrence-capabilities.js";
import type { ProductionRule, RuntimeSyntaxProfile } from "../../src/syntax/types.js";

const STABLE_RANDOM = { next: () => 0 };

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
    readonly baCapability?: boolean;
    readonly dependencyRelationCounts?: RuntimeSyntaxProfile["dependencyEvidence"]["dependencyRelationCounts"];
  } = {},
): RuntimeSyntaxProfile {
  return {
    id,
    entryId,
    upos,
    functions: options.functions ?? [],
    valencyFrames: options.valencyFrames ?? [],
    ...(options.baCapability
      ? { occurrenceCapabilities: [BA_PATIENT_CASE_SAME_OCCURRENCE_CAPABILITY] }
      : {}),
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
];

function composeWithPredicate(predicate: RuntimeSyntaxProfile) {
  const he = entry("entry:he", "他");
  const ba = entry(catalogEntryId("把", "ㄅㄚ3"), "把");
  const book = entry("entry:book", "書");
  const discard = entry("entry:discard", "丟掉");

  return composeFormalSyntaxUtterances({
    eligibleEntries: [he, ba, book, discard],
    profiles: [
      profile("profile:he", he.id, "NOUN"),
      profile("profile:ba", ba.id, "ADP", {
        functions: ["adposition"],
        dependencyRelationCounts: { case: 1 },
      }),
      profile("profile:book", book.id, "NOUN"),
      predicate,
    ],
    rules: BA_RULES,
    samplingMode: "raw",
    structuralTarget: {
      rootProductionRuleId: "sentence.declarative",
      nestedProductionTargets: [{
        parentRuleId: "sentence.declarative",
        constituentKey: "clause",
        childRuleId: "clause.ba",
      }],
    },
    random: STABLE_RANDOM,
    maximumCandidates: 1,
    maximumAttempts: 1,
  });
}

describe("canonical BA composition", () => {
  it("realizes BA from explicit same-occurrence predicate evidence without generic transitive valency", () => {
    const result = composeWithPredicate(profile(
      "profile:discard",
      "entry:discard",
      "VERB",
      { functions: ["predicate"], baCapability: true },
    ));

    expect(result.candidates).toHaveLength(1);
    const candidate = result.candidates[0]!;
    expect(candidate.syntaxRootRuleId).toBe("sentence.declarative");
    // Subject and DisposalPatient are intentionally open nominal arguments; this
    // syntax-only fixture must not use world knowledge to decide which noun is
    // the agent or patient. Both surfaces prove the same canonical BA structure.
    expect(["他把書丟掉", "書把他丟掉"]).toContain(candidate.text);
  });

  it("rejects a generic transitive predicate when reviewed BA occurrence evidence is absent", () => {
    const result = composeWithPredicate(profile(
      "profile:discard",
      "entry:discard",
      "VERB",
      { functions: ["predicate"], valencyFrames: ["transitive"] },
    ));

    expect(result.candidates).toEqual([]);
    expect(result.fallbackReasons).toContain("formal-syntax-structural-sampling-exhausted");
    expect(result.fallbackReasons).toContain("formal-syntax-no-candidate");
  });
});
