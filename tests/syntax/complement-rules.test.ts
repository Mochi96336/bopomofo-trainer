import { describe, expect, it } from "vitest";
import { RETIRED_COMPLEMENT_RULE_V2_DECISIONS } from "../../src/syntax/complement-model-v2.js";
import {
  COMPLEMENT_PRODUCTION_RULES,
  FORMAL_SYNTAX_FIXTURES,
  FORMAL_SYNTAX_RULES,
} from "../../src/syntax/rules.js";
import { validateGrammarBundle } from "../../src/syntax/validate.js";

const REQUIRED = [
  "complement.directional",
  "complement.potential",
  "complement.degree",
  "complement.quantity",
  "complement.duration",
  "open-clause.intransitive",
  "open-clause.transitive",
  "open-clause.ditransitive",
  "clause.subject-content",
  "clause.object-content",
  "clause.xcomp-subject-control",
  "clause.xcomp-object-control",
  "relative.clause",
  "phrase.noun.relative",
  "phrase.noun.de-nominalization",
  "quoted.clause",
  "clause.quoted-content",
] as const;

describe("formal complement and embedded-clause inventory", () => {
  it("validates recursive complement rules in the complete bundle", () => {
    expect(validateGrammarBundle(FORMAL_SYNTAX_RULES, FORMAL_SYNTAX_FIXTURES).errors)
      .toEqual([]);
  });

  it("covers every required live complement and embedded-clause construction", () => {
    const ids = new Set(COMPLEMENT_PRODUCTION_RULES.map((rule) => rule.id));
    expect(REQUIRED.filter((id) => !ids.has(id))).toEqual([]);
    expect(ids.has("complement.result")).toBe(false);
  });

  it("keeps retired resultative provenance without an executable resultative requirement", () => {
    expect(RETIRED_COMPLEMENT_RULE_V2_DECISIONS["complement.result"]).toMatchObject({
      evidenceContract: "resultative-evidence-audit-v1",
      replacement: "compound:vv-or-reviewed-reconstruction:TBD",
    });
    expect(FORMAL_SYNTAX_RULES.flatMap((rule) =>
      rule.constituents.flatMap((item) => item.requiredValencyFrames)))
      .not.toContain("resultative");
  });

  it("marks every embedded return to clause-like categories as recursive", () => {
    const embedded = COMPLEMENT_PRODUCTION_RULES.flatMap((rule) =>
      rule.constituents.filter((item) =>
        item.category === "Clause" || item.category === "OpenClause"
        || item.category === "ContentClause" || item.category === "RelativeClause"
        || item.category === "QuotedClause"));
    expect(embedded.length).toBeGreaterThan(0);
    expect(embedded.every((item) => item.recursive)).toBe(true);
  });

  it("uses complementType features without lexical compatibility lists", () => {
    const serialized = JSON.stringify(COMPLEMENT_PRODUCTION_RULES);
    expect(serialized).toContain('"complementType"');
    expect(serialized).not.toContain('"text"');
    expect(serialized).not.toContain('"plausibility"');
  });
});