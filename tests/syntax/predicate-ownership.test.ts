import { describe, expect, it } from "vitest";
import { enumerateStructuralDerivations } from "../../src/syntax/derive.js";
import { FORMAL_SYNTAX_RULES } from "../../src/syntax/grammar.js";
import { PREDICATE_PRODUCTION_RULES } from "../../src/syntax/predicate-rules.js";
import { syntaxProfileMatchesRequirements } from "../../src/syntax/profile-match.js";
import type { RuntimeSyntaxProfile } from "../../src/syntax/types.js";

function rule(ruleId: string) {
  const found = FORMAL_SYNTAX_RULES.find((item) => item.id === ruleId);
  expect(found, ruleId).toBeDefined();
  return found!;
}

function verbalProfile(
  entryId: string,
  functions: RuntimeSyntaxProfile["functions"],
  valencyFrames: RuntimeSyntaxProfile["valencyFrames"],
): RuntimeSyntaxProfile {
  return {
    id: `profile:${entryId}`,
    entryId,
    upos: "VERB",
    functions,
    valencyFrames,
    dependencyEvidence: {
      dependencyRelationCounts: {},
      surfacePositionCounts: {},
    },
    provenanceIds: ["test"],
  };
}

function canonicalTransitiveSlots() {
  const keep = new Set([
    "clause.transitive",
    "predicate.verb.lexical",
    "phrase.noun.bare",
    "phrase.nominal-head.noun",
  ]);
  const shapes = [...enumerateStructuralDerivations({
    rootCategory: "Clause",
    rules: FORMAL_SYNTAX_RULES.filter((item) => keep.has(item.id)),
  })];
  expect(shapes).toHaveLength(1);
  return shapes[0]!.lexicalSlots;
}

describe("Clause-model v2 predicate argument ownership", () => {
  it("keeps the Predicate core free of nominal object constituents", () => {
    expect(PREDICATE_PRODUCTION_RULES.length).toBeGreaterThan(0);
    for (const predicateRule of PREDICATE_PRODUCTION_RULES) {
      expect(
        predicateRule.constituents.some((item) =>
          item.key === "object" || item.requiredFunctions.includes("object")
        ),
        predicateRule.id,
      ).toBe(false);
    }
  });

  it("routes already argument-owning Clause paths through Predicate", () => {
    const migrated = [
      "clause.intransitive",
      "clause.transitive",
      "clause.ditransitive",
      "clause.modal",
      "clause.negative",
      "clause.aspect",
      "clause.ba",
      "clause.bei",
      "clause.subject-omission",
      "clause.object-omission",
      "sentence.constituent-question",
    ] as const;

    for (const ruleId of migrated) {
      const predicate = rule(ruleId).constituents.find((item) => item.key === "predicate");
      expect(predicate?.category, ruleId).toBe("Predicate");
    }
  });

  it("leaves explicitly deferred legacy paths on VerbPhrase until their v2 rebuild", () => {
    expect(rule("clause.causative").constituents.find((item) => item.key === "predicate")?.category)
      .toBe("VerbPhrase");
    expect(rule("clause.pivotal").constituents.find((item) => item.key === "predicate")?.category)
      .toBe("VerbPhrase");
    expect(rule("clause.serial-verb").constituents.find((item) => item.key === "firstPredicate")?.category)
      .toBe("VerbPhrase");
    expect(rule("clause.topic-comment").constituents.find((item) => item.key === "comment")?.category)
      .toBe("VerbPhrase");
    expect(rule("sentence.constituent-subject-question").constituents.find((item) => item.key === "predicate")?.category)
      .toBe("VerbPhrase");
  });

  it("gives a canonical transitive core exactly one object-bearing lexical path", () => {
    const slots = canonicalTransitiveSlots();
    expect(slots.filter((slot) => slot.requiredFunctions.includes("subject"))).toHaveLength(1);
    expect(slots.filter((slot) => slot.requiredFunctions.includes("object"))).toHaveLength(1);

    const predicate = slots.find((slot) => slot.allowedUpos.includes("VERB"));
    expect(predicate).toMatchObject({
      allowedUpos: ["VERB"],
      requiredFunctions: [],
      requiredValencyFrames: ["ambitransitive", "transitive"],
    });
  });

  it("accepts transitive capability without requiring an observed root role", () => {
    const predicate = canonicalTransitiveSlots()
      .find((slot) => slot.allowedUpos.includes("VERB"));
    expect(predicate).toBeDefined();

    const transitiveNotRoot = verbalProfile(
      "entry:transitive-not-root",
      ["complement"],
      ["transitive"],
    );
    const intransitiveNotRoot = verbalProfile(
      "entry:intransitive-not-root",
      ["complement"],
      ["intransitive"],
    );

    expect(syntaxProfileMatchesRequirements(transitiveNotRoot, predicate!)).toBe(true);
    expect(syntaxProfileMatchesRequirements(intransitiveNotRoot, predicate!)).toBe(false);
  });
});
