import { describe, expect, it } from "vitest";
import {
  PRACTICE_CATALOG,
  SYNTAX_PROFILES,
} from "../../src/app/generated/catalog.js";
import { CAUSATIVE_OCCURRENCE_CAPABILITY } from "../../scripts/causative-occurrence-source.js";
import { FORMAL_SYNTAX_RULES } from "../../src/syntax/grammar.js";
import {
  BA_PATIENT_CASE_SAME_OCCURRENCE_CAPABILITY,
  PREVERBAL_AUXILIARY_SAME_OCCURRENCE_CAPABILITY,
} from "../../src/syntax/runtime-occurrence-capabilities.js";

describe("packaged same-occurrence capabilities", () => {
  it("preserves the reviewed causative-ccomp boundary", () => {
    const textByEntryId = new Map(PRACTICE_CATALOG.map((entry) => [entry.id, entry.prompt.text]));
    const aggregate = SYNTAX_PROFILES.filter((profile) =>
      (profile.dependencyEvidence.morphologicalFeatureCounts?.["Voice=Cau"] ?? 0) > 0
        && profile.valencyFrames.includes("clausal-complement"),
    );
    const occurrenceBacked = SYNTAX_PROFILES.filter((profile) =>
      profile.occurrenceCapabilities?.includes(CAUSATIVE_OCCURRENCE_CAPABILITY) ?? false,
    );

    expect(new Set(aggregate.map((profile) => profile.entryId)).size).toBe(122);
    expect(new Set(occurrenceBacked.map((profile) => profile.entryId)).size).toBe(121);
    expect(occurrenceBacked.every((profile) => aggregate.includes(profile))).toBe(true);

    const occurrenceProfileIds = new Set(occurrenceBacked.map((profile) => profile.id));
    const aggregateOnlyTexts = aggregate
      .filter((profile) => !occurrenceProfileIds.has(profile.id))
      .map((profile) => textByEntryId.get(profile.entryId))
      .filter((text): text is string => text !== undefined)
      .sort((left, right) => left.localeCompare(right, "zh-Hant"));
    expect(aggregateOnlyTexts).toEqual(["阻止"]);
  });

  it("packages all 139 identity-safe reviewed BA profiles", () => {
    const occurrenceBacked = SYNTAX_PROFILES.filter((profile) =>
      profile.occurrenceCapabilities?.includes(BA_PATIENT_CASE_SAME_OCCURRENCE_CAPABILITY) ?? false,
    );

    expect(occurrenceBacked).toHaveLength(139);
    expect(new Set(occurrenceBacked.map((profile) => profile.entryId)).size).toBe(139);
  });

  it("packages the 22 identity-safe preverbal auxiliary profiles without aspect exceptions", () => {
    const textByEntryId = new Map(PRACTICE_CATALOG.map((entry) => [entry.id, entry.prompt.text]));
    const occurrenceBacked = SYNTAX_PROFILES.filter((profile) =>
      profile.occurrenceCapabilities?.includes(
        PREVERBAL_AUXILIARY_SAME_OCCURRENCE_CAPABILITY,
      ) ?? false,
    );

    expect(occurrenceBacked).toHaveLength(22);
    expect(new Set(occurrenceBacked.map((profile) => profile.entryId)).size).toBe(22);
    expect(occurrenceBacked.every((profile) =>
      profile.upos === "AUX" && profile.functions.includes("auxiliary"),
    )).toBe(true);

    const texts = occurrenceBacked
      .map((profile) => textByEntryId.get(profile.entryId))
      .filter((text): text is string => text !== undefined);
    expect(texts).toContain("可以");
    expect(texts).toContain("能");
    expect(texts).toContain("可能");
    expect(texts).not.toContain("了");
    expect(texts).not.toContain("著");
  });

  it("uses preverbal auxiliary evidence only on the four reviewed modal consumers", () => {
    const consumers = FORMAL_SYNTAX_RULES.flatMap((rule) =>
      rule.constituents.filter((constituent) =>
        constituent.requiredOccurrenceCapabilities?.includes(
          PREVERBAL_AUXILIARY_SAME_OCCURRENCE_CAPABILITY,
        ) ?? false,
      ).map((constituent) => `${rule.id}:${constituent.key}`),
    );

    expect(consumers).toEqual([
      "phrase.verb.expanded:modal",
      "predicate.verb.expanded:modal",
      "predicate-marking.modal:modal",
      "clause.modal:modal",
    ]);

    const legacyModal = FORMAL_SYNTAX_RULES
      .find((rule) => rule.id === "phrase.verb.expanded")
      ?.constituents.find((constituent) => constituent.key === "modal");
    expect(legacyModal).toMatchObject({
      category: "Lexeme",
      allowedUpos: ["AUX"],
      minimum: 0,
      maximum: 2,
      requiredOccurrenceCapabilities: [PREVERBAL_AUXILIARY_SAME_OCCURRENCE_CAPABILITY],
    });

    const predicateModal = FORMAL_SYNTAX_RULES
      .find((rule) => rule.id === "predicate.verb.expanded")
      ?.constituents.find((constituent) => constituent.key === "modal");
    expect(predicateModal).toMatchObject({
      category: "Lexeme",
      allowedUpos: ["AUX"],
      minimum: 0,
      maximum: 2,
      requiredOccurrenceCapabilities: [PREVERBAL_AUXILIARY_SAME_OCCURRENCE_CAPABILITY],
    });

    const markingModal = FORMAL_SYNTAX_RULES
      .find((rule) => rule.id === "predicate-marking.modal")
      ?.constituents.find((constituent) => constituent.key === "modal");
    expect(markingModal).toMatchObject({
      category: "Lexeme",
      allowedUpos: ["AUX"],
      minimum: 1,
      maximum: 1,
      requiredFunctions: [],
      requiredOccurrenceCapabilities: [PREVERBAL_AUXILIARY_SAME_OCCURRENCE_CAPABILITY],
    });

    const baModal = FORMAL_SYNTAX_RULES
      .find((rule) => rule.id === "clause.ba")
      ?.constituents.find((constituent) => constituent.key === "modal");
    expect(baModal).toMatchObject({
      category: "PredicateModalMarking",
      minimum: 0,
      maximum: 2,
      requiredFunctions: ["predicate"],
    });
    expect(baModal?.requiredOccurrenceCapabilities ?? []).toEqual([]);

    const clauseModal = FORMAL_SYNTAX_RULES
      .find((rule) => rule.id === "clause.modal")
      ?.constituents.find((constituent) => constituent.key === "modal");
    expect(clauseModal).toMatchObject({
      category: "Lexeme",
      allowedUpos: ["AUX"],
      minimum: 1,
      maximum: 1,
      requiredFunctions: ["auxiliary"],
      requiredOccurrenceCapabilities: [PREVERBAL_AUXILIARY_SAME_OCCURRENCE_CAPABILITY],
    });

    const postDisposalModals = FORMAL_SYNTAX_RULES
      .filter((rule) => rule.id.startsWith("ba-predicate."))
      .flatMap((rule) => rule.constituents.filter((constituent) => constituent.key === "modal"));
    expect(postDisposalModals).toEqual([]);
  });

  it("uses reviewed BA occurrence evidence only on the attested BAPredicate head", () => {
    const consumers = FORMAL_SYNTAX_RULES.flatMap((rule) =>
      rule.constituents.filter((constituent) =>
        constituent.requiredOccurrenceCapabilities?.includes(
          BA_PATIENT_CASE_SAME_OCCURRENCE_CAPABILITY,
        ) ?? false,
      ).map((constituent) => `${rule.id}:${constituent.key}`),
    );

    expect(consumers).toEqual(["ba-predicate.attested:head"]);

    const clausePredicate = FORMAL_SYNTAX_RULES
      .find((rule) => rule.id === "clause.ba")
      ?.constituents.find((constituent) => constituent.key === "predicate");
    expect(clausePredicate).toMatchObject({
      category: "BAPredicate",
      requiredValencyFrames: [],
    });
    expect(clausePredicate?.requiredOccurrenceCapabilities ?? []).toEqual([]);

    const attestedHead = FORMAL_SYNTAX_RULES
      .find((rule) => rule.id === "ba-predicate.attested")
      ?.constituents.find((constituent) => constituent.key === "head");
    expect(attestedHead).toMatchObject({
      category: "Lexeme",
      allowedUpos: ["VERB"],
      requiredFunctions: [],
      requiredOccurrenceCapabilities: [BA_PATIENT_CASE_SAME_OCCURRENCE_CAPABILITY],
    });
  });
});
