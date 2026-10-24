import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  auditGiveLexicalBoundary,
} from "../../scripts/audit-attested-give-lexical-boundary.js";
import type {
  ContextBank,
} from "../../scripts/prototype-attested-reading-selector.js";
import {
  PRACTICE_CATALOG, SYNTAX_PROFILES,
} from "../../src/app/generated/catalog.js";

const bank=JSON.parse(readFileSync(
  "research/attested-reading-pilot/cases.json","utf8")) as ContextBank;
const catalog={entries:PRACTICE_CATALOG,profiles:SYNTAX_PROFILES};

describe("attested 給 lexical-boundary evidence and strict no-gold prediction",()=>{
  it("separates standalone source tokens from true compound lexemes",()=>{
    const result=auditGiveLexicalBoundary(bank,catalog);
    expect(result.rows.map(x=>[x.id,x.originalWholeWord,x.lexicalBoundary]))
      .toEqual([
        ["gsd-013","給","standalone-token"],
        ["gsd-014","給予","multi-character-token"],
        ["gsd-015","給","standalone-token"],
        ["gsd-016","補給","multi-character-token"],
      ]);
    expect(result.standaloneCount).toBe(2);
    expect(result.multiCharacterCount).toBe(2);
    expect(result.distinctStandaloneReviewedReadings).toEqual(["ㄍㄟˇ"]);
    expect(result.evidenceForOpposingStandaloneJi).toBe(false);
    expect(result.diagnosticSplitIsNotHeldOut).toBe(true);
    expect(result.officialGuidanceIsStatisticalNotAbsolute).toBe(true);
    expect(result.trainingLabelsProduced).toBe(0);
    expect(result.productionPredictionEnabled).toBe(false);
    expect(result.rows.every(x=>x.automaticallyDecided===false
      && x.selectedReading===null)).toBe(true);
    expect(result.rows.filter(x=>x.lexicalBoundary==="standalone-token")
      .every(x=>x.frontierStatus==="multiple-pronunciations")).toBe(true);
    expect(result.rows.filter(x=>x.lexicalBoundary==="multi-character-token")
      .every(x=>x.frontierStatus==="one-pronunciation")).toBe(true);
  });
  it("changing reviewed gold cannot affect lexical boundaries or candidate frontiers",()=>{
    const changed=structuredClone(bank);
    const row=changed.cases.find(x=>x.id==="gsd-013")!;
    (row as {reviewedCharacterZhuyin:string}).reviewedCharacterZhuyin="ㄐㄧˇ";
    const a=auditGiveLexicalBoundary(bank,catalog);
    const b=auditGiveLexicalBoundary(changed,catalog);
    const noGold=(r:typeof a)=>r.rows.map(x=>[
      x.id,x.originalWholeWord,x.lexicalBoundary,x.frontierStatus,x.candidateCount,
    ]);
    expect(noGold(a)).toEqual(noGold(b));
    expect(b.distinctStandaloneReviewedReadings).toEqual(["ㄍㄟˇ","ㄐㄧˇ"]);
    expect(b.evidenceForOpposingStandaloneJi).toBe(true);
    expect(b.rows.every(x=>x.automaticallyDecided===false)).toBe(true);
  });
});
