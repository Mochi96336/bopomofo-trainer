import { describe, expect, it } from "vitest";
import { enumerateStructuralDerivations } from "../../src/syntax/derive.js";
import { FORMAL_SYNTAX_RULES } from "../../src/syntax/grammar.js";
import { syntaxProfileMatchesRequirements } from "../../src/syntax/profile-match.js";
import { BA_PATIENT_CASE_SAME_OCCURRENCE_CAPABILITY } from "../../src/syntax/runtime-occurrence-capabilities.js";
import type { RuntimeSyntaxProfile } from "../../src/syntax/types.js";

function baPredicateSlot() {
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
  const slot = shapes[0]!.lexicalSlots.find((candidate) =>
    candidate.allowedUpos.length === 1 && candidate.allowedUpos[0] === "VERB"
  );
  expect(slot).toBeDefined();
  return slot!;
}

function verbalProfile(
  id: string,
  options: Pick<RuntimeSyntaxProfile, "valencyFrames"> & {
    readonly occurrenceCapabilities?: RuntimeSyntaxProfile["occurrenceCapabilities"];
  },
): RuntimeSyntaxProfile {
  return {
    id,
    entryId: `entry:${id}`,
    upos: "VERB",
    functions: [],
    valencyFrames: options.valencyFrames,
    ...(options.occurrenceCapabilities === undefined
      ? {}
      : { occurrenceCapabilities: options.occurrenceCapabilities }),
    dependencyEvidence: {
      dependencyRelationCounts: {},
      surfacePositionCounts: {},
    },
    provenanceIds: ["test"],
  };
}

describe("canonical BA predicate evidence gate", () => {
  it("propagates only the reviewed BA occurrence capability to the lexical predicate head", () => {
    const slot = baPredicateSlot();
    expect(slot.requiredValencyFrames).toEqual([]);
    expect(slot.requiredOccurrenceCapabilities).toEqual([
      BA_PATIENT_CASE_SAME_OCCURRENCE_CAPABILITY,
    ]);
  });

  it("accepts reviewed BA evidence without a generic transitive or adpositional frame", () => {
    const slot = baPredicateSlot();
    const occurrenceBacked = verbalProfile("occurrence-backed", {
      valencyFrames: [],
      occurrenceCapabilities: [BA_PATIENT_CASE_SAME_OCCURRENCE_CAPABILITY],
    });
    expect(syntaxProfileMatchesRequirements(occurrenceBacked, slot)).toBe(true);
  });

  it("fails closed on generic valency without the reviewed BA occurrence capability", () => {
    const slot = baPredicateSlot();
    const transitiveOnly = verbalProfile("transitive-only", {
      valencyFrames: ["transitive", "adpositional-complement"],
    });
    expect(syntaxProfileMatchesRequirements(transitiveOnly, slot)).toBe(false);
  });
});
