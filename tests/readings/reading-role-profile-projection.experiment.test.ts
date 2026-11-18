import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  PRACTICE_CATALOG, SYNTAX_PROFILES, COMMONNESS_TIER_THRESHOLDS,
} from "../../src/app/generated/catalog.js";
import { catalogsForCommonnessTiers } from "../../src/product/commonness-access.js";
import {
  createProductEnvironment, createFreshProgressForEnvironment, createProductState,
} from "../../src/product/session.js";
import {
  PRODUCT_READING_POLICY, productReadingEligibleWithoutPreviousEntry,
} from "../../src/readings/product-reading-policy.js";
import {
  compileReviewedReadingRoleProfiles, parseReviewedReadingRoleManifest,
  type ReviewedReadingRoleManifest,
} from "../../src/readings/attested-reading-role-profiles.js";
import { buildLexicalProfileIndex, compatibleProfilesForSlot } from "../../src/syntax/realize.js";
import type { CatalogEntry } from "../../src/core/model.js";
import type { RuntimeSyntaxProfile } from "../../src/syntax/types.js";
import type { StructuralLexicalSlot } from "../../src/syntax/derive.js";

type Gate = (e: CatalogEntry,p: RuntimeSyntaxProfile,s: StructuralLexicalSlot,previous: CatalogEntry|null)=>boolean;
const manifestPath = new URL("../../data/readings/reviewed-reading-role-evidence.json", import.meta.url);
const manifest = parseReviewedReadingRoleManifest(JSON.parse(readFileSync(manifestPath,"utf8")) as unknown);
const number = PRACTICE_CATALOG.find(e => e.prompt.text==="一")!;
const nonNumber = PRACTICE_CATALOG.find(e => e.prompt.text==="生命")!;
const all = {practice:PRACTICE_CATALOG,syntaxProfiles:SYNTAX_PROFILES};

function slot(requiredFunctions:StructuralLexicalSlot["requiredFunctions"]):StructuralLexicalSlot{
  return {
    kind:"lexical-slot",id:"reviewed-role-batch-slot",constituentKey:"target",
    occurrenceIndex:0,allowedUpos:["NOUN"],requiredFunctions,
    requiredValencyFrames:[],requiredFeatures:{},
  };
}
function frontier(
  catalog:readonly CatalogEntry[], profiles:readonly RuntimeSyntaxProfile[],
  word:string, s:StructuralLexicalSlot, previous:CatalogEntry|null,
  extraGate:Gate,
){
  const idx=buildLexicalProfileIndex(catalog,profiles);
  const gates:readonly Gate[]=[
    PRODUCT_READING_POLICY.readingEligibility,
    PRODUCT_READING_POLICY.preDrawReadingEligibility,
    PRODUCT_READING_POLICY.finalCandidateReadingEligibility,
    PRODUCT_READING_POLICY.subsequentFinalCandidateReadingEligibility,
    ...PRODUCT_READING_POLICY.additionalFinalCandidateReadingEligibilities,
    extraGate,
  ];
  const licensed=compatibleProfilesForSlot(s,idx).filter(p=>{
    const e=idx.entriesById.get(p.entryId)!;
    return e.prompt.text===word && gates.every(g=>g(e,p,s,previous));
  });
  return PRODUCT_READING_POLICY.readingFrontierFilter(licensed,idx.entriesById);
}

function scopeManifest(base: {practice:readonly CatalogEntry[]}, source:ReviewedReadingRoleManifest){
  const ids=new Set(base.practice.map(e=>e.id));
  return {...source,rows:source.rows.filter(row=>ids.has(row.entryId))};
}

function blockedGroups(entries:readonly CatalogEntry[],profiles:readonly RuntimeSyntaxProfile[]){
  const byId=new Map(entries.map(e=>[e.id,e]));
  const groups=new Map<string,RuntimeSyntaxProfile[]>();
  for(const p of profiles){
    const e=byId.get(p.entryId);
    if(e===undefined || !productReadingEligibleWithoutPreviousEntry(e,p))continue;
    const key=e.prompt.text+"/"+p.upos;
    groups.set(key,[...(groups.get(key)??[]),p]);
  }
  return new Set([...groups].filter(([,ps])=>
    new Set(ps.map(p=>p.entryId)).size>1
    && PRODUCT_READING_POLICY.readingFrontierFilter(ps,byId).length===0
  ).map(([key])=>key));
}

function newCounters(){
  return {target:0,delivered:0,byReading:{} as Record<string,number>,
    examples:[] as {seed:number,entryId:string,previous:string}[]};
}

describe("batch imported reading-ID role evidence; no fabricated UD pronunciation labels",()=>{
  it("rejects unreviewed, inconsistent, conflicting, or unpinned records",()=>{
    expect(manifest.rows.length).toBeGreaterThan(0);
    const mutate=(callback:(copy:Record<string,unknown>)=>void)=>{
      const copy=JSON.parse(JSON.stringify(manifest)) as Record<string,unknown>;
      callback(copy);
      return () => parseReviewedReadingRoleManifest(copy);
    };
    expect(mutate(copy=>{copy.schemaVersion="v2";})).toThrow();
    expect(mutate(copy=>{
      (copy.rows as Record<string,unknown>[])[0]!.entryId="word:錯:ㄘㄨㄛ4";
    })).toThrow();
    expect(mutate(copy=>{
      ((copy.rows as Record<string,unknown>[])[0]!.evidence as Record<string,unknown>)
        .reviewStatus="unreviewed";
    })).toThrow();
    expect(mutate(copy=>{
      ((copy.rows as Record<string,unknown>[])[0]!.evidence as Record<string,unknown>)
        .sourceUrl="https://example.com/dictView.jsp?ID=1";
    })).toThrow();
    expect(mutate(copy=>{
      (copy.rows as Record<string,unknown>[])[0]!.contextGate="guess-common-reading";
    })).toThrow();
    expect(mutate(copy=>{
      (copy.rows as Record<string,unknown>[]).push((copy.rows as Record<string,unknown>[])[0]!);
    })).toThrow();
    expect(mutate(copy=>{
      (copy.rows as Record<string,unknown>[])[0]!.unexpected="annotation";
    })).toThrow();
    expect(parseReviewedReadingRoleManifest({
      ...manifest,rows:[...manifest.rows].reverse(),
    }).rows.map(row=>row.entryId)).toEqual(manifest.rows.map(row=>row.entryId));
  });

  it("imports all six rows, adds only missing reading-specific roles, and refuses negative contexts",()=>{
    const compiled=compileReviewedReadingRoleProfiles(PRACTICE_CATALOG,SYNTAX_PROFILES,manifest);
    const alreadySupported=manifest.rows.filter(row=>
      SYNTAX_PROFILES.some(p=>p.entryId===row.entryId&&p.upos===row.upos
        &&p.functions.includes(row.role))).length;
    const expectedNew=manifest.rows.length-alreadySupported;
    expect(compiled.report.manifestRows).toBe(manifest.rows.length);
    expect(compiled.report.existingRuntimeRoleRows).toBe(alreadySupported);
    expect(compiled.report.addedSourceRoleProfiles).toBe(expectedNew);
    expect(compiled.profiles.length-SYNTAX_PROFILES.length).toBe(expectedNew);
    expect(SYNTAX_PROFILES.some(p=>p.id.startsWith("attested-reading-role:"))).toBe(false);
    const initialIds=new Set(SYNTAX_PROFILES.map(p=>p.id));
    const added=compiled.profiles.filter(p=>!initialIds.has(p.id));
    expect(added.every(p=>p.dependencyEvidence.dependencyRelationCounts
      && Object.keys(p.dependencyEvidence.dependencyRelationCounts).length===0)).toBe(true);
    expect(added.every(p=>Object.keys(p.dependencyEvidence.surfacePositionCounts).length===0)).toBe(true);
    expect(added.every(p=>p.provenanceIds.every(x=>x.startsWith("moe:")))).toBe(true);

    const rows=[];
    for(const row of manifest.rows){
      const baseline=frontier(PRACTICE_CATALOG,SYNTAX_PROFILES,row.word,
        slot(["classifier"]),number,()=>true);
      const after=frontier(PRACTICE_CATALOG,compiled.profiles,row.word,
        slot(["classifier"]),number,compiled.readingEligible);
      expect(baseline,row.entryId).toHaveLength(0);
      expect([...new Set(after.map(p=>p.entryId))],row.entryId).toEqual([row.entryId]);
      // Dedicated source-only profile is excluded unless every gate matches.
      for(const [requirements,predecessor] of [
        [slot(["classifier"]),null],
        [slot(["classifier"]),nonNumber],
        [slot([]),number],
      ] as const){
        expect(frontier(PRACTICE_CATALOG,compiled.profiles,row.word,
          requirements,predecessor,compiled.readingEligible).map(p=>p.id))
          .toEqual(frontier(PRACTICE_CATALOG,SYNTAX_PROFILES,row.word,
            requirements,predecessor,()=>true).map(p=>p.id));
      }
      rows.push({word:row.word,readingId:row.entryId,baseline:baseline.length,
        restoredReadingIdentities:new Set(after.map(p=>p.entryId)).size,
        profileStatus:compiled.report.rows.find(r=>r.entryId===row.entryId)!.status});
    }
    console.log("READING_ROLE_BATCH_FRONTIER_JSON "+JSON.stringify(rows));
  });

  it("measures full-catalog and Tier1 batch coverage against all actually blocked static groups",()=>{
    const results=[];
    for(const scope of ["all","tier1"] as const){
      const base=scope==="all" ? all
        :catalogsForCommonnessTiers(all,COMMONNESS_TIER_THRESHOLDS,[1]);
      const records=scopeManifest(base,manifest);
      const projection=compileReviewedReadingRoleProfiles(
        base.practice,base.syntaxProfiles,records);
      const blocked=blockedGroups(base.practice,base.syntaxProfiles);
      const independentlyReviewed=records.rows.filter(row=>
        blocked.has(row.word+"/"+row.upos));
      results.push({
        scope,blockedSourceWordUposGroups:blocked.size,
        reviewedRoleRowsInScope:records.rows.length,
        reviewedRoleRowsWithinBlockedGroups:independentlyReviewed.length,
        blockedGroupsStillMissingReviewedRoleEvidence:
          blocked.size-independentlyReviewed.length,
        existingRuntimeRoleRows:projection.report.existingRuntimeRoleRows,
        addedSourceRoleProfiles:projection.report.addedSourceRoleProfiles,
        rolesByWord:projection.report.rows,
        digest:projection.report.determinismDigest,
      });
    }
    expect(results[0]!.blockedSourceWordUposGroups).toBe(249);
    expect(results[1]!.blockedSourceWordUposGroups).toBe(131);
    console.log("READING_ROLE_BATCH_COVERAGE_JSON "+JSON.stringify(results));
  });

  it("measures paired final real-product exposure without changing the shipped baseline",()=>{
    const mutable=PRODUCT_READING_POLICY as unknown as {readingEligibility:Gate};
    const original=mutable.readingEligibility;
    const results=[];
    try{
      for(const scope of ["all","tier1"] as const){
        const base=scope==="all" ? all
          :catalogsForCommonnessTiers(all,COMMONNESS_TIER_THRESHOLDS,[1]);
        const records=scopeManifest(base,manifest);
        const projection=compileReviewedReadingRoleProfiles(
          base.practice,base.syntaxProfiles,records);
        const envOriginal=createProductEnvironment(base);
        const envProjected=createProductEnvironment({...base,syntaxProfiles:projection.profiles});
        const counts={baseline:newCounters(),projected:newCounters()};
        const targetIds=new Set(records.rows.map(row=>row.entryId));
        let changed=0;
        for(let seed=0;seed<512;seed++){
          const run=(arm:"baseline"|"projected")=>{
            mutable.readingEligibility=arm==="baseline" ? original
              : (e,p,s,previous)=>original(e,p,s,previous)
                && projection.readingEligible(e,p,s,previous);
            const env=arm==="baseline"?envOriginal:envProjected;
            const progress=createFreshProgressForEnvironment(env,
              "batch-role-evidence:paired:"+scope+":"+seed,"guided","standard");
            const u=createProductState(env,progress,0).round.selection.utterance;
            const record=counts[arm];
            record.delivered+=u.entries.length;
            const byProfile=new Map(env.catalogs.syntaxProfiles.map(p=>[p.id,p]));
            for(let i=0;i<u.entries.length;i++){
              const e=u.entries[i]!;
              if(!targetIds.has(e.id))continue;
              const profile=byProfile.get(u.syntaxProfileIds?.[i]??"");
              const preceding=u.entries[i-1]?.prompt.text??"";
              if(profile?.upos!=="NOUN"
                || !/^[零〇一二三四五六七八九十百千萬億兩0-9０-９]+$/u.test(preceding))continue;
              record.target++;
              record.byReading[e.id]=(record.byReading[e.id]??0)+1;
              if(record.examples.length<6)record.examples.push({seed,entryId:e.id,previous:preceding});
            }
            return JSON.stringify(u.entries.map(e=>e.id));
          };
          if(run("baseline")!==run("projected"))changed++;
        }
        results.push({scope,pairedFreshRounds:512,changedRounds:changed,
          reviewedRows:records.rows.length,
          addedSourceRoleProfiles:projection.report.addedSourceRoleProfiles,
          baseline:counts.baseline,projected:counts.projected});
      }
    }finally{
      mutable.readingEligibility=original;
    }
    console.log("READING_ROLE_BATCH_DELIVERY_JSON "+JSON.stringify(results));
  },240_000);
});
