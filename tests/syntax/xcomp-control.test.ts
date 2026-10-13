import { describe, expect, it } from "vitest";
import {
  COMPLEMENT_PRODUCTION_RULES,
  FORMAL_SYNTAX_FIXTURES,
  FORMAL_SYNTAX_RULES,
} from "../../src/syntax/rules.js";
import { validateGrammarBundle } from "../../src/syntax/validate.js";

describe("Clause-model v2 xcomp control retirement", () => {
  it("keeps ccomp finite and preserves subjectless OpenClause structure", () => {
    const ccomp = COMPLEMENT_PRODUCTION_RULES
      .find((item) => item.id === "clause.object-content");
    expect(ccomp?.constituents.find((item) => item.key === "objectClause")?.category)
      .toBe("ContentClause");

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

  it("retires controller-specific Clause rules instead of guessing from basic xcomp", () => {
    const ids = new Set(FORMAL_SYNTAX_RULES.map((item) => item.id));
    expect(ids.has("clause.xcomp-subject-control")).toBe(false);
    expect(ids.has("clause.xcomp-object-control")).toBe(false);
    expect(ids.has("clause.complement-content")).toBe(false);
    expect(ids.has("clause.pivotal")).toBe(false);
  });

  it("keeps the remaining grammar bundle executable", () => {
    expect(validateGrammarBundle(FORMAL_SYNTAX_RULES, FORMAL_SYNTAX_FIXTURES).errors)
      .toEqual([]);
  });
});
