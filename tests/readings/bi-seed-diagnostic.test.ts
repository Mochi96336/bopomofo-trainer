import { describe, expect, it } from "vitest";
import { PRACTICE_CATALOG, SYNTAX_PROFILES } from "../../src/app/generated/catalog.js";
import { composeFormalSyntaxUtterances } from "../../src/curriculum/formal-syntax-utterance.js";
import { createSeededRandom } from "../../src/curriculum/random.js";
import { reviewedAdjacentReadingEligible, reviewedAdjacentPreDrawReadingEligible, reviewedDuoshaoZhongReadingEligible } from "../../src/readings/reviewed-adjacent-context.js";
import { reviewedMoeStandardLeReadingEligible } from "../../src/readings/moe-standard-le.js";
import { reviewedRoleAndOrdinalLineReadingEligible } from "../../src/readings/ordinal-line-context.js";
import { reviewedMoeStandardBiReadingEligible } from "../../src/readings/moe-standard-bi.js";
import { reviewedMoeStandardDeReadingEligible } from "../../src/readings/moe-standard-de.js";
import { reviewedMoeStandardYuReadingEligible } from "../../src/readings/moe-standard-yu.js";
import { reviewedMoeStandardNanReadingEligible } from "../../src/readings/moe-standard-nan.js";
import { reviewedMoeStandardXingReadingEligible } from "../../src/readings/moe-standard-xing.js";
import { reviewedMoeStandardGuoReadingEligible } from "../../src/readings/moe-standard-guo.js";

const bounds = {
  maximumPhraseDepth:3,maximumClauseNesting:1,maximumClausesPerSentence:2,
  maximumCoordinationItems:2,maximumConsecutiveModifiers:2,
  maximumComplementsPerPredicate:1,maximumLexicalEntriesPerUtterance:6,
} as const;
const prior = (
  entry:typeof PRACTICE_CATALOG[number],
  profile:typeof SYNTAX_PROFILES[number],
  slot:unknown,
  previous:typeof PRACTICE_CATALOG[number] | null,
) => reviewedMoeStandardLeReadingEligible(entry, profile)
    && reviewedRoleAndOrdinalLineReadingEligible(entry, profile, slot, previous)
    && reviewedDuoshaoZhongReadingEligible(entry, profile, previous);
function run(seed:number, withBi:boolean, withDe=false, withYu=false, withNan=false, withXing=false, withGuo=false) {
  const result=composeFormalSyntaxUtterances({
    eligibleEntries:PRACTICE_CATALOG,profiles:SYNTAX_PROFILES,
    random:createSeededRandom("formal-syntax-v2-phase1-product-baseline-v1:"+seed),
    samplingMode:"product-family",
    minimumLexicalEntries:2,maximumCandidates:1,maximumAttempts:64,bounds,
    readingEligibility:prior,
    preDrawReadingEligibility:reviewedAdjacentPreDrawReadingEligible,
    ...(withBi?{finalCandidateReadingEligibility:reviewedMoeStandardBiReadingEligible}:{}),
    ...(withDe?{subsequentFinalCandidateReadingEligibility:reviewedMoeStandardDeReadingEligible}:{}),
    ...(withYu?{additionalFinalCandidateReadingEligibilities:[reviewedMoeStandardYuReadingEligible,...(withNan?[reviewedMoeStandardNanReadingEligible]:[]),...(withXing?[reviewedMoeStandardXingReadingEligible]:[]),...(withGuo?[reviewedMoeStandardGuoReadingEligible]:[])]}:{}),
  });
  const x=result.candidates[0];
  return {text:x?.text,root:x?.syntaxRootRuleId,entries:x?.entries.map(e=>e.id), profileIds:x?.syntaxProfileIds, fallback:[...result.fallbackReasons]};
}
describe("final-candidate 比 repair preserves otherwise legal shipped outputs",()=>{
  it("leaves seeds 60 and 84 exactly unchanged (they were already legal)",()=>{
    for(const seed of [60,84]){
      expect(run(seed,true)).toEqual(run(seed,false));
    }
  });
  it("repairs previously observed seed 349 in only the rejected lexical slot",()=>{
    const before=run(349,false),after=run(349,true);
    expect(before.entries?.[1]).toBe("word:比:ㄅㄧ1");
    expect(after.entries?.[1]).not.toBe("word:比:ㄅㄧ1");
    expect(after.root).toBe(before.root);
    expect(after.entries?.length).toBe(before.entries?.length);
    expect(after.entries?.filter((id,i)=>id!==before.entries?.[i])).toHaveLength(1);
    const entriesById=new Map(PRACTICE_CATALOG.map(entry=>[entry.id,entry]));
    const profilesById=new Map(SYNTAX_PROFILES.map(profile=>[profile.id,profile]));
    for(let i=0;i<after.entries!.length;i++){
      const entry=entriesById.get(after.entries![i]!);
      const profile=profilesById.get(after.profileIds?.[i]??"");
      expect(entry).toBeDefined();
      expect(profile).toBeDefined();
      // The final repair must not evade legacy role-specific pronunciation
      // review (especially the rejected conjunction 和/ㄏㄨ2 identity).
      expect(reviewedAdjacentReadingEligible(
        entry!,profile!,null,i===0?null:entriesById.get(after.entries![i-1]!)!,
      )).toBe(true);
    }
  });
});

describe("independent final-candidate stage protects previously shipped 比 outputs",()=>{
  it("preserves seed 1741 exactly even when its previous 比 repair had alternatives involving 得",()=>{
    expect(run(1741,true,true)).toEqual(run(1741,true,false));
  });
  it("changes only the unlicensed 得 slots at seeds 967 and 1013",()=>{
    for (const seed of [967,1013]) {
      const before=run(seed,true);
      const after=run(seed,true,true);
      const index=before.entries?.indexOf("word:得:ㄉㄜ4") ?? -1;
      expect(index).toBeGreaterThanOrEqual(0);
      expect(after.entries?.[index]).not.toBe("word:得:ㄉㄜ4");
      expect(after.root).toBe(before.root);
      expect(after.entries?.filter((id,i)=>id!==before.entries?.[i])).toHaveLength(1);
    }
  });
});

describe("third final-candidate stage preserves existing 比 and 得 corrections",()=>{
  it("does not alter previously changed seeds 349, 967, 1013, or 1741",()=>{
    for (const seed of [349,967,1013,1741]) {
      expect(run(seed,true,true,true)).toEqual(run(seed,true,true,false));
    }
  });
  it("only corrects the disallowed 於 identity at seed 17",()=>{
    const before=run(17,true,true,false), after=run(17,true,true,true);
    const slot=before.entries?.indexOf("word:於:ㄩ1") ?? -1;
    expect(slot).toBeGreaterThanOrEqual(0);
    expect(after.entries?.[slot]).not.toBe("word:於:ㄩ1");
    expect(after.root).toBe(before.root);
    expect(after.entries?.filter((id,i)=>id!==before.entries?.[i])).toHaveLength(1);
  });
});

describe("fourth final reading stage preserves all earlier final readings",()=>{
  it("does not modify previously repaired 比, 得, 於, or unrelated seeds",()=>{
    for (const seed of [17,349,967,1013,1741]) {
      expect(run(seed,true,true,true,true)).toEqual(run(seed,true,true,true,false));
    }
  });
  it("only replaces the original invalid 南 lexical slots for seeds 248 and 1014",()=>{
    for(const seed of [248,1014]){
      const before=run(seed,true,true,true,false);
      const after=run(seed,true,true,true,true);
      const slot=before.entries?.indexOf("word:南:ㄋㄚ1") ?? -1;
      expect(slot).toBeGreaterThanOrEqual(0);
      expect(after.entries?.[slot]).not.toBe("word:南:ㄋㄚ1");
      expect(after.root).toBe(before.root);
      expect(after.entries?.filter((id,i)=>id!==before.entries?.[i])).toHaveLength(1);
    }
  });
});

describe("final 行 pronunciation cleanup cannot reintroduce another known bad reading",()=>{
  it("leaves existing 比, 於, 南 repairs and other lawful seeds untouched",()=>{
    for (const seed of [17,248,349,1013,1014,1741]) {
      expect(run(seed,true,true,true,true,true)).toEqual(run(seed,true,true,true,true,false));
    }
  });
  it("repairs both sampled 行/ㄏㄥ2 selected slots, including seed 967 formerly repaired from 得",()=>{
    for (const seed of [967,1665]) {
      const before=run(seed,true,true,true,true,false);
      const after=run(seed,true,true,true,true,true);
      const slot=before.entries?.indexOf("word:行:ㄏㄥ2") ?? -1;
      expect(slot).toBeGreaterThanOrEqual(0);
      expect(after.entries?.[slot]).not.toBe("word:行:ㄏㄥ2");
      expect(after.root).toBe(before.root);
      expect(after.entries?.filter((id,i)=>id!==before.entries?.[i])).toHaveLength(1);
    }
  });
});

describe("final Taiwan MOE 過 neutral-tone policy",()=>{
  it("leaves every previously fixed selected pronunciation and earlier drift seed unchanged",()=>{
    for(const seed of [17,248,349,967,1013,1014,1665,1741]) {
      expect(run(seed,true,true,true,true,true,true))
        .toEqual(run(seed,true,true,true,true,true,false));
    }
  });
  it("changes only the originally invalid 過 slots, including the repeated two slots of seed 1295",()=>{
    for(const seed of [223,1295,1874,1959]) {
      const before=run(seed,true,true,true,true,true,false);
      const after=run(seed,true,true,true,true,true,true);
      const badSlots=(before.entries??[]).flatMap((id,slot)=>id==="word:過:ㄍㄨㄛ5"?[slot]:[]);
      expect(badSlots).toHaveLength(seed===1295?2:1);
      expect(after.root).toBe(before.root);
      expect(after.entries?.length).toBe(before.entries?.length);
      const changed=(before.entries??[]).flatMap((id,slot)=>id===after.entries?.[slot]?[]:[slot]);
      expect(changed).toEqual(badSlots);
      expect(after.entries).not.toContain("word:過:ㄍㄨㄛ5");
    }
  });
});
