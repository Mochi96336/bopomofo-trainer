import { describe, expect, it } from "vitest";
import { PRACTICE_CATALOG, SYNTAX_PROFILES, COMMONNESS_TIER_THRESHOLDS } from "../../src/app/generated/catalog.js";
import { catalogsForCommonnessTiers } from "../../src/product/commonness-access.js";
import { createProductEnvironment, createFreshProgressForEnvironment, createProductState } from "../../src/product/session.js";
import { PRODUCT_READING_POLICY } from "../../src/readings/product-reading-policy.js";
import { reviewedNumericClassifierReadingEligible } from "../../src/readings/numeric-classifier-reading.js";
import {
  EXPERIMENTAL_READING_ROLE_ATTESTATIONS,
  projectAttestedReadingRoleProfiles,
  attestedReadingRoleProfileContextEligible,
} from "../../src/readings/attested-reading-role-profiles.js";
import { buildLexicalProfileIndex, compatibleProfilesForSlot } from "../../src/syntax/realize.js";
import type { CatalogEntry } from "../../src/core/model.js";
import type { RuntimeSyntaxProfile } from "../../src/syntax/types.js";
import type { StructuralLexicalSlot } from "../../src/syntax/derive.js";

type Gate = (e:CatalogEntry,p:RuntimeSyntaxProfile,s:StructuralLexicalSlot,previous:CatalogEntry|null)=>boolean;
const roles = EXPERIMENTAL_READING_ROLE_ATTESTATIONS;
const number = PRACTICE_CATALOG.find(e=>e.prompt.text==="一")!;
const nonNumber = PRACTICE_CATALOG.find(e=>e.prompt.text==="生命")!;
function slot(requiredFunctions:StructuralLexicalSlot["requiredFunctions"]):StructuralLexicalSlot{
  return {
    kind:"lexical-slot",id:"research:role-only-slot",constituentKey:"target",
    occurrenceIndex:0,allowedUpos:["NOUN"],requiredFunctions,
    requiredValencyFrames:[],requiredFeatures:{},
  };
}
function frontier(
  catalog:readonly CatalogEntry[], profiles:readonly RuntimeSyntaxProfile[],
  word:string, s:StructuralLexicalSlot, previous:CatalogEntry|null,
){
  const idx=buildLexicalProfileIndex(catalog,profiles);
  const gates:readonly Gate[]=[
    PRODUCT_READING_POLICY.readingEligibility,
    PRODUCT_READING_POLICY.preDrawReadingEligibility,
    PRODUCT_READING_POLICY.finalCandidateReadingEligibility,
    PRODUCT_READING_POLICY.subsequentFinalCandidateReadingEligibility,
    ...PRODUCT_READING_POLICY.additionalFinalCandidateReadingEligibilities,
    reviewedNumericClassifierReadingEligible,
    attestedReadingRoleProfileContextEligible,
  ];
  const licensed=compatibleProfilesForSlot(s,idx).filter(p=>{
    const e=idx.entriesById.get(p.entryId)!;
    return e.prompt.text===word && gates.every(g=>g(e,p,s,previous));
  });
  return PRODUCT_READING_POLICY.readingFrontierFilter(licensed,idx.entriesById);
}
function makeCounts(){
  return {target:0,delivered:0,exactIds:{} as Record<string,number>,
    examples:[] as {seed:number,readingId:string,previous:string}[]};
}
describe("source-attested reading-specific syntax role projection, without copying UD counts",()=>{
  it("restores only exact dictionary-backed classifier role profiles in matching contexts",()=>{
    const augmented=projectAttestedReadingRoleProfiles(PRACTICE_CATALOG,SYNTAX_PROFILES,roles);
    expect(augmented.length-SYNTAX_PROFILES.length).toBe(2);
    const rows=[];
    for(const a of roles){
      const b=frontier(PRACTICE_CATALOG,SYNTAX_PROFILES,a.word,slot(["classifier"]),number);
      const after=frontier(PRACTICE_CATALOG,augmented,a.word,slot(["classifier"]),number);
      expect(b).toHaveLength(0);
      expect(after.map(p=>p.entryId)).toEqual([a.entryId]);
      const added=after[0]!;
      expect(added.id.startsWith("attested-reading-role:")).toBe(true);
      expect(added.dependencyEvidence.dependencyRelationCounts).toEqual({});
      expect(added.dependencyEvidence.surfacePositionCounts).toEqual({});
      expect(added.provenanceIds.some(p=>p.startsWith("moe:"))).toBe(true);
      expect(frontier(PRACTICE_CATALOG,augmented,a.word,slot(["classifier"]),null)).toHaveLength(0);
      expect(frontier(PRACTICE_CATALOG,augmented,a.word,slot(["classifier"]),nonNumber)).toHaveLength(0);
      expect(frontier(PRACTICE_CATALOG,augmented,a.word,slot([]),number)).toHaveLength(0);
      expect(frontier(PRACTICE_CATALOG,augmented,a.word,slot(["classifier"]),number)
        .some(p=>p.entryId!==a.entryId)).toBe(false);
      rows.push({word:a.word,reading:a.entryId,baseline:b.length,projected:after.length,
        negativeContextsPassed:3,source:a.evidence.sourceUrl});
    }
    console.log("NEW_READING_ROLE_PROJECTION_FRONTIER_JSON "+JSON.stringify(rows));
  });

  it("compares 512 matched real product seeds after adding only two reading-specific profiles",()=>{
    const mutable=PRODUCT_READING_POLICY as unknown as {readingEligibility:Gate};
    const original=mutable.readingEligibility;
    const all={practice:PRACTICE_CATALOG,syntaxProfiles:SYNTAX_PROFILES};
    const reports=[];
    const targetIds=new Set(roles.map(a=>a.entryId));
    try{
      for(const scope of ["all","tier1"] as const){
        const base=scope==="all"?all
          :catalogsForCommonnessTiers(all,COMMONNESS_TIER_THRESHOLDS,[1]);
        const included=roles.filter(a=>base.practice.some(e=>e.id===a.entryId));
        const extra=projectAttestedReadingRoleProfiles(base.practice,base.syntaxProfiles,included);
        const envOriginal=createProductEnvironment(base);
        const envAugmented=createProductEnvironment({...base,syntaxProfiles:extra});
        const counts={original:makeCounts(),projected:makeCounts()};
        let changed=0;
        for(let seed=0;seed<512;seed++){
          const trial=(arm:"original"|"projected")=>{
            mutable.readingEligibility=(e,p,s,previous)=>
              original(e,p,s,previous)
              && reviewedNumericClassifierReadingEligible(e,p,s,previous)
              && attestedReadingRoleProfileContextEligible(e,p,s,previous);
            const env=arm==="projected"?envAugmented:envOriginal;
            const progress=createFreshProgressForEnvironment(
              env,"reading-specific-role-profile:paired:"+scope+":"+seed,"guided","standard");
            const u=createProductState(env,progress,0).round.selection.utterance;
            const profileMap=new Map(env.catalogs.syntaxProfiles.map(p=>[p.id,p]));
            const stat=counts[arm];
            stat.delivered+=u.entries.length;
            for(let i=0;i<u.entries.length;i++){
              const e=u.entries[i]!;
              if(!targetIds.has(e.id))continue;
              const p=profileMap.get(u.syntaxProfileIds?.[i]??"");
              const prev=u.entries[i-1]?.prompt.text??"";
              if(p?.upos!=="NOUN"||! /^[零〇一二三四五六七八九十百千萬億兩0-9０-９]+$/u.test(prev))continue;
              stat.target++;
              stat.exactIds[e.id]=(stat.exactIds[e.id]??0)+1;
              if(stat.examples.length<8)stat.examples.push({seed,readingId:e.id,previous:prev});
            }
            return JSON.stringify(u.entries.map(e=>e.id));
          };
          if(trial("original")!==trial("projected"))changed++;
        }
        reports.push({scope,pairedRounds:512,addedReadingSpecificProfiles:extra.length-base.syntaxProfiles.length,
          changedRounds:changed,original:counts.original,projected:counts.projected});
      }
    }finally{
      mutable.readingEligibility=original;
    }
    expect(reports).toHaveLength(2);
    console.log("NEW_READING_ROLE_PROJECTION_DELIVERY_JSON "+JSON.stringify(reports));
  },240_000);
});
