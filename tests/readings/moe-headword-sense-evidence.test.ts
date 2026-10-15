import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PRACTICE_CATALOG } from "../../src/app/generated/catalog.js";

interface Evidence {
  caseId: string;
  entryId: string;
  externalReference: { work: string; url: string; headwordReadingChecked: boolean };
  authoredSenseFamily: string;
  evidenceBoundary: "whole-token-role-needed" | "attested-in-larger-lexeme" | "same-upos-sense-needed";
  exampleHostLexeme: string | null;
  sourceMeaningStatus: string;
  septemberSourceDefinitionComparison: string;
  authoredExampleReadingStatus: string;
  syntaxRoleStatus: string;
  sentenceNaturalnessStatus: string;
  usableAsTrainingLabel: boolean;
  usableAsProductRule: boolean;
}

const read = (file: string) =>
  JSON.parse(readFileSync(new URL("../../data/readings/" + file, import.meta.url), "utf8"));

const evidence = read("moe-online-headword-sense-evidence.json") as {
  schemaVersion: string;
  status: string;
  entries: Evidence[];
};
const hypotheses = read("moe-20260929-pilot-context-hypotheses.json") as {
  rows: { caseId: string; entryId: string; targetWrittenForm: string; scope: string; sourceIds: unknown }[];
};

describe("independent MOE headword sense crosscheck is not a contextual rule", () => {
  it("checks the same ten exact active reading IDs and case/source identities", () => {
    expect(evidence.schemaVersion).toBe("moe-headword-sense-evidence-crosscheck-v1");
    expect(evidence.entries).toHaveLength(10);
    const catalogIds = new Set(PRACTICE_CATALOG.map(e => e.id));
    expect(evidence.entries.map(x => [x.caseId, x.entryId])).toEqual(
      hypotheses.rows.map(x => [x.caseId, x.entryId]),
    );
    const urls = new Set<string>();
    for (const [i, row] of evidence.entries.entries()) {
      const sourceCase = hypotheses.rows[i];
      expect(sourceCase).toBeDefined();
      expect(catalogIds.has(row.entryId)).toBe(true);
      expect(row.entryId.startsWith("word:" + sourceCase!.targetWrittenForm + ":")).toBe(true);
      expect(row.externalReference.work).toBe("moe-concised-online-2021");
      expect(row.externalReference.headwordReadingChecked).toBe(true);
      expect(row.externalReference.url).toMatch(
        /^https:\/\/dict\.concised\.moe\.edu\.tw\/dictView\.jsp\?ID=\d+&la=0&powerMode=0$/,
      );
      expect(urls.has(row.externalReference.url)).toBe(false);
      urls.add(row.externalReference.url);
      expect(row.authoredSenseFamily.length).toBeGreaterThan(0);
    }
  });

  it("preserves compound boundaries instead of licensing isolated rare readings", () => {
    const bound = evidence.entries.filter(x => x.evidenceBoundary === "attested-in-larger-lexeme");
    expect(bound.map(x => [x.entryId, x.exampleHostLexeme])).toEqual([
      ["word:說:ㄕㄨㄟ4", "遊說"],
      ["word:給:ㄐㄧ3", "自給自足"],
      ["word:為:ㄨㄟ2", "成為"],
    ]);
    for (const row of bound) {
      const surface = row.entryId.split(":")[1];
      if (surface === undefined) throw new Error("invalid entry ID");
      expect(row.exampleHostLexeme).not.toBe(surface);
      expect(row.exampleHostLexeme?.includes(surface)).toBe(true);
    }
    expect(
      evidence.entries.filter(x => x.evidenceBoundary === "same-upos-sense-needed")
        .map(x => x.entryId),
    ).toEqual(["word:東西:ㄉㄨㄥ1-ㄒㄧ1", "word:東西:ㄉㄨㄥ1-ㄒㄧ5"]);
  });

  it("does not silently promote a dictionary headword into a validated sentence or product rule", () => {
    for (const row of evidence.entries) {
      expect(row.sourceMeaningStatus).toBe("dictionary-headword-crosschecked");
      expect(row.septemberSourceDefinitionComparison).toBe("pending");
      expect(row.authoredExampleReadingStatus).toBe("pending");
      expect(row.syntaxRoleStatus).toBe("pending");
      expect(row.sentenceNaturalnessStatus).toBe("pending");
      expect(row.usableAsTrainingLabel).toBe(false);
      expect(row.usableAsProductRule).toBe(false);
    }
    expect(evidence.status).toContain("no production rule");
  });
});