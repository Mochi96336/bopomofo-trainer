import { describe, expect, it } from "vitest";
import { enumerateStructuralDerivations } from "../../src/syntax/derive.js";
import {
  COMPLEMENT_PRODUCTION_RULES,
  FORMAL_SYNTAX_FIXTURES,
  FORMAL_SYNTAX_RULES,
} from "../../src/syntax/rules.js";
import { validateGrammarBundle } from "../../src/syntax/validate.js";

const SUBJECT_CONTROL = "clause.xcomp-subject-control";
const OBJECT_CONTROL = "clause.xcomp-object-control";

function rule(id: string) {
  const found = COMPLEMENT_PRODUCTION_RULES.find((item) => item.id === id);
  if (found === undefined) throw new Error(`missing test rule ${id}`);
  return found;
}

describe("Clause-model v2 xcomp control", () => {
  it("keeps ccomp on ContentClause but gives xcomp a subjectless OpenClause", () => {
    const ccomp = rule("clause.object-content");
    expect(ccomp.constituents.find((item) => item.key === "objectClause")?.category)
      .toBe("ContentClause");

    for (const id of [SUBJECT_CONTROL, OBJECT_CONTROL]) {
      const xcomp = rule(id);
      expect(xcomp.constituents.find((item) => item.key === "openClause")).toMatchObject({
        category: "OpenClause",
        minimum: 1,
        maximum: 1,
        recursive: true,
      });
      expect(xcomp.constituents.some((item) => item.category === "ContentClause")).toBe(false);
    }

    const openRules = COMPLEMENT_PRODUCTION_RULES.filter((item) => item.output === "OpenClause");
    expect(openRules.map((item) => item.id).sort()).toEqual([
      "open-clause.ditransitive",
      "open-clause.intransitive",
      "open-clause.transitive",
    ]);
    expect(openRules.every((item) =>
      item.constituents.every((constituent) => constituent.category !== "Subject")))
      .toBe(true);
  });

  it("makes the external controller an executable presence requirement", () => {
    for (const id of [SUBJECT_CONTROL, OBJECT_CONTROL]) {
      expect(rule(id).constraints).toContainEqual({
        kind: "requires-constituent",
        ifPresentKey: "openClause",
        targetKey: "controller",
      });
      expect(rule(id).constituents.find((item) => item.key === "controller")).toMatchObject({
        minimum: 0,
        maximum: 1,
      });
    }
    expect(validateGrammarBundle(FORMAL_SYNTAX_RULES, FORMAL_SYNTAX_FIXTURES).errors)
      .toEqual([]);
  });

  it("retires the two legacy pseudo-control Clause shapes", () => {
    const ids = new Set(FORMAL_SYNTAX_RULES.map((item) => item.id));
    expect(ids.has("clause.complement-content")).toBe(false);
    expect(ids.has("clause.pivotal")).toBe(false);
    expect(ids.has(SUBJECT_CONTROL)).toBe(true);
    expect(ids.has(OBJECT_CONTROL)).toBe(true);
  });

  it("budgets OpenClause as a nested clause rather than phrase recursion", () => {
    const keep = new Set([
      SUBJECT_CONTROL,
      "open-clause.intransitive",
      "argument.subject.noun",
      "predicate.verb.lexical",
      "phrase.noun.bare",
      "phrase.nominal-head.noun",
    ]);
    const rules = FORMAL_SYNTAX_RULES.filter((item) => keep.has(item.id));

    const blocked = [...enumerateStructuralDerivations({
      rootCategory: "Clause",
      rules,
      bounds: {
        maximumPhraseDepth: 4,
        maximumClauseNesting: 0,
        maximumClausesPerSentence: 4,
        maximumCoordinationItems: 3,
        maximumConsecutiveModifiers: 3,
        maximumComplementsPerPredicate: 2,
        maximumLexicalEntriesPerUtterance: 12,
      },
    })];
    expect(blocked).toEqual([]);

    const allowed = [...enumerateStructuralDerivations({
      rootCategory: "Clause",
      rules,
      bounds: {
        maximumPhraseDepth: 0,
        maximumClauseNesting: 1,
        maximumClausesPerSentence: 2,
        maximumCoordinationItems: 3,
        maximumConsecutiveModifiers: 3,
        maximumComplementsPerPredicate: 2,
        maximumLexicalEntriesPerUtterance: 12,
      },
    })];
    expect(allowed).toHaveLength(1);
    expect(allowed[0]?.clauseCount).toBe(2);
    expect(allowed[0]?.productionRulePath).toContain("open-clause.intransitive");
  });
});
