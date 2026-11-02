import { describe, expect, it } from "vitest";
import { PRACTICE_CATALOG, SYNTAX_PROFILES } from "../../src/app/generated/catalog.js";
import { composeFormalSyntaxUtterances } from "../../src/curriculum/formal-syntax-utterance.js";
import { createSeededRandom } from "../../src/curriculum/random.js";
import { reviewedAdjacentReadingEligible, reviewedAdjacentPreDrawReadingEligible, reviewedDuoshaoZhongReadingEligible } from "../../src/readings/reviewed-adjacent-context.js";
import { reviewedMoeStandardLeReadingEligible } from "../../src/readings/moe-standard-le.js";
import { reviewedRoleAndOrdinalLineReadingEligible } from "../../src/readings/ordinal-line-context.js";
import { reviewedMoeStandardBiReadingEligible } from "../../src/readings/moe-standard-bi.js";
import { reviewedMoeStandardDeReadingEligible } from "../../src/readings/moe-standard-de.js";

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
function run(seed:number, withBi:boolean, withDe=false) {
  const result=composeFormalSyntaxUtterances({
    eligibleEntries:PRACTICE_CATALOG,profiles:SYNTAX_PROFILES,
    random:createSeededRandom("formal-syntax-v2-phase1-product-baseline-v1:"+seed),
    samplingMode:"product-family",
    minimumLexicalEntries:2,maximumCandidates:1,maximumAttempts:64,bounds,
    readingEligibility:prior,
    preDrawReadingEligibility:reviewedAdjacentPreDrawReadingEligible,
    ...(withBi?{finalCandidateReadingEligibility:reviewedMoeStandardBiReadingEligible}:{}),
    ...(withDe?{subsequentFinalCandidateReadingEligibility:reviewedMoeStandardDeReadingEligible}:{}),
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
