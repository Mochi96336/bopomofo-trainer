import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PRACTICE_CATALOG, SYNTAX_PROFILES } from "../../src/app/generated/catalog.js";
import { parseCsv } from "../../src/catalog/csv.js";
import { catalogEntryFrequencyWeight } from "../../src/commonness/catalog-projection.js";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import { composeFormalSyntaxUtterances, prepareFormalSyntaxLexicon } from "../../src/curriculum/formal-syntax-utterance.js";
import { createSeededRandom } from "../../src/curriculum/random.js";
import { PRODUCT_READING_POLICY, productReadingEligibleWithoutPreviousEntry } from "../../src/readings/product-reading-policy.js";

const hanId = catalogEntryId("和", "ㄏㄢ4");
const heId = catalogEntryId("和", "ㄏㄜ2");

describe("source-backed 和 hàn catalog supplement", () => {
  it("ships the MOE reading alongside all five earlier identities with shared written-form frequency", () => {
    const readings = ["ㄏㄢ4", "ㄏㄜ2", "ㄏㄜ4", "ㄏㄨ2", "ㄏㄨㄛ2", "ㄏㄨㄛ4"];
    const entries = readings.map(reading => PRACTICE_CATALOG.find(e => e.id === catalogEntryId("和", reading))!);
    expect(entries.every(e => e !== undefined)).toBe(true);
    for (const entry of entries) {
      expect(entry.commonnessBase).toEqual(entries[0]!.commonnessBase);
      expect(catalogEntryFrequencyWeight(entry)).toBe(catalogEntryFrequencyWeight(entries[0]!));
    }
    // Browser encoding omits provenance; inspect the authoritative reviewed row.
    const rows = parseCsv(readFileSync(new URL("../../data/source/words.sample.csv", import.meta.url), "utf8")).records;
    const sourceRow = rows.find(r => r.values.text === "和" && r.values.reading === "ㄏㄢ4")!;
    expect(sourceRow.values.provenance_ids?.split(";")).toEqual(expect.arrayContaining([
      "moe:concised-dictionary", "moe:revised-dictionary",
    ]));
    const evidence = JSON.parse(readFileSync(new URL("../../data/readings/moe-han-reading-source-evidence.json", import.meta.url), "utf8"));
    const row = evidence.rows.find((r: { entryId: string }) => r.entryId === hanId);
    expect(row.matchStatus).toBe("paired-sources-awaiting-sense-review");
    expect(row.sourceRows.map((r: { sourceKind: string; sourceEntryId: string; sourcePhysicalRow: number }) =>
      [r.sourceKind, r.sourceEntryId, r.sourcePhysicalRow])).toEqual([
      ["moe-concised", "2771", 19426], ["moe-revised", "04883", 4889],
    ]);
  });

  it("retains every observed written-form profile while licensing only the hàn coordinator", () => {
    const han = PRACTICE_CATALOG.find(e => e.id === hanId)!;
    const he = PRACTICE_CATALOG.find(e => e.id === heId)!;
    const hanProfiles = SYNTAX_PROFILES.filter(p => p.entryId === hanId);
    const heProfiles = SYNTAX_PROFILES.filter(p => p.entryId === heId);
    expect(hanProfiles.map(p => p.upos).sort()).toEqual(["ADP", "CCONJ", "NOUN", "PROPN"]);
    for (const profile of hanProfiles) {
      const oldProfile = heProfiles.find(p => p.upos === profile.upos)!;
      expect(profile.dependencyEvidence).toEqual(oldProfile.dependencyEvidence);
      expect(profile.functions).toEqual(oldProfile.functions);
      expect(profile.valencyFrames).toEqual(oldProfile.valencyFrames);
      expect(productReadingEligibleWithoutPreviousEntry(han, profile)).toBe(profile.upos === "CCONJ");
    }
    const coordinator = hanProfiles.find(p => p.upos === "CCONJ")!;
    expect(coordinator.functions).toContain("coordinator");
    // Shipped profiles compact source counts to positive-presence evidence.
    expect(coordinator.dependencyEvidence.dependencyRelationCounts).toEqual({ cc: 1 });
    // The corpus's mixed ADP profile has cc evidence too; that alone is insufficient.
    expect(hanProfiles.find(p => p.upos === "ADP")!.dependencyEvidence.dependencyRelationCounts).toEqual({ case: 1, cc: 1 });
    for (const profile of heProfiles.filter(p => p.upos === "ADP" || p.upos === "CCONJ")) {
      expect(productReadingEligibleWithoutPreviousEntry(he, profile)).toBe(true);
    }
  });

  it("selects the added coordinator through the actual ordered product policy", () => {
    const lexicon = prepareFormalSyntaxLexicon(PRACTICE_CATALOG, SYNTAX_PROFILES);
    // A bounded, deliberately biased availability probe is not pronunciation gold.
    for (let probe = 0; probe < 20; probe += 1) {
      const result = composeFormalSyntaxUtterances({
        eligibleEntries: PRACTICE_CATALOG, profiles: SYNTAX_PROFILES,
        random: createSeededRandom("polyphonic-targeted-v1:" + hanId + ":" + probe),
        samplingMode: "product-family", minimumLexicalEntries: 2, maximumCandidates: 1, maximumAttempts: 32,
        bounds: { maximumPhraseDepth: 3, maximumClauseNesting: 1, maximumClausesPerSentence: 2,
          maximumCoordinationItems: 2, maximumConsecutiveModifiers: 2, maximumComplementsPerPredicate: 1,
          maximumLexicalEntriesPerUtterance: 6 },
        ...PRODUCT_READING_POLICY,
        entryWeight: e => e.id === hanId ? 100_000_000 : catalogEntryFrequencyWeight(e),
      }, lexicon);
      const candidate = result.candidates[0];
      const slot = candidate?.entries.findIndex(e => e.id === hanId) ?? -1;
      if (candidate === undefined || slot < 0) continue;
      const profile = SYNTAX_PROFILES.find(p => p.id === candidate.syntaxProfileIds?.[slot]);
      expect(profile).toMatchObject({ entryId: hanId, upos: "CCONJ", functions: ["coordinator"] });
      expect(profile!.dependencyEvidence.dependencyRelationCounts.cc).toBeGreaterThan(0);
      expect(slot).toBeGreaterThan(0);
      expect(slot).toBeLessThan(candidate.entries.length - 1);
      return;
    }
    throw new Error("hàn coordinator was not selected in 20 bounded targeted probes");
  });
});
