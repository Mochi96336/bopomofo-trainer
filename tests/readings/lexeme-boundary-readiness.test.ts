import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PRACTICE_CATALOG, SYNTAX_PROFILES } from "../../src/app/generated/catalog.js";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import type { CatalogEntry } from "../../src/core/model.js";
import {
  auditLexemeBoundaryReadiness,
  type CompoundHostEvidence,
  type LexemeBoundarySeed,
} from "../../src/readings/lexeme-boundary-readiness.js";
import type { RuntimeSyntaxProfile } from "../../src/syntax/types.js";

const makeEntry = (text: string, reading: string): CatalogEntry => ({
  id: catalogEntryId(text, reading),
  prompt: { text, locale: "zh-TW" },
  syllables: [{ tokens: ["zhuyin:ㄓ", "tone:3"] }],
  tags: [],
  provenanceIds: [],
});
const makeProfile = (entry: CatalogEntry): RuntimeSyntaxProfile => ({
  id: "profile:" + entry.id,
  entryId: entry.id,
  upos: "VERB",
  functions: ["predicate"],
  valencyFrames: ["intransitive"],
  dependencyEvidence: { dependencyRelationCounts: {}, surfacePositionCounts: {} },
  provenanceIds: [],
});
const hostCase = (caseId: string, entryId: string, host: string): CompoundHostEvidence => ({
  caseId,
  entryId,
  evidenceBoundary: "attested-in-larger-lexeme",
  exampleHostLexeme: host,
});

describe("opt-in whole-lexeme boundary readiness, never a reading gate", () => {
  const rare = makeEntry("說", "ㄕㄨㄟ4");
  const you = makeEntry("遊", "ㄧㄡ2");
  const full = makeEntry("遊說", "ㄧㄡ2 ㄕㄨㄟ4");
  const ji = makeEntry("給", "ㄐㄧ3");
  const ziji = makeEntry("自給自足", "ㄗ4 ㄐㄧ3 ㄗ4 ㄗㄨ2");
  const wei = makeEntry("為", "ㄨㄟ2");
  const cheng = makeEntry("成", "ㄔㄥ2");

  const cases = [
    hostCase("say", rare.id, "遊說"),
    hostCase("give", ji.id, "自給自足"),
    hostCase("be", wei.id, "成為"),
  ];
  const entries = [rare, you, full, ji, ziji, wei, cheng];
  const seeds: LexemeBoundarySeed[] = [
    { seedIndex: 0, text: "遊說。", entryIds: [full.id] },
    { seedIndex: 1, text: "遊說。", entryIds: [you.id, rare.id] },
    { seedIndex: 2, text: "說。", entryIds: [rare.id] },
    { seedIndex: 3, text: "自給自足。", entryIds: [ziji.id] },
    { seedIndex: 4, text: "成為。", entryIds: [cheng.id, wei.id] },
  ];

  it("counts atomic entries, surface collisions, and isolated readings separately", () => {
    const report = auditLexemeBoundaryReadiness(cases, entries, [makeProfile(full)], seeds);
    expect(report.schemaVersion).toBe("polyphonic-lexeme-boundary-readiness-v1");
    expect(report.cases.map((row) => row.readiness))
      .toEqual(["profile-present", "catalog-only", "absent-from-catalog"]);
    expect(report.cases.map((row) => [
      row.sampledAtomicHostOccurrences,
      row.sampledSurfaceOnlySentences,
      row.sampledIsolatedTargetSentences,
    ])).toEqual([
      [1, 1, 2],
      [1, 0, 0],
      [0, 1, 1],
    ]);
    expect(report.cases.every((row) => row.verdict === "no-contextual-reading-inference")).toBe(true);
    expect(report.cases[0]!.hostCatalogEntryIds).toEqual([full.id]);
  });

  it("rejects broken joins or fake evidence instead of licensing a substring", () => {
    expect(() => auditLexemeBoundaryReadiness(cases, entries, [], [
      { seedIndex: 0, text: "遊說", entryIds: ["word:不存在:ㄅㄨ4"] },
    ])).toThrow("absent from catalog");
    expect(() => auditLexemeBoundaryReadiness(cases, entries, [], [
      { seedIndex: 1, text: "說", entryIds: [rare.id] },
    ])).toThrow("noncanonical");
    expect(() => auditLexemeBoundaryReadiness([
      hostCase("bad", rare.id, "說"),
    ], entries, [], [])).toThrow("larger-lexeme");
    expect(() => auditLexemeBoundaryReadiness([
      hostCase("bad", "word:說:wrong", "遊說"),
    ], entries, [], [])).toThrow("target absent from catalog");
  });

  it("keeps the three current MOE compound examples as inspection only", () => {
    const evidence = JSON.parse(readFileSync(
      new URL("../../data/readings/moe-online-headword-sense-evidence.json", import.meta.url),
      "utf8",
    )) as {
      entries: (CompoundHostEvidence & {
        usableAsTrainingLabel: boolean;
        usableAsProductRule: boolean;
      })[];
    };
    const report = auditLexemeBoundaryReadiness(
      evidence.entries, PRACTICE_CATALOG, SYNTAX_PROFILES, [],
    );
    expect(report.cases.map((row) => [row.hostLexeme, row.targetReadingEntryId])).toEqual([
      ["遊說", "word:說:ㄕㄨㄟ4"],
      ["自給自足", "word:給:ㄐㄧ3"],
      ["成為", "word:為:ㄨㄟ2"],
    ]);
    expect(report.cases.map((row) => row.readiness)).toEqual([
      "profile-present", "absent-from-catalog", "absent-from-catalog",
    ]);
    expect(evidence.entries.every((row) =>
      row.usableAsTrainingLabel === false && row.usableAsProductRule === false,
    )).toBe(true);
  });
});
