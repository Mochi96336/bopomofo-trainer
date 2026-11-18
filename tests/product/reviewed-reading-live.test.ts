import { describe, expect, it } from "vitest";
import { COMMONNESS_TIER_THRESHOLDS, PRACTICE_CATALOG, SYNTAX_PROFILES } from "../../src/app/generated/catalog.js";
import { COMMONNESS_TIERS } from "../../src/commonness/tiers.js";
import { catalogsForCommonnessTiers } from "../../src/product/commonness-access.js";
import { createFreshProgressForEnvironment, createProductEnvironment, createProductState } from "../../src/product/session.js";
import { PRODUCT_READING_POLICY } from "../../src/readings/product-reading-policy.js";

const wholeCatalogs = { practice: PRACTICE_CATALOG, syntaxProfiles: SYNTAX_PROFILES };
const gates = [PRODUCT_READING_POLICY.readingEligibility, PRODUCT_READING_POLICY.preDrawReadingEligibility,
  PRODUCT_READING_POLICY.finalCandidateReadingEligibility,
  PRODUCT_READING_POLICY.subsequentFinalCandidateReadingEligibility,
  ...PRODUCT_READING_POLICY.additionalFinalCandidateReadingEligibilities];

function assertRoundReadings(state: ReturnType<typeof createProductState>,
  profiles: ReadonlyMap<string, typeof SYNTAX_PROFILES[number]>): void {
  const candidate = state.round.selection.utterance;
  expect(candidate.syntaxProfileIds).toHaveLength(candidate.entries.length);
  for (let at = 0; at < candidate.entries.length; at += 1) {
    const profile = profiles.get(candidate.syntaxProfileIds![at]!);
    expect(profile).toBeDefined();
    for (const gate of gates) {
      expect(gate(candidate.entries[at]!, profile!, null, candidate.entries[at - 1] ?? null),
        `unlicensed entry ${candidate.entries[at]!.id}`).toBe(true);
    }
  }
  expect(state.round.selection.score.entryIds).toEqual(state.round.exercise.entries.map(entry => entry.id));
}

describe("production reviewed readings under selection v2", () => {
  it("keeps all reading licenses and deterministic output across fresh-user seeds", () => {
    const environment = createProductEnvironment(wholeCatalogs);
    const profiles = new Map(environment.catalogs.syntaxProfiles.map(p => [p.id, p]));
    for (let index = 0; index < 64; index += 1) {
      const progress = createFreshProgressForEnvironment(environment, `reading-live-${index}`, "guided", "standard");
      const actual = createProductState(environment, progress, 0);
      assertRoundReadings(actual, profiles);
      expect(actual.progress).toBe(progress);
      if (index < 4) expect(createProductState(environment, progress, 0).round.selection).toEqual(actual.round.selection);
    }
  }, 30_000);

  it.each([...COMMONNESS_TIERS])("generates licensed rounds in filtered tier %i", tier => {
    const narrowed = catalogsForCommonnessTiers(wholeCatalogs, COMMONNESS_TIER_THRESHOLDS, [tier]);
    const environment = createProductEnvironment(narrowed);
    const profiles = new Map(environment.catalogs.syntaxProfiles.map(p => [p.id, p]));
    for (let index = 0; index < 24; index += 1) {
      const progress = createFreshProgressForEnvironment(environment, `reading-tier-${tier}:${index}`,
        index % 2 === 0 ? "guided" : "recall", "standard");
      assertRoundReadings(createProductState(environment, progress, 0), profiles);
    }
  }, 30_000);
});
