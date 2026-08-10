import { describe, expect, it } from "vitest";
import { COMPLEMENT_PRODUCTION_RULES } from "../../src/syntax/rules.js";
import { syntaxProfileMatchesRequirements } from "../../src/syntax/profile-match.js";
import {
  VALENCY_FRAMES,
  type RuntimeSyntaxProfile,
  type ValencyFrame,
} from "../../src/syntax/types.js";

function profile(frame: ValencyFrame): RuntimeSyntaxProfile {
  return {
    id: `profile:${frame}`,
    entryId: `entry:${frame}`,
    upos: "VERB",
    functions: [],
    valencyFrames: [frame],
    dependencyEvidence: {
      dependencyRelationCounts: {},
      surfacePositionCounts: {},
    },
    provenanceIds: ["test"],
  };
}

function predicate(ruleId: string) {
  const rule = COMPLEMENT_PRODUCTION_RULES.find((item) => item.id === ruleId);
  if (rule === undefined) throw new Error(`missing control rule ${ruleId}`);
  const constituent = rule.constituents.find((item) => item.key === "predicate");
  if (constituent === undefined) throw new Error(`missing predicate in ${ruleId}`);
  return constituent;
}

describe("xcomp controller-typed runtime gate", () => {
  it("does not let generic xcomp capability choose either controller shape", () => {
    const generic = profile("open-clausal-complement");
    expect(syntaxProfileMatchesRequirements(
      generic,
      predicate("clause.xcomp-subject-control"),
    )).toBe(false);
    expect(syntaxProfileMatchesRequirements(
      generic,
      predicate("clause.xcomp-object-control"),
    )).toBe(false);
  });

  it("keeps subject-control and object-control capabilities disjoint", () => {
    const subject = profile("subject-controlled-open-complement");
    const object = profile("object-controlled-open-complement");
    const subjectPredicate = predicate("clause.xcomp-subject-control");
    const objectPredicate = predicate("clause.xcomp-object-control");

    expect(syntaxProfileMatchesRequirements(subject, subjectPredicate)).toBe(true);
    expect(syntaxProfileMatchesRequirements(subject, objectPredicate)).toBe(false);
    expect(syntaxProfileMatchesRequirements(object, subjectPredicate)).toBe(false);
    expect(syntaxProfileMatchesRequirements(object, objectPredicate)).toBe(true);
  });

  it("appends controller frames without renumbering the compact catalog wire table", () => {
    expect(VALENCY_FRAMES.slice(0, 12)).toEqual([
      "avalent",
      "intransitive",
      "transitive",
      "ditransitive",
      "ambitransitive",
      "copular",
      "clausal-complement",
      "open-clausal-complement",
      "adpositional-complement",
      "serial-verb",
      "causative",
      "resultative",
    ]);
    expect(VALENCY_FRAMES.slice(12)).toEqual([
      "subject-controlled-open-complement",
      "object-controlled-open-complement",
    ]);
  });
});
