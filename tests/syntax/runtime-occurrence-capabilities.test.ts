import { describe, expect, it } from "vitest";
import {
  PRACTICE_CATALOG,
  SYNTAX_PROFILES,
} from "../../src/app/generated/catalog.js";
import { CAUSATIVE_OCCURRENCE_CAPABILITY } from "../../scripts/causative-occurrence-source.js";

describe("packaged same-occurrence causative-ccomp capability", () => {
  it("narrows the reviewed aggregate intersection from 122 to 121 and excludes only 阻止", () => {
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
});
