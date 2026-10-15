import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PRACTICE_CATALOG } from "../../src/app/generated/catalog.js";
import { buildPolyphonicReadingIndex } from "../../src/readings/polyphonic-audit.js";

interface Hypothesis {
  caseId: string;
  entryId: string;
  sourceIds: { concised: string; revised: string };
  authoredExample: string;
  targetWrittenForm: string;
  scope: string;
  senseHypothesis: string;
  readingReview: string;
  syntaxRoleReview: string;
  sentenceNaturalnessReview: string;
  sourceSenseReview: string;
  notTrainingGroundTruth: boolean;
}

const file = JSON.parse(
  readFileSync(new URL("../../data/readings/moe-20260929-pilot-context-hypotheses.json", import.meta.url), "utf8"),
) as { schemaVersion: string; status: string; rows: Hypothesis[] };

describe("MOE September reading sense-case research hypotheses (not runtime policy)", () => {
  it("provides exactly ten different actual catalog reading identities", () => {
    expect(file.schemaVersion).toBe("moe-20260929-sense-context-hypotheses-v1");
    expect(file.rows).toHaveLength(10);
    const all = new Set(PRACTICE_CATALOG.map(entry => entry.id));
    const ambiguous = buildPolyphonicReadingIndex(PRACTICE_CATALOG);
    const observed = new Set<string>();
    for (const row of file.rows) {
      expect(all.has(row.entryId), row.entryId).toBe(true);
      const text = row.entryId.split(":")[1];
      expect(ambiguous.get(text)?.includes(row.entryId)).toBe(true);
      expect(row.targetWrittenForm).toBe(text);
      expect(row.authoredExample.includes(text)).toBe(true);
      expect(row.authoredExample.length).toBeGreaterThan(text.length);
      expect(row.sourceIds.concised).toMatch(/^\\d+$/);
      expect(row.sourceIds.revised).toMatch(/^\\d+$/);
      expect(observed.has(row.entryId)).toBe(false);
      observed.add(row.entryId);
    }
    expect(new Set(file.rows.map(row => row.targetWrittenForm))).toEqual(
      new Set(["種", "說", "東西", "給", "為"]),
    );
  });

  it("cannot accidentally treat generated or authored contexts as approved training labels", () => {
    for (const row of file.rows) {
      expect(row.notTrainingGroundTruth).toBe(true);
      for (const field of [
        "readingReview", "syntaxRoleReview",
        "sentenceNaturalnessReview", "sourceSenseReview",
      ] as const) {
        expect(row[field]).toBe("pending");
      }
      expect(row.senseHypothesis.length).toBeGreaterThan(1);
      expect(["standalone-token", "bound-in-compound", "multi-character-headword"])
        .toContain(row.scope);
    }
    const bound = file.rows.filter(row => row.scope === "bound-in-compound");
    expect(bound.map(row => row.entryId)).toEqual([
      "word:說:ㄕㄨㄟ4", "word:給:ㄐㄧ3", "word:為:ㄨㄟ2",
    ]);
  });

  it("has source pointers only, not copied source definitions or browser shipping hooks", () => {
    const text = readFileSync(new URL("../../data/readings/moe-20260929-pilot-context-hypotheses.json", import.meta.url), "utf8");
    expect(text).not.toContain('"definition"');
    expect(text).not.toContain('"definitionSha256"');
    expect(file.status).toContain("NOT reviewed");
  });
});