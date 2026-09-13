import { describe, expect, it } from "vitest";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import type { CatalogEntry } from "../../src/core/model.js";
import { composeFormalSyntaxUtterances } from "../../src/curriculum/formal-syntax-utterance.js";
import { FORMAL_SYNTAX_RULES } from "../../src/syntax/grammar.js";
import {
  BA_PATIENT_CASE_SAME_OCCURRENCE_CAPABILITY,
  PREVERBAL_AUXILIARY_SAME_OCCURRENCE_CAPABILITY,
} from "../../src/syntax/runtime-occurrence-capabilities.js";
import type { NestedProductionTarget } from "../../src/syntax/sample.js";
import type { ProductionRule, RuntimeSyntaxProfile, ValencyFrame } from "../../src/syntax/types.js";

const STABLE_RANDOM = { next: () => 0 };

type BaPredicateRuleId =
  | "ba-predicate.attested"
  | "ba-predicate.completed.complement"
  | "ba-predicate.completed.aspect";
type CompletionKind = "none" | "directional" | "aspect";

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
    readonly preverbalAuxCapability?: boolean;
    readonly dependencyRelationCounts?: RuntimeSyntaxProfile["dependencyEvidence"]["dependencyRelationCounts"];
  } = {},
): RuntimeSyntaxProfile {
  const occurrenceCapabilities = [
    ...(options.baCapability ? [BA_PATIENT_CASE_SAME_OCCURRENCE_CAPABILITY] : []),
    ...(options.preverbalAuxCapability ? [PREVERBAL_AUXILIARY_SAME_OCCURRENCE_CAPABILITY] : []),
  ];
  return {
    id,
    entryId,
    upos,
    functions: options.functions ?? [],
    valencyFrames: options.valencyFrames ?? [],
    ...(occurrenceCapabilities.length === 0 ? {} : { occurrenceCapabilities }),
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
  canonicalRule("predicate-marking.negation"),
  canonicalRule("predicate-marking.modal"),
  canonicalRule("argument.subject.noun"),
  canonicalRule("argument.disposal-patient.noun"),
  canonicalRule("phrase.noun.bare"),
  canonicalRule("phrase.nominal-head.noun"),
  canonicalRule("ba-predicate.attested"),
  canonicalRule("ba-predicate.completed.complement"),
  canonicalRule("ba-predicate.completed.aspect"),
  canonicalRule("complement.directional"),
];

function composeBa(options: {
  readonly predicateText: string;
  readonly valencyFrames?: readonly ValencyFrame[];
  readonly baCapability?: boolean;
  readonly completion?: CompletionKind;
  readonly baPredicateRuleId?: BaPredicateRuleId;
  readonly withNegation?: boolean;
  readonly withModal?: boolean;
}) {
  const he = entry("entry:he", "他");
  const ba = entry(catalogEntryId("把", "ㄅㄚ3"), "把");
  const book = entry("entry:book", "書");
  const predicateEntry = entry("entry:predicate", options.predicateText);
  const completion = options.completion ?? "none";

  const entries: CatalogEntry[] = [he, ba, book, predicateEntry];
  const profiles: RuntimeSyntaxProfile[] = [
    profile("profile:he", he.id, "NOUN"),
    profile("profile:ba", ba.id, "ADP", {
      functions: ["adposition"],
      dependencyRelationCounts: { case: 1 },
    }),
    profile("profile:book", book.id, "NOUN"),
    profile("profile:predicate", predicateEntry.id, "VERB", {
      functions: ["predicate"],
      ...(options.valencyFrames === undefined ? {} : { valencyFrames: options.valencyFrames }),
      ...(options.baCapability === undefined ? {} : { baCapability: options.baCapability }),
    }),
  ];

  if (options.withNegation) {
    const negation = entry(catalogEntryId("沒", "ㄇㄟ2"), "沒");
    entries.push(negation);
    profiles.push(profile("profile:negation", negation.id, "ADV", {
      dependencyRelationCounts: { advmod: 1 },
    }));
  }
  if (options.withModal) {
    const modal = entry("entry:can", "能");
    entries.push(modal);
    profiles.push(profile("profile:can", modal.id, "AUX", {
      functions: ["auxiliary"],
      preverbalAuxCapability: true,
      dependencyRelationCounts: { aux: 1 },
    }));
  }
  if (completion === "directional") {
    const direction = entry("entry:direction", "來");
    entries.push(direction);
    profiles.push(profile("profile:direction", direction.id, "VERB", {
      dependencyRelationCounts: { "compound:dir": 1 },
    }));
  }
  if (completion === "aspect") {
    const aspect = entry(catalogEntryId("了", "ㄌㄜ5"), "了");
    entries.push(aspect);
    profiles.push(profile("profile:aspect", aspect.id, "AUX", {
      dependencyRelationCounts: { aux: 1 },
    }));
  }

  const nestedProductionTargets: NestedProductionTarget[] = [{
    parentRuleId: "sentence.declarative",
    constituentKey: "clause",
    childRuleId: "clause.ba",
  }];
  if (options.withNegation) {
    nestedProductionTargets.push({
      parentRuleId: "clause.ba",
      constituentKey: "negation",
      exactCount: 1,
    });
  }
  if (options.withModal) {
    nestedProductionTargets.push({
      parentRuleId: "clause.ba",
      constituentKey: "modal",
      exactCount: 1,
    });
  }
  if (options.baPredicateRuleId !== undefined) {
    nestedProductionTargets.push({
      parentRuleId: "clause.ba",
      constituentKey: "predicate",
      childRuleId: options.baPredicateRuleId,
    });
  }
  if (options.baPredicateRuleId === "ba-predicate.completed.complement") {
    nestedProductionTargets.push({
      parentRuleId: "ba-predicate.completed.complement",
      constituentKey: "complement",
      childRuleId: "complement.directional",
    });
  }

  return composeFormalSyntaxUtterances({
    eligibleEntries: entries,
    profiles,
    rules: BA_RULES,
    samplingMode: "raw",
    structuralTarget: {
      rootProductionRuleId: "sentence.declarative",
      nestedProductionTargets,
    },
    random: STABLE_RANDOM,
    maximumCandidates: 1,
    maximumAttempts: 1,
  });
}

function expectOneOf(result: ReturnType<typeof composeBa>, texts: readonly string[]): void {
  expect(result.candidates).toHaveLength(1);
  const candidate = result.candidates[0]!;
  expect(candidate.syntaxRootRuleId).toBe("sentence.declarative");
  // Subject and DisposalPatient remain syntax-only nominal slots; semantic
  // plausibility must not decide which noun fills which role.
  expect(texts).toContain(candidate.text);
}

describe("canonical BA composition", () => {
  it("routes BA marking before the disposal phrase and keeps BAPredicate post-patient", () => {
    const clause = canonicalRule("clause.ba");
    expect(clause.constituents.map((item) => [item.key, item.category])).toEqual([
      ["subject", "Subject"],
      ["negation", "PredicateNegationMarking"],
      ["modal", "PredicateModalMarking"],
      ["marker", "Lexeme"],
      ["patient", "DisposalPatient"],
      ["predicate", "BAPredicate"],
    ]);
    expect(clause.constituents.find((item) => item.key === "predicate")
      ?.requiredOccurrenceCapabilities ?? []).toEqual([]);

    const attested = canonicalRule("ba-predicate.attested");
    expect(attested.constituents.find((item) => item.key === "head")).toMatchObject({
      category: "Lexeme",
      allowedUpos: ["VERB"],
      requiredOccurrenceCapabilities: [BA_PATIENT_CASE_SAME_OCCURRENCE_CAPABILITY],
    });
    expect(attested.constituents.some((item) => item.key === "negation" || item.key === "modal"))
      .toBe(false);

    for (const ruleId of [
      "ba-predicate.completed.complement",
      "ba-predicate.completed.aspect",
    ]) {
      const completed = canonicalRule(ruleId);
      expect(completed.constituents.some((item) => item.key === "negation" || item.key === "modal"))
        .toBe(false);
    }

    const completed = canonicalRule("ba-predicate.completed.complement");
    const head = completed.constituents.find((item) => item.key === "head");
    expect(head?.requiredValencyFrames).toEqual([
      "transitive",
      "ditransitive",
      "ambitransitive",
    ]);
    expect(completed.constituents.find((item) => item.key === "complement")?.minimum).toBe(1);
  });

  it("keeps same-occurrence BA evidence as the reviewed lexical-head compatibility route", () => {
    const result = composeBa({
      predicateText: "丟掉",
      baCapability: true,
      baPredicateRuleId: "ba-predicate.attested",
    });

    expectOneOf(result, ["他把書丟掉", "書把他丟掉"]);
  });

  it("generalizes an unseen patient-taking head when this derivation realizes a directional complement", () => {
    const result = composeBa({
      predicateText: "拿",
      valencyFrames: ["transitive"],
      completion: "directional",
      baPredicateRuleId: "ba-predicate.completed.complement",
    });

    expectOneOf(result, ["他把書拿來", "書把他拿來"]);
  });

  it("places negation and modality before the BA marker while preserving productive completion", () => {
    const result = composeBa({
      predicateText: "拿",
      valencyFrames: ["transitive"],
      completion: "directional",
      baPredicateRuleId: "ba-predicate.completed.complement",
      withNegation: true,
      withModal: true,
    });

    expectOneOf(result, ["他沒能把書拿來", "書沒能把他拿來"]);
    expect(result.candidates[0]!.text).not.toMatch(/把[^把]*沒/u);
    expect(result.candidates[0]!.text).not.toMatch(/把[^把]*能/u);
  });

  it("generalizes an unseen patient-taking head when this derivation realizes overt aspect", () => {
    const result = composeBa({
      predicateText: "看",
      valencyFrames: ["transitive"],
      completion: "aspect",
      baPredicateRuleId: "ba-predicate.completed.aspect",
    });

    expectOneOf(result, ["他把書看了", "書把他看了"]);
  });

  it("rejects an unseen patient-taking bare predicate with no completion", () => {
    const result = composeBa({
      predicateText: "拿",
      valencyFrames: ["transitive"],
    });

    expect(result.candidates).toEqual([]);
    expect(result.fallbackReasons).toContain("formal-syntax-structural-sampling-exhausted");
    expect(result.fallbackReasons).toContain("formal-syntax-no-candidate");
  });

  it("rejects a completed predicate whose lexical head is not patient-taking", () => {
    const result = composeBa({
      predicateText: "走",
      valencyFrames: ["intransitive"],
      completion: "directional",
      baPredicateRuleId: "ba-predicate.completed.complement",
    });

    expect(result.candidates).toEqual([]);
    expect(result.fallbackReasons).toContain("formal-syntax-structural-sampling-exhausted");
    expect(result.fallbackReasons).toContain("formal-syntax-no-candidate");
  });
});
