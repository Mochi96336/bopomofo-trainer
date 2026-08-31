import { describe, expect, it } from "vitest";
import {
  PRACTICE_CATALOG,
  SYNTAX_PROFILES,
} from "../../src/app/generated/catalog.js";
import { CAUSATIVE_OCCURRENCE_CAPABILITY } from "../../scripts/causative-occurrence-source.js";
import { FORMAL_SYNTAX_RULES } from "../../src/syntax/grammar.js";
import {
  BA_PATIENT_CASE_SAME_OCCURRENCE_CAPABILITY,
  SHORT_PASSIVE_AUX_PASS_SAME_OCCURRENCE_CAPABILITY,
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

  it("packages all 248 identity-safe reviewed short-passive profiles", () => {
    const occurrenceBacked = SYNTAX_PROFILES.filter((profile) =>
      profile.occurrenceCapabilities?.includes(
        SHORT_PASSIVE_AUX_PASS_SAME_OCCURRENCE_CAPABILITY,
      ) ?? false,
    );

    expect(occurrenceBacked).toHaveLength(248);
    expect(new Set(occurrenceBacked.map((profile) => profile.entryId)).size).toBe(248);
    expect(occurrenceBacked.every((profile) => profile.upos === "VERB")).toBe(true);
  });

  it("does not make BA or short passive a grammar requirement in the packaging slice", () => {
    const consumers = FORMAL_SYNTAX_RULES.flatMap((rule) =>
      rule.constituents.filter((constituent) =>
        constituent.requiredOccurrenceCapabilities?.some((capability) =>
          capability === BA_PATIENT_CASE_SAME_OCCURRENCE_CAPABILITY
          || capability === SHORT_PASSIVE_AUX_PASS_SAME_OCCURRENCE_CAPABILITY,
        ) ?? false,
      ).map((constituent) => `${rule.id}:${constituent.key}`),
    );

    expect(consumers).toEqual([]);
  });
});
