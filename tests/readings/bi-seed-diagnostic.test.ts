import { describe, expect, it } from "vitest";
import { PRACTICE_CATALOG, SYNTAX_PROFILES } from "../../src/app/generated/catalog.js";
import { composeFormalSyntaxUtterances } from "../../src/curriculum/formal-syntax-utterance.js";
import { createSeededRandom } from "../../src/curriculum/random.js";
import { reviewedAdjacentReadingEligible, reviewedAdjacentPreDrawReadingEligible, reviewedDuoshaoZhongReadingEligible } from "../../src/readings/reviewed-adjacent-context.js";
import { reviewedMoeStandardLeReadingEligible } from "../../src/readings/moe-standard-le.js";
import { reviewedRoleAndOrdinalLineReadingEligible } from "../../src/readings/ordinal-line-context.js";
import { reviewedMoeStandardBiReadingEligible } from "../../src/readings/moe-standard-bi.js";

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
function run(seed:number, withBi:boolean) {
  const result=composeFormalSyntaxUtterances({
    eligibleEntries:PRACTICE_CATALOG,profiles:SYNTAX_PROFILES,
    random:createSeededRandom("formal-syntax-v2-phase1-product-baseline-v1:"+seed),
    samplingMode:"product-family",
    minimumLexicalEntries:2,maximumCandidates:1,maximumAttempts:64,bounds,
    readingEligibility:prior,
    preDrawReadingEligibility:reviewedAdjacentPreDrawReadingEligible,
    ...(withBi?{finalCandidateReadingEligibility:reviewedMoeStandardBiReadingEligible}:{}),
  });
  const x=result.candidates[0];
  return {text:x?.text,root:x?.syntaxRootRuleId,entries:x?.entries.map(e=>e.id), fallback:[...result.fallbackReasons]};
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
  });
});
