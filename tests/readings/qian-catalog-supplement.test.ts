import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PRACTICE_CATALOG, SYNTAX_PROFILES } from "../../src/app/generated/catalog.js";
import { catalogEntryFrequencyWeight } from "../../src/commonness/catalog-projection.js";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import { parseCsv } from "../../src/catalog/csv.js";
import { composeFormalSyntaxUtterances, prepareFormalSyntaxLexicon } from "../../src/curriculum/formal-syntax-utterance.js";
import { createSeededRandom } from "../../src/curriculum/random.js";
import { PRODUCT_READING_POLICY } from "../../src/readings/product-reading-policy.js";

const standardId = catalogEntryId("嵌", "ㄑㄧㄢ1");

describe("source-backed 嵌 qiān catalog supplement", () => {
  it("ships the missing MOE reading while retaining both earlier identities and their shared frequency", () => {
    const entries = ["ㄑㄧㄢ1", "ㄑㄧㄢ4", "ㄎㄢ3"].map(r =>
      PRACTICE_CATALOG.find(e => e.id === catalogEntryId("嵌", r)));
    expect(entries.every(e => e !== undefined)).toBe(true);
    // Browser encoding omits provenance; verify the authoritative source row.
    const rows = parseCsv(readFileSync(new URL("../../data/source/words.sample.csv", import.meta.url), "utf8")).records;
    const sourceRow = rows.find(r => r.values.text === "嵌" && r.values.reading === "ㄑㄧㄢ1")!;
    expect(sourceRow.values.provenance_ids?.split(";")).toEqual(expect.arrayContaining([
      "moe:concised-dictionary", "moe:revised-dictionary",
    ]));
    expect(entries[0]!.commonnessBase).toEqual(entries[1]!.commonnessBase);
    expect(entries[0]!.commonnessBase).toEqual(entries[2]!.commonnessBase);
    const evidence = JSON.parse(readFileSync(new URL("../../data/readings/moe-qian-reading-source-evidence.json", import.meta.url), "utf8"));
    const row = evidence.rows.find((r: { entryId: string }) => r.entryId === standardId);
    expect(row.matchStatus).toBe("paired-sources-awaiting-sense-review");
    expect(row.sourceRows.map((r: { sourceKind: string }) => r.sourceKind).sort()).toEqual(["moe-concised", "moe-revised"]);
  });

  it("can select the new identity through actual catalog profiles and the ordered product reading policy", () => {
    const result = composeFormalSyntaxUtterances({
      eligibleEntries: PRACTICE_CATALOG, profiles: SYNTAX_PROFILES,
      random: createSeededRandom("polyphonic-targeted-v1:" + standardId + ":0"),
      samplingMode: "product-family", minimumLexicalEntries: 2, maximumCandidates: 1, maximumAttempts: 32,
      bounds: { maximumPhraseDepth: 3, maximumClauseNesting: 1, maximumClausesPerSentence: 2,
        maximumCoordinationItems: 2, maximumConsecutiveModifiers: 2, maximumComplementsPerPredicate: 1,
        maximumLexicalEntriesPerUtterance: 6 },
      ...PRODUCT_READING_POLICY,
      entryWeight: e => e.id === standardId ? 100_000_000 : catalogEntryFrequencyWeight(e),
    }, prepareFormalSyntaxLexicon(PRACTICE_CATALOG, SYNTAX_PROFILES));
    const candidate = result.candidates[0]!;
    expect(candidate).toBeDefined();
    const slot = candidate.entries.findIndex(e => e.id === standardId);
    expect(slot).toBeGreaterThanOrEqual(0);
    const profile = SYNTAX_PROFILES.find(p => p.id === candidate.syntaxProfileIds?.[slot]);
    expect(profile).toMatchObject({ entryId: standardId, upos: "VERB", valencyFrames: ["transitive"] });
  });
});
