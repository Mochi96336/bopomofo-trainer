import { readFileSync } from "node:fs";
import { describe,expect,it } from "vitest";
import { PRACTICE_CATALOG,SYNTAX_PROFILES } from "../../src/app/generated/catalog.js";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import { experimentalRiskAbstentionEligible,
  EXPERIMENTAL_RISK_ABSTENTION_APPROVED_FOR_PRODUCT,
} from "../../src/readings/experimental-risk-abstention.js";
import { inferExistingReadingFrontier } from "../../scripts/audit-attested-gold-blind-reading.js";
import { auditCandidateRiskAbstentionOnDev } from "../../scripts/audit-candidate-risk-abstention-dev.js";
import type { ContextBank } from "../../scripts/prototype-attested-reading-selector.js";

const bank=JSON.parse(readFileSync("research/attested-reading-pilot/cases.json","utf8")) as ContextBank;
const catalog={entries:PRACTICE_CATALOG,profiles:SYNTAX_PROFILES};
const IDs={
  zhong3:catalogEntryId("種","ㄓㄨㄥ3"),
  zhong4:catalogEntryId("種","ㄓㄨㄥ4"),
  gei3:catalogEntryId("給","ㄍㄟ3"),
  ji3:catalogEntryId("給","ㄐㄧ3"),
};
function eligible(entryId:string,upos:string){
  const entry=PRACTICE_CATALOG.find(x=>x.id===entryId);
  const profile=SYNTAX_PROFILES.find(x=>x.entryId===entryId&&x.upos===upos);
  expect(entry).toBeDefined();expect(profile).toBeDefined();
  return experimentalRiskAbstentionEligible(entry!,profile!);
}
describe("research-only risk abstention: no false 種 verb certainty",()=>{
  it("leaves the known source-POS counterexample unresolved instead of forcing fourth tone",()=>{
    expect(EXPERIMENTAL_RISK_ABSTENTION_APPROVED_FOR_PRODUCT).toBe(false);
    expect(eligible(IDs.zhong3,"VERB")).toBe(true);
    expect(eligible(IDs.zhong4,"VERB")).toBe(true);
    const trial=inferExistingReadingFrontier({
      word:"種",sourceUpos:"VERB",targetOffset:0,
    },catalog,experimentalRiskAbstentionEligible);
    expect(trial.frontierStatus).toBe("multiple-pronunciations");
    expect(trial.distinctTargetPronunciations).toHaveLength(2);
  });
  it("abstains from two observed generated candidate-role risks only",()=>{
    expect(eligible(IDs.zhong3,"NOUN")).toBe(true);
    expect(eligible(IDs.zhong4,"NOUN")).toBe(false);
    expect(eligible(IDs.gei3,"VERB")).toBe(true);
    expect(eligible(IDs.ji3,"VERB")).toBe(false);
    expect(eligible(IDs.gei3,"ADP")).toBe(true);
    expect(eligible(IDs.ji3,"ADP")).toBe(true);
    const wholeWords=["給予","補給"];
    for(const word of wholeWords){
      for(const entry of PRACTICE_CATALOG.filter(x=>x.prompt.text===word)){
        for(const profile of SYNTAX_PROFILES.filter(x=>x.entryId===entry.id)){
          expect(experimentalRiskAbstentionEligible(entry,profile)).toBe(true);
        }
      }
    }
    expect(()=>experimentalRiskAbstentionEligible(
      PRACTICE_CATALOG.find(x=>x.id===IDs.zhong3)!,
      SYNTAX_PROFILES.find(x=>x.entryId===IDs.zhong4)!,
    )).toThrow(/identity/);
  });
  it("records apparent dev improvement as already-inspected, not heldout accuracy",()=>{
    const result=auditCandidateRiskAbstentionOnDev(bank,catalog);
    expect(result.changedCases.map(x=>x.id)).toEqual(["gsd-012","gsd-013","gsd-015"]);
    expect(result.baselineStatusCounts).toMatchObject({
      "unique-correct":15,"ambiguous-contains-gold":3,
    });
    expect(result.trialStatusCounts).toMatchObject({"unique-correct":18});
    expect(result.sampleCount).toBe(18);
    expect(result.sourceWasAlreadyInspected).toBe(true);
    expect(result.independentHeldout).toBe(false);
    expect(result.productionEnabled).toBe(false);
    expect(result.resultsCannotBeClaimedAsAccuracy).toBe(true);
  });
  it("modifying scoring gold cannot change candidate selection",()=>{
    const changed=structuredClone(bank);
    const found=changed.cases.find(x=>x.id==="gsd-013")!;
    (found as {reviewedCharacterZhuyin:string}).reviewedCharacterZhuyin="ㄐㄧˇ";
    const before=auditCandidateRiskAbstentionOnDev(bank,catalog);
    const after=auditCandidateRiskAbstentionOnDev(changed,catalog);
    expect(before.rows.map(x=>x.trialReadings))
      .toEqual(after.rows.map(x=>x.trialReadings));
    expect(after.rows.find(x=>x.id==="gsd-013")?.trialOutcome).toBe("unique-wrong");
  });
});
