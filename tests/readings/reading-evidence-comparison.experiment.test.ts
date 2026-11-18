import { describe, expect, it } from "vitest";
import { PRACTICE_CATALOG, SYNTAX_PROFILES, COMMONNESS_TIER_THRESHOLDS } from "../../src/app/generated/catalog.js";
import { catalogsForCommonnessTiers } from "../../src/product/commonness-access.js";
import { createProductEnvironment, createFreshProgressForEnvironment, createProductState } from "../../src/product/session.js";
import { PRODUCT_READING_POLICY, productReadingEligibleWithoutPreviousEntry } from "../../src/readings/product-reading-policy.js";
import { REVIEWED_NUMERIC_CLASSIFIER_READINGS, reviewedNumericClassifierReadingEligible } from "../../src/readings/numeric-classifier-reading.js";
import type { CatalogEntry } from "../../src/core/model.js";
import type { StructuralLexicalSlot } from "../../src/syntax/derive.js";
import type { RuntimeSyntaxProfile } from "../../src/syntax/types.js";

/**
 * Three-way matched-seed, read-only product comparison:
 *  baseline: current fail-closed exclusion
 *  sourced: existing exclusion + source-attested NUM + classifier reading gate
 *  unsafe:  no group-level abstention (upper bound only; NEVER release)
 *
 * The classifier gate is the ONLY independently justified new reading-specific
 * experimental evidence in this PR. No other 131 Tier-1 groups get a guessed
 * answer. We measure entire final delivered entry-ID/UPOS exposure, not
 * intermediate candidate weights or a count of touched tests.
 */
type Gate = (e: CatalogEntry,p: RuntimeSyntaxProfile,s: StructuralLexicalSlot,prev: CatalogEntry|null)=>boolean;
type Filter = (profiles: readonly RuntimeSyntaxProfile[], entries: ReadonlyMap<string,CatalogEntry>)=>readonly RuntimeSyntaxProfile[];
type Arm = "baseline"|"sourced"|"unsafe";

const REVIEWED_RISK_ROLE = new Set([
  "都/NOUN/word:都:ㄉㄡ1",
  "說/NOUN/word:說:ㄕㄨㄟ4",
  "號/NOUN/word:號:ㄏㄠ2",
  "了/VERB/word:了:ㄌㄜ5",
  "給/ADP/word:給:ㄐㄧ3",
]);

function stat() {
  return {
    uniqueForms:new Set<string>(),
    selectedIdentityRoles:new Set<string>(),
    targetClassifierHits:0,
    blockedPopulationHits:0,
    blockedPopulationWords:new Set<string>(),
    blockedPopulationIdentities:new Set<string>(),
    reviewedRiskRoleHits:0,
    lexicalOccurrences:0,
    blockedTop:new Map<string,number>(),
    targetExamples:[] as string[],
    riskExamples:[] as string[],
  };
}
function summary(s:ReturnType<typeof stat>) {
  return {
    distinctDeliveredForms:s.uniqueForms.size,
    distinctDeliveredEntryRoles:s.selectedIdentityRoles.size,
    lexicalOccurrences:s.lexicalOccurrences,
    rescuedTargetReadingOccurrences:s.targetClassifierHits,
    populationBlockedGroupExposures:s.blockedPopulationHits,
    populationBlockedDistinctWords:s.blockedPopulationWords.size,
    populationBlockedDistinctIdentities:s.blockedPopulationIdentities.size,
    reviewedExactRoleRiskExposures:s.reviewedRiskRoleHits,
    mostExposedBlockedGroups:[...s.blockedTop].sort((a,b)=>b[1]-a[1]).slice(0,12),
    newTargetExamples:s.targetExamples,
    reviewedRiskExamples:s.riskExamples,
  };
}

describe("new Tier-1 full-catalog reading evidence comparison", () => {
  it("compares guarded vs source-gated vs unsafe on 512 identical fresh product seeds per scope", () => {
    const mutable = PRODUCT_READING_POLICY as unknown as {
      readingEligibility:Gate;readingFrontierFilter:Filter;
    };
    const originalGate = mutable.readingEligibility;
    const originalFilter = mutable.readingFrontierFilter;
    const all = {practice:PRACTICE_CATALOG,syntaxProfiles:SYNTAX_PROFILES};
    const profileById = new Map(SYNTAX_PROFILES.map(p=>[p.id,p]));
    const reports = [];
    const allowedTargetIds = new Set(REVIEWED_NUMERIC_CLASSIFIER_READINGS.values());
    try {
      for (const scope of ["all","tier1"] as const) {
        const catalogs = scope === "all" ? all
          : catalogsForCommonnessTiers(all,COMMONNESS_TIER_THRESHOLDS,[1]);
        const entryById = new Map(catalogs.practice.map(e=>[e.id,e]));
        // Static production-gate-licensed groups, without a preceding lexical token.
        const groups = new Map<string,RuntimeSyntaxProfile[]>();
        for (const p of catalogs.syntaxProfiles) {
          const e=entryById.get(p.entryId);
          if(e===undefined || !productReadingEligibleWithoutPreviousEntry(e,p))continue;
          const key=JSON.stringify([e.prompt.text,p.upos]);
          groups.set(key,[...(groups.get(key)??[]),p]);
        }
        const blocked = new Set<string>();
        for (const [k,profiles] of groups) {
          if(new Set(profiles.map(p=>p.entryId)).size<2)continue;
          if(originalFilter(profiles,entryById).length===0)blocked.add(k);
        }
        const env = createProductEnvironment(catalogs);
        const arms = {
          baseline:stat(),
          sourced:stat(),
          unsafe:stat(),
        };
        const changes={sourced:0,unsafe:0};
        let newlyRejectedEvidenceProfiles=0;
        for(let seed=0;seed<512;seed++){
          const trial=(arm:Arm)=>{
            mutable.readingFrontierFilter = arm==="unsafe" ? frontier=>frontier : originalFilter;
            mutable.readingEligibility=(e,p,s,previous)=>{
              if(!originalGate(e,p,s,previous))return false;
              if(arm!=="sourced")return true;
              const accept=reviewedNumericClassifierReadingEligible(e,p,s,previous);
              if(!accept)newlyRejectedEvidenceProfiles++;
              return accept;
            };
            const progress=createFreshProgressForEnvironment(env,
              "full-reading-evidence:paired:"+scope+":"+seed,"guided","standard");
            const selection=createProductState(env,progress,0).round.selection.utterance;
            const s=arms[arm];
            const signature=JSON.stringify([
              selection.entries.map(e=>e.id),selection.syntaxProfileIds??[]
            ]);
            for(let i=0;i<selection.entries.length;i++){
              const e=selection.entries[i]!;
              const p=profileById.get(selection.syntaxProfileIds?.[i]??"");
              if(p===undefined)throw Error("missing selected profile at "+i);
              s.uniqueForms.add(e.prompt.text);
              s.selectedIdentityRoles.add(e.id+"/"+p.upos);
              s.lexicalOccurrences++;
              const groupKey=JSON.stringify([e.prompt.text,p.upos]);
              if(blocked.has(groupKey)){
                s.blockedPopulationHits++;
                s.blockedPopulationWords.add(e.prompt.text);
                s.blockedPopulationIdentities.add(e.id+"/"+p.upos);
                const key=e.prompt.text+"/"+p.upos;
                s.blockedTop.set(key,(s.blockedTop.get(key)??0)+1);
              }
              const preceding=selection.entries[i-1]?.prompt.text??"";
              if(allowedTargetIds.has(e.id)&&p.upos==="NOUN"&&/^[零〇一二三四五六七八九十百千萬億兩0-9０-９]+$/u.test(preceding)){
                s.targetClassifierHits++;
                if(s.targetExamples.length<5)s.targetExamples.push(
                  JSON.stringify({seed,word:e.prompt.text,reading:e.id,previous:preceding,
                    selectedEntryIds:selection.entries.map(x=>x.id)}));
              }
              const risk=e.prompt.text+"/"+p.upos+"/"+e.id;
              if(REVIEWED_RISK_ROLE.has(risk)){
                s.reviewedRiskRoleHits++;
                if(s.riskExamples.length<5)s.riskExamples.push(
                  JSON.stringify({seed,word:e.prompt.text,entryId:e.id,upos:p.upos,
                    selectedEntryIds:selection.entries.map(x=>x.id)}));
              }
            }
            return signature;
          };
          const b=trial("baseline");
          if(trial("sourced")!==b)changes.sourced++;
          if(trial("unsafe")!==b)changes.unsafe++;
        }
        reports.push({
          scope, pairedFreshRounds:512,
          blockedPopulationGroups:blocked.size,
          changedRoundsVsBaseline:changes,
          evidenceGateRejectedCandidateProfiles:newlyRejectedEvidenceProfiles,
          baseline:summary(arms.baseline),
          sourced:summary(arms.sourced),
          unsafe:summary(arms.unsafe),
          caveat:"Unsafe arm is an exploration ceiling with known suspect reading/role identities, NOT a policy to ship. Counts do not prove phonetic correctness or word-sense appropriateness."
        });
      }
    } finally {
      mutable.readingEligibility=originalGate;
      mutable.readingFrontierFilter=originalFilter;
    }
    expect(reports).toHaveLength(2);
    expect(reports[1]!.blockedPopulationGroups).toBeGreaterThan(100);
    expect(reports.every(r=>r.unsafe.populationBlockedGroupExposures>=r.sourced.populationBlockedGroupExposures)).toBe(true);
    console.log("NEW_READING_THREE_ARM_COMPARISON_JSON "+JSON.stringify(reports));
  },240_000);
});
