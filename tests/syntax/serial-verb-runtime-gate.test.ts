import { describe, expect, it } from "vitest";
import { CLAUSE_PRODUCTION_RULES } from "../../src/syntax/rules.js";
import { syntaxProfileMatchesRequirements } from "../../src/syntax/profile-match.js";
import type { RuntimeSyntaxProfile, ValencyFrame } from "../../src/syntax/types.js";

function profile(frame: ValencyFrame): RuntimeSyntaxProfile {
  return {
    id: `profile:${frame}`,
    entryId: `entry:${frame}`,
    upos: "VERB",
    functions: ["predicate"],
    valencyFrames: [frame],
    dependencyEvidence: {
      dependencyRelationCounts: {},
      surfacePositionCounts: {},
    },
    provenanceIds: ["test"],
  };
}

function serialPredicates() {
  const rule = CLAUSE_PRODUCTION_RULES.find((item) => item.id === "clause.serial-verb");
  if (rule === undefined) throw new Error("missing clause.serial-verb");
  return ["firstPredicate", "secondPredicate"].map((key) => {
    const constituent = rule.constituents.find((item) => item.key === key);
    if (constituent === undefined) throw new Error(`missing ${key}`);
    return constituent;
  });
}

describe("serial-verb runtime gate", () => {
  it("requires dedicated serial-verb capability at both predicate positions", () => {
    for (const predicate of serialPredicates()) {
      expect(predicate.requiredValencyFrames).toEqual(["serial-verb"]);
    }
  });

  it("does not let ordinary verbal valency keep the serial construction alive", () => {
    for (const ordinaryFrame of ["intransitive", "transitive", "ambitransitive"] as const) {
      for (const predicate of serialPredicates()) {
        expect(syntaxProfileMatchesRequirements(profile(ordinaryFrame), predicate)).toBe(false);
      }
    }
  });

  it("would admit only an explicitly supported serial-verb profile", () => {
    for (const predicate of serialPredicates()) {
      expect(syntaxProfileMatchesRequirements(profile("serial-verb"), predicate)).toBe(true);
    }
  });
});
