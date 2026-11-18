import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PRACTICE_CATALOG, SYNTAX_PROFILES } from "../../src/app/generated/catalog.js";
import { parseCsv } from "../../src/catalog/csv.js";
import { catalogEntryFrequencyWeight } from "../../src/commonness/catalog-projection.js";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import { composeFormalSyntaxUtterances, prepareFormalSyntaxLexicon } from "../../src/curriculum/formal-syntax-utterance.js";
import { createSeededRandom } from "../../src/curriculum/random.js";
import { PRODUCT_READING_POLICY } from "../../src/readings/product-reading-policy.js";

const fullToneId = catalogEntryId("便宜", "ㄆㄧㄢ2 ㄧ2");
const neutralToneId = catalogEntryId("便宜", "ㄆㄧㄢ2 ㄧ5");
const bianId = catalogEntryId("便宜", "ㄅㄧㄢ4 ㄧ2");

describe("source-backed 便宜 pián yí catalog supplement", () => {
  it("ships the Concised full-tone identity while retaining both earlier readings and frequency evidence", () => {
    const entries = [fullToneId, neutralToneId, bianId].map(id =>
      PRACTICE_CATALOG.find(entry => entry.id === id));
    expect(entries.every(entry => entry !== undefined)).toBe(true);
    expect(entries[0]!.commonnessBase).toEqual(entries[1]!.commonnessBase);
    expect(entries[0]!.commonnessBase).toEqual(entries[2]!.commonnessBase);
    expect(catalogEntryFrequencyWeight(entries[0]!)).toBe(catalogEntryFrequencyWeight(entries[1]!));

    const rows = parseCsv(readFileSync(new URL("../../data/source/words.sample.csv", import.meta.url), "utf8")).records;
    const sourceRow = rows.find(row => row.values.text === "便宜" && row.values.reading === "ㄆㄧㄢ2 ㄧ2")!;
    expect(sourceRow.values.provenance_ids?.split(";")).toContain("moe:concised-dictionary");

    const evidence = JSON.parse(readFileSync(
      new URL("../../data/readings/moe-pianyi-reading-source-evidence.json", import.meta.url), "utf8",
    ));
    const fullTone = evidence.rows.find((row: { entryId: string }) => row.entryId === fullToneId);
    const neutralTone = evidence.rows.find((row: { entryId: string }) => row.entryId === neutralToneId);
    expect(fullTone.matchStatus).toBe("one-source-row-awaiting-sense-review");
    expect(fullTone.sourceRows.map((row: { sourceKind: string; sourceEntryId: string; sourcePhysicalRow: number }) =>
      [row.sourceKind, row.sourceEntryId, row.sourcePhysicalRow])).toEqual([
      ["moe-concised", "047300002", 3148],
    ]);
    expect(neutralTone.sourceRows.map((row: { sourceKind: string }) => row.sourceKind)).toEqual(["moe-revised"]);
  });

  it("inherits only the observed ADJ profile without altering the two existing identities", () => {
    const profiles = [fullToneId, neutralToneId, bianId].map(id =>
      SYNTAX_PROFILES.filter(profile => profile.entryId === id));
    expect(profiles.map(group => group.map(profile => profile.upos))).toEqual([["ADJ"], ["ADJ"], ["ADJ"]]);
    const syntaxShape = ({ id: _id, entryId: _entryId, ...profile }: (typeof SYNTAX_PROFILES)[number]) => profile;
    expect(syntaxShape(profiles[0]![0]!)).toEqual(syntaxShape(profiles[1]![0]!));
    expect(syntaxShape(profiles[0]![0]!)).toEqual(syntaxShape(profiles[2]![0]!));
    expect(profiles[0]![0]).toMatchObject({
      entryId: fullToneId,
      upos: "ADJ",
      functions: ["modifier", "subject"],
    });
  });

  it("selects the added identity through the actual ordered product policy", () => {
    const lexicon = prepareFormalSyntaxLexicon(PRACTICE_CATALOG, SYNTAX_PROFILES);
    for (let probe = 0; probe < 20; probe += 1) {
      const result = composeFormalSyntaxUtterances({
        eligibleEntries: PRACTICE_CATALOG,
        profiles: SYNTAX_PROFILES,
        random: createSeededRandom("polyphonic-targeted-v1:" + fullToneId + ":" + probe),
        samplingMode: "product-family",
        minimumLexicalEntries: 2,
        maximumCandidates: 1,
        maximumAttempts: 32,
        bounds: { maximumPhraseDepth: 3, maximumClauseNesting: 1, maximumClausesPerSentence: 2,
          maximumCoordinationItems: 2, maximumConsecutiveModifiers: 2, maximumComplementsPerPredicate: 1,
          maximumLexicalEntriesPerUtterance: 6 },
        ...PRODUCT_READING_POLICY,
        entryWeight: entry => entry.id === fullToneId ? 100_000_000 : catalogEntryFrequencyWeight(entry),
      }, lexicon);
      const candidate = result.candidates[0];
      const slot = candidate?.entries.findIndex(entry => entry.id === fullToneId) ?? -1;
      if (candidate === undefined || slot < 0) continue;
      const profile = SYNTAX_PROFILES.find(item => item.id === candidate.syntaxProfileIds?.[slot]);
      expect(profile).toMatchObject({ entryId: fullToneId, upos: "ADJ" });
      return;
    }
    throw new Error("full-tone 便宜 was not selected in 20 bounded targeted probes");
  });
});
