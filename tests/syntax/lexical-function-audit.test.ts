import { describe, expect, it } from "vitest";
import { SYNTAX_PROFILES } from "../../src/app/generated/catalog.js";
import { auditLexicalFunctionGating } from "../../src/syntax/lexical-function-audit.js";
import type { RuntimeSyntaxProfile } from "../../src/syntax/types.js";

function profile(
  entryId: string,
  upos: RuntimeSyntaxProfile["upos"],
  functions: RuntimeSyntaxProfile["functions"],
  valencyFrames: RuntimeSyntaxProfile["valencyFrames"],
): RuntimeSyntaxProfile {
  return {
    id: `${entryId}:${upos}:${functions.join("+")}:${valencyFrames.join("+")}`,
    entryId,
    upos,
    functions,
    valencyFrames,
    dependencyEvidence: {
      dependencyRelationCounts: {},
      surfacePositionCounts: {},
    },
    provenanceIds: ["test"],
  };
}

describe("lexical function gating audit", () => {
  it("deduplicates entries across profiles and reports role intersections", () => {
    const audit = auditLexicalFunctionGating([
      profile("noun:a", "NOUN", ["subject", "object"], ["avalent"]),
      profile("noun:a", "PROPN", ["subject"], ["avalent"]),
      profile("noun:b", "NOUN", ["oblique"], ["avalent"]),
      profile("verb:a", "VERB", ["complement"], ["transitive"]),
      profile("verb:b", "VERB", ["predicate"], ["transitive"]),
    ]);

    expect(audit.nominal).toEqual({
      entries: 2,
      observedSubject: 1,
      observedObject: 1,
      observedOblique: 1,
      subjectAndObject: 1,
      objectAndOblique: 0,
      subjectAndOblique: 0,
      withoutSubjectObservation: 1,
      withoutObjectObservation: 1,
      withoutObliqueObservation: 1,
    });
    expect(audit.verbal).toEqual({
      entries: 2,
      observedPredicate: 1,
      withoutPredicateObservation: 1,
      transitiveCapable: 2,
      transitiveCapableAndObservedPredicate: 1,
      transitiveCapableWithoutPredicateObservation: 1,
    });
  });

  it("reports the packaged profile audit for review", () => {
    const audit = auditLexicalFunctionGating(SYNTAX_PROFILES);
    throw new Error(`LEXICAL_FUNCTION_GATING_AUDIT ${JSON.stringify(audit)}`);
  });
});
