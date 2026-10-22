import { readFileSync } from "node:fs";
import { describe,expect,it } from "vitest";
import type { ContextBank } from "../../scripts/prototype-attested-reading-selector.js";
import { compareZhongRoleOnAttestedCases } from "../../scripts/compare-attested-zhong-role-ablation.js";

const bank=JSON.parse(readFileSync(
  "research/attested-reading-pilot/cases.json","utf8")) as ContextBank;

describe("existing opt-in 種-role pilot on real pinned cases (NOT shipping policy)",()=>{
  it("only shrinks the oracle-NOUN 種 frontier, leaving both standalone 給 cases open",()=>{
    const report=compareZhongRoleOnAttestedCases(bank);
    expect(report.changedRows.map(r=>r.id)).toEqual(["gsd-012"]);
    expect(report.changedRows[0]).toMatchObject({
      word:"種",upos:"NOUN",baseline:"ambiguous-contains-gold",
      optIn:"unique-correct",goldUsedOnlyForScoring:true,
    });
    for(const id of ["gsd-013","gsd-015"]){
      const row=report.rows.find(x=>x.id===id)!;
      expect(row.changed).toBe(false);
      expect(row.optIn).toBe("ambiguous-contains-gold");
    }
    expect(report.rows).toHaveLength(18);
  });
  it("changing gold after filtering cannot change any candidate set",()=>{
    const original=compareZhongRoleOnAttestedCases(bank);
    const changed=structuredClone(bank);
    const target=changed.cases.find(x=>x.id==="gsd-012")!;
    (target as {reviewedCharacterZhuyin:string}).reviewedCharacterZhuyin="ㄓㄨㄥˋ";
    const other=compareZhongRoleOnAttestedCases(changed);
    expect(original.rows.map(r=>[r.baselineReadings,r.pilotReadings]))
      .toEqual(other.rows.map(r=>[r.baselineReadings,r.pilotReadings]));
    expect(other.rows.find(r=>r.id==="gsd-012")?.optIn).toBe("unique-wrong");
  });
});
