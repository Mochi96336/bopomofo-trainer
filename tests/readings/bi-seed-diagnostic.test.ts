import { describe, expect, it } from "vitest";
import { PRACTICE_CATALOG, SYNTAX_PROFILES } from "../../src/app/generated/catalog.js";
import { composeFormalSyntaxUtterances } from "../../src/curriculum/formal-syntax-utterance.js";
import { createSeededRandom } from "../../src/curriculum/random.js";
import { reviewedAdjacentReadingEligible, reviewedAdjacentPreDrawReadingEligible, reviewedDuoshaoZhongReadingEligible } from "../../src/readings/reviewed-adjacent-context.js";
import { reviewedMoeStandardLeReadingEligible } from "../../src/readings/moe-standard-le.js";
import { reviewedRoleAndOrdinalLineReadingEligible } from "../../src/readings/ordinal-line-context.js";
import { NONSTANDARD_BI_FIRST_TONE_ID } from "../../src/readings/moe-standard-bi.js";

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
    readingEligibility:withBi?reviewedAdjacentReadingEligible:prior,
    preDrawReadingEligibility:reviewedAdjacentPreDrawReadingEligible,
    ...(withBi?{isolatedReadingRedrawEntryIds:new Set([NONSTANDARD_BI_FIRST_TONE_ID])}:{}),
  });
  const x=result.candidates[0];
  return {text:x?.text,root:x?.syntaxRootRuleId,entries:x?.entries.map(e=>e.id), fallback:[...result.fallbackReasons]};
}
describe("diagnose pinned 比 reading rewrite",()=>{
  it("reports full before/after entries for seeds 60,84,349",()=>{
    for(const seed of [60,84,349]){
      const before=run(seed,false),after=run(seed,true);
      expect(before.entries).toBeDefined();
      expect(after.entries).toBeDefined();
      console.log("BI_SEED_DIAGNOSTIC",JSON.stringify({seed,before,after}));
    }
  });
});
