import { describe, expect, it } from "vitest";
import { PRACTICE_CATALOG, SYNTAX_PROFILES, COMMONNESS_TIER_THRESHOLDS } from "../../src/app/generated/catalog.js";
import { COMMONNESS_TIERS } from "../../src/commonness/tiers.js";
import { catalogsForCommonnessTiers } from "../../src/product/commonness-access.js";
import { PRODUCT_READING_POLICY, productReadingEligibleWithoutPreviousEntry } from "../../src/readings/product-reading-policy.js";
import type { CatalogEntry } from "../../src/core/model.js";
import type { RuntimeSyntaxProfile } from "../../src/syntax/types.js";

/**
 * Newly executed current-catalog population inventory. Unlike the old
 * 128-delivery census, this enumerates the whole compiled lexicon and its
 * shipping reading gates before sampling; no sentences need to be sampled.
 *
 * It does NOT infer that a reading is correct in every sentence, nor that a
 * structurally permitted profile is reachable by the entire grammar. It
 * supplies a denominator for future word+reading-specific evidence projects.
 */
function profileEvidenceSignature(profile: RuntimeSyntaxProfile): string {
  return JSON.stringify({
    functions: profile.functions,
    valencyFrames: profile.valencyFrames,
    occurrenceCapabilities: profile.occurrenceCapabilities ?? [],
    dependencyEvidence: profile.dependencyEvidence,
    provenanceIds: profile.provenanceIds,
  });
}

function inspectPopulation(
  label: string,
  entries: readonly CatalogEntry[],
  profiles: readonly RuntimeSyntaxProfile[],
) {
  const entriesById = new Map(entries.map(entry => [entry.id, entry]));
  const groups = new Map<string, RuntimeSyntaxProfile[]>();
  for (const profile of profiles) {
    const entry = entriesById.get(profile.entryId);
    if (entry === undefined) continue;
    if (!productReadingEligibleWithoutPreviousEntry(entry, profile)) continue;
    const key = JSON.stringify([entry.prompt.text, profile.upos]);
    const row = groups.get(key) ?? [];
    row.push(profile);
    groups.set(key, row);
  }

  const problematic = [];
  for (const [key, candidates] of groups) {
    const distinctIds = [...new Set(candidates.map(profile => profile.entryId))].sort();
    if (distinctIds.length < 2) continue;
    const retained = PRODUCT_READING_POLICY.readingFrontierFilter(candidates, entriesById);
    // Distinguish approved alternate readings (e.g. 哪, 和) from abstained groups.
    if (retained.length !== 0) continue;
    const [writtenForm, upos] = JSON.parse(key) as [string,string];
    const sourceSignatures = new Map<string, string[]>();
    for (const profile of candidates) {
      const sig = profileEvidenceSignature(profile);
      const ids = sourceSignatures.get(sig) ?? [];
      ids.push(profile.entryId);
      sourceSignatures.set(sig, ids);
    }
    const functions = [...new Set(candidates.flatMap(profile => profile.functions))].sort();
    problematic.push({
      writtenForm, upos, readings: distinctIds.length,
      profileCount: candidates.length,
      sourceDistinguishesReading: sourceSignatures.size > 1,
      availableFunctions: functions,
      readingIds: distinctIds,
    });
  }

  const roles: Record<string, number> = {};
  const supportFunctions: Record<string, number> = {};
  const undistinguished = problematic.filter(group => !group.sourceDistinguishesReading);
  for (const group of problematic) {
    roles[group.upos] = (roles[group.upos] ?? 0) + 1;
    for (const fn of group.availableFunctions) {
      supportFunctions[fn] = (supportFunctions[fn] ?? 0) + 1;
    }
  }
  const classifierGroups = problematic.filter(group =>
    group.upos === "NOUN" && group.availableFunctions.includes("classifier"));
  return {
    scope: label,
    sourceEntries: entries.length,
    sourceProfiles: profiles.length,
    licensedWordRoleGroups: groups.size,
    blockedWordRoleGroups: problematic.length,
    blockedDistinctWords: new Set(problematic.map(g => g.writtenForm)).size,
    blockedReadingIdentities: new Set(problematic.flatMap(g => g.readingIds)).size,
    sourceEvidenceIdenticalAcrossReadings: undistinguished.length,
    sourceEvidenceDifferentAcrossReadings: problematic.length - undistinguished.length,
    byUpos: Object.fromEntries(Object.entries(roles).sort((a,b) => b[1] - a[1])),
    byAvailableFunction: Object.fromEntries(
      Object.entries(supportFunctions).sort((a,b) => b[1] - a[1]).slice(0, 22)),
    numericClassifierCandidateGroups: classifierGroups.length,
    numericClassifierExamples: classifierGroups.slice(0, 18).map(g => ({
      text:g.writtenForm, upos:g.upos, readings:g.readings
    })),
    examples: problematic.sort((a,b)=>a.writtenForm.localeCompare(b.writtenForm, "zh-Hant")).slice(0,15)
      .map(({writtenForm,upos,readings,sourceDistinguishesReading}) =>
        ({writtenForm,upos,readings,sourceDistinguishesReading})),
  };
}

describe("current production catalog: exhaustive unresolved same-word-role inventory", () => {
  it("measures every active reading collision, without hand-picking six words", () => {
    const full = { practice: PRACTICE_CATALOG, syntaxProfiles: SYNTAX_PROFILES };
    const scopes = [
      inspectPopulation("all", PRACTICE_CATALOG, SYNTAX_PROFILES),
      ...COMMONNESS_TIERS.map(tier => {
        const chosen = catalogsForCommonnessTiers(full, COMMONNESS_TIER_THRESHOLDS, [tier]);
        return inspectPopulation("tier"+tier, chosen.practice, chosen.syntaxProfiles);
      }),
    ];
    expect(scopes[0]!.sourceEntries).toBe(PRACTICE_CATALOG.length);
    expect(scopes[0]!.blockedWordRoleGroups).toBeGreaterThan(6);
    expect(scopes.every(s => s.blockedWordRoleGroups > 0)).toBe(true);
    console.log("CURRENT_POLYPHONE_FULL_POPULATION_JSON " + JSON.stringify(scopes));
  }, 120_000);
});
