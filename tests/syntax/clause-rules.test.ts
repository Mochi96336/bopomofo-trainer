import { describe, expect, it } from "vitest";
import { enumerateStructuralDerivations } from "../../src/syntax/derive.js";
import {
  CLAUSE_PRODUCTION_RULES,
  FORMAL_SYNTAX_FIXTURES,
  FORMAL_SYNTAX_RULES,
} from "../../src/syntax/rules.js";
import { validateGrammarBundle } from "../../src/syntax/validate.js";

const REQUIRED_CONSTRUCTIONS = [
  "argument.subject.noun",
  "argument.object.noun",
  "argument.indirect-object.noun",
  "argument.disposal-patient.noun",
  "argument.passive-agent.noun",
  "phrase.passive.short",
  "phrase.passive.long",
  "clause.nominal-predicate",
  "clause.adjective-predicate",
  "clause.intransitive",
  "clause.transitive",
  "clause.ditransitive",
  "clause.copular",
  "clause.existential",
  "clause.locative",
  "clause.modal",
  "clause.negative",
  "clause.aspect",
  "clause.ba",
  "clause.bei",
  "clause.serial-verb",
  "clause.comparative",
  "clause.topic-comment",
  "clause.subject-omission",
  "clause.object-omission",
  "sentence.request",
  "sentence.exclamative",
  "sentence.polar-question",
  "sentence.a-not-a-question",
  "sentence.alternative-question",
  "sentence.constituent-question",
] as const;

describe("formal clause and question production inventory", () => {
  it("validates with the phrase grammar as one versioned bundle", () => {
    expect(validateGrammarBundle(FORMAL_SYNTAX_RULES, FORMAL_SYNTAX_FIXTURES).errors)
      .toEqual([]);
  });

  it("contains every required executable basic, special, omitted, and question construction", () => {
    const ids = new Set(CLAUSE_PRODUCTION_RULES.map((rule) => rule.id));
    expect(REQUIRED_CONSTRUCTIONS.filter((id) => !ids.has(id))).toEqual([]);
    expect(ids.has("clause.pivotal")).toBe(false);
    expect(ids.has("clause.causative")).toBe(false);
  });

  it("represents BA patient as a construction role instead of an ordinary object", () => {
    const ba = CLAUSE_PRODUCTION_RULES.find((rule) => rule.id === "clause.ba");
    expect(ba?.constituents.map((item) => [item.key, item.category])).toEqual([
      ["subject", "Subject"],
      ["marker", "Lexeme"],
      ["patient", "DisposalPatient"],
      ["predicate", "Predicate"],
    ]);
    expect(ba?.constituents.find((item) => item.key === "marker")).toMatchObject({
      allowedUpos: ["ADP"],
      requiredFeatures: { voice: "disposal" },
    });
  });

  it("keeps BA marker evidence hard without corpus-role gating the patient noun", () => {
    const keep = new Set([
      "clause.ba",
      "argument.subject.noun",
      "argument.disposal-patient.noun",
      "predicate.verb.lexical",
      "phrase.noun.bare",
      "phrase.nominal-head.noun",
    ]);
    const shapes = [...enumerateStructuralDerivations({
      rootCategory: "Clause",
      rules: FORMAL_SYNTAX_RULES.filter((rule) => keep.has(rule.id)),
    })];
    expect(shapes).toHaveLength(1);
    expect(shapes[0]!.productionRulePath).toContain("argument.disposal-patient.noun");

    const slots = shapes[0]!.lexicalSlots;
    expect(slots.some((slot) => slot.allowedUpos.includes("ADP")
      && slot.requiredFeatures.voice === "disposal")).toBe(true);
    const nominalSlots = slots.filter((slot) => slot.allowedUpos.includes("NOUN"));
    expect(nominalSlots).toHaveLength(2);
    expect(nominalSlots.every((slot) => slot.requiredFunctions.length === 0)).toBe(true);
  });

  it("separates short AUX passive from long ADP plus structural-agent passive", () => {
    const short = CLAUSE_PRODUCTION_RULES.find((rule) => rule.id === "phrase.passive.short");
    const long = CLAUSE_PRODUCTION_RULES.find((rule) => rule.id === "phrase.passive.long");
    const bei = CLAUSE_PRODUCTION_RULES.find((rule) => rule.id === "clause.bei");

    expect(short?.output).toBe("PassivePhrase");
    expect(short?.constituents).toHaveLength(1);
    expect(short?.constituents[0]).toMatchObject({
      key: "marker",
      allowedUpos: ["AUX"],
      requiredFeatures: { voice: "passive" },
    });

    expect(long?.output).toBe("PassivePhrase");
    expect(long?.constituents.find((item) => item.key === "marker")).toMatchObject({
      allowedUpos: ["ADP"],
      requiredFeatures: { voice: "passive" },
    });
    expect(long?.constituents.find((item) => item.key === "agent")).toMatchObject({
      category: "PassiveAgent",
      minimum: 1,
      maximum: 1,
      requiredFunctions: [],
    });

    expect(bei?.constituents.map((item) => [item.key, item.category])).toEqual([
      ["patient", "Subject"],
      ["passive", "PassivePhrase"],
      ["predicate", "Predicate"],
    ]);
  });

  it("has exactly two minimal passive shapes without marker-agent crossovers or oblique noun gates", () => {
    const keep = new Set([
      "clause.bei",
      "argument.subject.noun",
      "argument.passive-agent.noun",
      "phrase.passive.short",
      "phrase.passive.long",
      "predicate.verb.lexical",
      "phrase.noun.bare",
      "phrase.nominal-head.noun",
    ]);
    const shapes = [...enumerateStructuralDerivations({
      rootCategory: "Clause",
      rules: FORMAL_SYNTAX_RULES.filter((rule) => keep.has(rule.id)),
    })];

    expect(shapes).toHaveLength(2);
    const byVariant = new Map(shapes.map((shape) => [
      shape.productionRulePath.includes("phrase.passive.short") ? "short" : "long",
      shape,
    ]));

    const short = byVariant.get("short");
    expect(short).toBeDefined();
    expect(short?.lexicalSlots.some((slot) => slot.allowedUpos.includes("AUX")
      && slot.requiredFeatures.voice === "passive")).toBe(true);
    expect(short?.productionRulePath).not.toContain("argument.passive-agent.noun");

    const long = byVariant.get("long");
    expect(long).toBeDefined();
    expect(long?.lexicalSlots.some((slot) => slot.allowedUpos.includes("ADP")
      && slot.requiredFeatures.voice === "passive")).toBe(true);
    expect(long?.productionRulePath).toContain("argument.passive-agent.noun");
    const longNominals = long!.lexicalSlots.filter((slot) => slot.allowedUpos.includes("NOUN"));
    expect(longNominals).toHaveLength(2);
    expect(longNominals.every((slot) => slot.requiredFunctions.length === 0)).toBe(true);
  });

  it("does not keep sentence labels that have no executable structural distinction", () => {
    const rules = new Map(CLAUSE_PRODUCTION_RULES.map((rule) => [rule.id, rule]));
    expect(rules.has("sentence.imperative")).toBe(false);
    const exclamative = rules.get("sentence.exclamative");
    const interjection = exclamative?.constituents.find((item) => item.key === "interjection");
    expect(interjection?.minimum).toBe(1);
    expect(interjection?.maximum).toBe(1);
  });

  it("uses formal markers and valency rather than lexical text", () => {
    const serialized = JSON.stringify(CLAUSE_PRODUCTION_RULES);
    expect(serialized).not.toContain('"text"');
    expect(serialized).not.toContain('"meaning"');
    expect(serialized).toContain('"requiredValencyFrames"');
    expect(serialized).toContain('"questionType"');
  });

  it("keeps optional subject, object, particle, and punctuation cardinalities finite", () => {
    const optional = CLAUSE_PRODUCTION_RULES.flatMap((rule) =>
      rule.constituents.filter((item) => item.minimum === 0));
    expect(optional.length).toBeGreaterThan(0);
    expect(optional.every((item) => Number.isInteger(item.maximum) && item.maximum > 0))
      .toBe(true);
  });
});
