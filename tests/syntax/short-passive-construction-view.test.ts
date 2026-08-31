import { describe, expect, it } from "vitest";
import { createSentenceConstructionPracticePlan } from "../../src/curriculum/formal-syntax-construction-practice.js";
import {
  rulesForFormalSyntaxConstructionView,
} from "../../src/syntax/construction-view.js";
import { sampleStructuralDerivation } from "../../src/syntax/sample.js";
import { FORMAL_SYNTAX_RULES } from "../../src/syntax/grammar.js";
import { SHORT_PASSIVE_CONSTRUCTION_VIEW } from "../../src/syntax/passive-construction-view.js";
import { syntaxProfileMatchesRequirements } from "../../src/syntax/profile-match.js";
import { SHORT_PASSIVE_AUX_PASS_SAME_OCCURRENCE_CAPABILITY } from "../../src/syntax/runtime-occurrence-capabilities.js";
import type { ProductionRule, RuntimeSyntaxProfile } from "../../src/syntax/types.js";

const STABLE_RANDOM = { next: () => 0 };

function canonicalRule(ruleId: string): ProductionRule {
  const rule = FORMAL_SYNTAX_RULES.find((candidate) => candidate.id === ruleId);
  if (rule === undefined) throw new Error(`missing canonical test rule ${ruleId}`);
  return rule;
}

const SHORT_PASSIVE_PRACTICE_RULES: readonly ProductionRule[] = [
  canonicalRule("sentence.declarative"),
  canonicalRule("clause.bei"),
  canonicalRule("phrase.passive.short"),
  canonicalRule("phrase.passive.long"),
  canonicalRule("argument.subject.noun"),
  canonicalRule("argument.passive-agent.noun"),
  canonicalRule("phrase.noun.bare"),
  canonicalRule("phrase.nominal-head.noun"),
  canonicalRule("predicate.verb.lexical"),
];

function verbalProfile(
  id: string,
  options: {
    readonly valencyFrames?: RuntimeSyntaxProfile["valencyFrames"];
    readonly occurrenceCapability?: boolean;
  } = {},
): RuntimeSyntaxProfile {
  return {
    id,
    entryId: `entry:${id}`,
    upos: "VERB",
    functions: [],
    valencyFrames: options.valencyFrames ?? [],
    ...(options.occurrenceCapability
      ? { occurrenceCapabilities: [SHORT_PASSIVE_AUX_PASS_SAME_OCCURRENCE_CAPABILITY] }
      : {}),
    dependencyEvidence: {
      dependencyRelationCounts: {},
      surfacePositionCounts: {},
    },
    provenanceIds: ["test"],
  };
}

function shortPassivePlan() {
  return createSentenceConstructionPracticePlan(
    SHORT_PASSIVE_CONSTRUCTION_VIEW,
    { sentenceRuleId: "sentence.declarative", constituentKey: "clause" },
    SHORT_PASSIVE_PRACTICE_RULES,
  );
}

function shortPassivePredicateSlot() {
  const plan = shortPassivePlan();
  const shape = sampleStructuralDerivation({
    rootCategory: "Sentence",
    rules: plan.rules,
    random: STABLE_RANDOM,
    maximumAttempts: 1,
    ...plan.structuralTarget,
  });
  expect(shape).not.toBeNull();
  expect(shape?.productionRulePath).toContain("clause.bei");
  expect(shape?.productionRulePath).toContain("phrase.passive.short");
  expect(shape?.productionRulePath).not.toContain("phrase.passive.long");
  const slot = shape?.lexicalSlots.find((candidate) =>
    candidate.allowedUpos.length === 1 && candidate.allowedUpos[0] === "VERB"
  );
  expect(slot).toBeDefined();
  return slot!;
}

describe("reviewed short-passive construction view", () => {
  it("keeps canonical clause.bei unchanged while deriving an authoritative short-passive gate", () => {
    const canonicalBei = canonicalRule("clause.bei");
    const canonicalPredicate = canonicalBei.constituents.find((item) => item.key === "predicate");
    expect(canonicalPredicate?.requiredValencyFrames).toEqual(["transitive", "ambitransitive"]);
    expect(canonicalPredicate?.requiredOccurrenceCapabilities).toBeUndefined();

    const plan = shortPassivePlan();
    const derivedBei = plan.rules.find((rule) => rule.id === "clause.bei");
    const derivedPredicate = derivedBei?.constituents.find((item) => item.key === "predicate");
    expect(derivedPredicate?.requiredValencyFrames).toEqual([]);
    expect(derivedPredicate?.requiredOccurrenceCapabilities).toEqual([
      SHORT_PASSIVE_AUX_PASS_SAME_OCCURRENCE_CAPABILITY,
    ]);
    expect(plan.rules.some((rule) => rule.id === "phrase.passive.long")).toBe(true);
  });

  it("fails closed if a caller tries to apply a structural construction view as rules only", () => {
    expect(() => rulesForFormalSyntaxConstructionView(
      SHORT_PASSIVE_CONSTRUCTION_VIEW,
      SHORT_PASSIVE_PRACTICE_RULES,
    )).toThrow(/use applyFormalSyntaxConstructionView/u);
  });

  it("translates the construction's short PassivePhrase requirement into an exact nested target", () => {
    const plan = shortPassivePlan();
    expect(plan.structuralTarget).toEqual({
      rootProductionRuleId: "sentence.declarative",
      nestedProductionTargets: [
        {
          parentRuleId: "sentence.declarative",
          constituentKey: "clause",
          childRuleId: "clause.bei",
        },
        {
          parentRuleId: "clause.bei",
          constituentKey: "passive",
          childRuleId: "phrase.passive.short",
        },
      ],
    });
  });

  it("reaches only the short passive shape and propagates the reviewed capability to the VERB head", () => {
    const slot = shortPassivePredicateSlot();
    expect(slot.requiredValencyFrames).toEqual([]);
    expect(slot.requiredOccurrenceCapabilities).toEqual([
      SHORT_PASSIVE_AUX_PASS_SAME_OCCURRENCE_CAPABILITY,
    ]);
  });

  it("accepts reviewed short-passive evidence without generic valency and rejects generic valency alone", () => {
    const slot = shortPassivePredicateSlot();
    expect(syntaxProfileMatchesRequirements(
      verbalProfile("reviewed", { occurrenceCapability: true }),
      slot,
    )).toBe(true);
    expect(syntaxProfileMatchesRequirements(
      verbalProfile("transitive-only", { valencyFrames: ["transitive"] }),
      slot,
    )).toBe(false);
  });

  it("fails closed when a construction structural requirement selects the wrong child category", () => {
    expect(() => createSentenceConstructionPracticePlan(
      {
        ...SHORT_PASSIVE_CONSTRUCTION_VIEW,
        structuralProductionRequirements: [{
          parentRuleId: "clause.bei",
          constituentKey: "passive",
          childRuleId: "predicate.verb.lexical",
        }],
      },
      { sentenceRuleId: "sentence.declarative", constituentKey: "clause" },
      SHORT_PASSIVE_PRACTICE_RULES,
    )).toThrow(/child category mismatch/u);
  });
});
