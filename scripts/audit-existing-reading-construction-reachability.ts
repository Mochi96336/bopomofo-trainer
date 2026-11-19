import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PRACTICE_CATALOG, SYNTAX_PROFILES, COMMONNESS_TIER_THRESHOLDS } from "../src/app/generated/catalog.js";
import { catalogsForCommonnessTiers } from "../src/product/commonness-access.js";
import {
  createProductEnvironment, createFreshProgressForEnvironment, createProductState,
} from "../src/product/session.js";
import { PRODUCT_READING_POLICY } from "../src/readings/product-reading-policy.js";
import { createSeededRandom } from "../src/curriculum/random.js";
import { prepareFormalSyntaxExecution } from "../src/curriculum/frequency-first-utterance.js";
import { FORMAL_SYNTAX_RULES } from "../src/syntax/grammar.js";
import { sampleStructuralDerivation, prepareStructuralSamplingContext } from "../src/syntax/sample.js";
import { buildLexicalProfileIndex, compatibleProfilesForSlot } from "../src/syntax/realize.js";
import type { CatalogEntry } from "../src/core/model.js";
import type { StructuralLexicalSlot } from "../src/syntax/derive.js";
import type { RuntimeSyntaxProfile, SyntaxFeatureName, Upos } from "../src/syntax/types.js";

/**
 * Scope: 4 previously identified reviewed CONSTRUCTION candidates, not all
 * homograph senses. Proves or falsifies syntactic frontier uniqueness and
 * searches for native grammar slots under product bounds. Matched seeded
 * product A/B tests an intentionally REDUNDANT license; these already have
 * CONSTRUCTION_READINGS in lexical-feature-match.ts.
 *
 * Zero hits in bounded sampling is "not observed", NEVER a proof of impossibility.
 * No semantic labels, no new allowed pronunciations, no production changes.
 */

type Gate = (entry: CatalogEntry, profile: RuntimeSyntaxProfile,
  slot: StructuralLexicalSlot, previous: CatalogEntry | null) => boolean;
interface Construction {
  readonly feature: string;
  readonly value: string;
  readonly entryId: string;
}
interface Candidate {
  readonly word: string;
  readonly upos: Upos;
  readonly readingEntryIds: readonly string[];
  readonly existingIdentityGatedConstructions: readonly Construction[];
}

interface Triage {
  readonly version: string;
  readonly tier1: {
    readonly blockedWordUposGroups: number;
    readonly rows: readonly (Candidate & {readonly status: string})[];
  };
}

function reviewedCandidates(data: Triage): readonly Candidate[] {
  if (data.version !== "bulk-syntax-evidence-triage-v1"
    || data.tier1.blockedWordUposGroups !== 131
    || !Array.isArray(data.tier1.rows)
    || data.tier1.rows.length !== 131) {
    throw new Error("Tier1 source census version/group counts changed");
  }
  const rows = data.tier1.rows.filter(row =>
    row.status === "existing-identity-gated-construction-to-evaluate");
  if (rows.length === 0) throw new Error("no reading-specific construction candidates");
  const keys = new Set<string>();
  for (const row of rows) {
    const key = JSON.stringify([row.word, row.upos]);
    if (keys.has(key) || row.readingEntryIds.length < 2
      || !Array.isArray(row.existingIdentityGatedConstructions)
      || row.existingIdentityGatedConstructions.length === 0) {
      throw new Error("invalid or repeated construction candidate group");
    }
    keys.add(key);
    for (const c of row.existingIdentityGatedConstructions) {
      if (!row.readingEntryIds.includes(c.entryId)
        || !["polarity", "questionType", "clauseType", "coordinationType"].includes(c.feature)
        || !c.value) {
        throw new Error("candidate feature or pinned reading identity changed");
      }
    }
  }
  return rows;
}

const args = process.argv.slice(2);
if (args.length !== 4 || args[0] !== "--triage" || args[2] !== "--output") {
  throw new Error("usage: tsx audit-existing-reading-construction-reachability.ts --triage audit.json --output report.json");
}
const triage = JSON.parse(readFileSync(resolve(args[1]!), "utf8")) as Triage;
const candidates = reviewedCandidates(triage);
const full = {practice: PRACTICE_CATALOG, syntaxProfiles: SYNTAX_PROFILES};
const tier = catalogsForCommonnessTiers(full, COMMONNESS_TIER_THRESHOLDS, [1]);
const index = buildLexicalProfileIndex(tier.practice, tier.syntaxProfiles);
const entriesById = index.entriesById;
const profileById = new Map(tier.syntaxProfiles.map(p => [p.id, p]));
const allFinalGates: readonly Gate[] = [
  PRODUCT_READING_POLICY.finalCandidateReadingEligibility,
  PRODUCT_READING_POLICY.subsequentFinalCandidateReadingEligibility,
  ...PRODUCT_READING_POLICY.additionalFinalCandidateReadingEligibilities,
];

function syntheticSlot(candidate: Candidate, c: Construction): StructuralLexicalSlot {
  return {
    kind: "lexical-slot",
    id: "audit:synthetic:" + c.feature + ":" + c.value,
    constituentKey: "audit",
    occurrenceIndex: 0,
    allowedUpos: [candidate.upos],
    requiredFunctions: [],
    requiredValencyFrames: [],
    requiredFeatures: {[c.feature]: c.value} as StructuralLexicalSlot["requiredFeatures"],
  };
}

function productGatesPass(e:CatalogEntry,p:RuntimeSyntaxProfile,s:StructuralLexicalSlot):boolean {
  return PRODUCT_READING_POLICY.readingEligibility(e,p,s,null)
    && PRODUCT_READING_POLICY.preDrawReadingEligibility(e,p,s,null)
    && allFinalGates.every(g=>g(e,p,s,null));
}

const execution = prepareFormalSyntaxExecution(1);
const samplingContext = prepareStructuralSamplingContext(FORMAL_SYNTAX_RULES,execution.bounds);
const rowResults = [];
let syntheticPassed = 0;
for (const candidate of candidates) {
  const featureResults = [];
  for (const construction of candidate.existingIdentityGatedConstructions) {
    const slot = syntheticSlot(candidate,construction);
    const licensed = compatibleProfilesForSlot(slot,index).filter(p => {
      const e = entriesById.get(p.entryId);
      return e !== undefined && e.prompt.text === candidate.word
        && p.upos === candidate.upos && productGatesPass(e,p,slot);
    });
    const remaining = PRODUCT_READING_POLICY.readingFrontierFilter(licensed,entriesById);
    const licensedIds = [...new Set(remaining.map(p=>p.entryId))].sort();
    const unique = licensedIds.length === 1 && licensedIds[0] === construction.entryId;
    if(unique) syntheticPassed++;
    // Search NATIVE structural derivations, not only an invented lexical slot.
    // A missing sample may reflect very small grammar probability.
    const observed = {successfulDerivations:0,matchedNativeSlots:0,
      matchedSlotsOnlyWithTargetReading:0,possibleCompetingReadings:0,
      examples:[] as {root:string,slotId:string,allowedUpos:readonly string[],functions:readonly string[]}[]};
    for(let seed=0;seed<96;seed++){
      const shape=sampleStructuralDerivation({
        rootCategory:"Sentence",rules:FORMAL_SYNTAX_RULES,bounds:execution.bounds,
        random:createSeededRandom("reading-role-native:"+candidate.word+"/"+candidate.upos+
          ":"+construction.feature+"/"+construction.value+":"+seed),
        maximumAttempts:4,
        isLexicalSlotReachable:s=>s.formalLiteral!==undefined
          || (s.allowedUpos.length===1 && s.allowedUpos[0]==="PUNCT")
          || compatibleProfilesForSlot(s,index).length>0,
        requiredLexicalSlot:{
          requiredFeatures:{[construction.feature]:construction.value} as StructuralLexicalSlot["requiredFeatures"],
        },
      },samplingContext);
      if(shape===null)continue;
      observed.successfulDerivations++;
      for(const nativeSlot of shape.lexicalSlots) {
        if(nativeSlot.requiredFeatures[construction.feature as SyntaxFeatureName]!==construction.value)
          continue;
        const native=compatibleProfilesForSlot(nativeSlot,index).filter(p=>{
          const e=entriesById.get(p.entryId);
          return p.upos===candidate.upos && e?.prompt.text===candidate.word
            && productGatesPass(e,p,nativeSlot);
        });
        if(native.length===0)continue;
        const nativeFrontier=PRODUCT_READING_POLICY.readingFrontierFilter(native,entriesById);
        const ids=[...new Set(nativeFrontier.map(p=>p.entryId))];
        if(ids.length===0)continue;
        observed.matchedNativeSlots++;
        if(ids.length===1 && ids[0]===construction.entryId)observed.matchedSlotsOnlyWithTargetReading++;
        else observed.possibleCompetingReadings++;
        if(observed.examples.length<3){
          observed.examples.push({
            root:shape.productionRulePath[0]??"",
            slotId:nativeSlot.id,allowedUpos:nativeSlot.allowedUpos,
            functions:nativeSlot.requiredFunctions,
          });
        }
      }
    }
    featureResults.push({feature:construction.feature,value:construction.value,
      claimedReadingId:construction.entryId,syntheticSlotLicensedReadingIds:licensedIds,
      singletonInSyntheticSlot:unique,nativeSamplingAttempts:96,native:observed,
      caveat:"No native match in bounded sampling means not observed, not mathematically unreachable"});
  }
  rowResults.push({word:candidate.word,upos:candidate.upos,
    alternativeReadings:candidate.readingEntryIds,features:featureResults});
}

const mutable = PRODUCT_READING_POLICY as unknown as {readingEligibility:Gate};
const original = mutable.readingEligibility;
const observedProbes = new Map<string,number>();
const deliver = (arm:"baseline"|"redundant-extra-gate", stats:Map<string,{
  target: number,otherReadingsSameUpos:number,examples:string[]}>,seed:number) => {
  mutable.readingEligibility=(e,p,s,prev)=>{
    const base=original(e,p,s,prev);
    if(!base)return false;
    for(const candidate of candidates){
      if(e.prompt.text!==candidate.word||p.upos!==candidate.upos)continue;
      for(const rule of candidate.existingIdentityGatedConstructions){
        if(s.requiredFeatures[rule.feature as SyntaxFeatureName]!==rule.value)continue;
        const key=JSON.stringify([candidate.word,candidate.upos,rule.feature,rule.value,arm]);
        observedProbes.set(key,(observedProbes.get(key)??0)+1);
        if(arm==="redundant-extra-gate" && e.id!==rule.entryId)return false;
      }
    }
    return true;
  };
  const env = environment;
  const progress=createFreshProgressForEnvironment(env,
    "existing-construction-paired-tier1:"+seed,"guided","standard");
  const utterance=createProductState(env,progress,0).round.selection.utterance;
  for(let i=0;i<utterance.entries.length;i++){
    const e=utterance.entries[i]!;
    const p=profileById.get(utterance.syntaxProfileIds?.[i]??"");
    if(!p)throw Error("selected output lacks runtime syntax profile");
    const group=candidates.find(c=>c.word===e.prompt.text && c.upos===p.upos);
    if(!group)continue;
    const key=group.word+"/"+group.upos;
    const stat=stats.get(key)!;
    if(group.existingIdentityGatedConstructions.some(c=>c.entryId===e.id))stat.target++;
    else stat.otherReadingsSameUpos++;
    if(stat.examples.length<4)stat.examples.push(e.id+" "+utterance.text);
  }
  return JSON.stringify([utterance.entries.map(e=>e.id),utterance.syntaxProfileIds??[]]);
};
const environment=createProductEnvironment(tier);
const output=new Map<string,{
  baseline:{target:number,otherReadingsSameUpos:number,examples:string[]},
  redundantExtraGate:{target:number,otherReadingsSameUpos:number,examples:string[]}
}>();
for(const c of candidates)output.set(c.word+"/"+c.upos,{
  baseline:{target:0,otherReadingsSameUpos:0,examples:[]},
  redundantExtraGate:{target:0,otherReadingsSameUpos:0,examples:[]},
});
const a=new Map([...output].map(([key,v])=>[key,v.baseline]));
const b=new Map([...output].map(([key,v])=>[key,v.redundantExtraGate]));
let changedRounds=0;
try{
  for(let seed=0;seed<512;seed++){
    const baseline=deliver("baseline",a,seed);
    const extra=deliver("redundant-extra-gate",b,seed);
    if(baseline!==extra)changedRounds++;
  }
}finally{mutable.readingEligibility=original;}

const report={
  schemaVersion:"existing-identity-construction-reachability-audit-v1",
  scope:"tier1",candidateGroups:candidates.length,
  syntacticFeatureCases:rowResults.reduce((n,r)=>n+r.features.length,0),
  syntheticallyUniqueFeatures:syntheticPassed,
  actualGrammarBound:execution.bounds,
  rows:rowResults,
  product:{
    pairedFirstRounds:512,
    extraGateChangedFinalRoundCount:changedRounds,
    byWordUpos:Object.fromEntries([...output]),
    sourceProbeCounts:Object.fromEntries([...observedProbes].sort(([x],[y])=>x.localeCompare(y))),
    warning:"Selected word+UPOS exposure alone does not prove which construction was selected; slot-level matches measured separately. No samples cannot prove grammatical impossibility.",
  },
  noProductPolicyChanged:true,
};
writeFileSync(resolve(args[3]!),JSON.stringify(report,null,2)+"\n","utf8");
console.log("EXISTING_CONSTRUCTION_REACHABILITY_JSON "+JSON.stringify({
  groups:report.candidateGroups,
  syntacticFeatureCases:report.syntacticFeatureCases,
  syntheticallyUniqueFeatures:report.syntheticallyUniqueFeatures,
  natives:rowResults.map(x=>({word:x.word,upos:x.upos,features:x.features.map(f=>({
    feature:f.feature,value:f.value,unique:f.singletonInSyntheticSlot,
    nativeSamples:f.native.successfulDerivations,
    nativeSlots:f.native.matchedNativeSlots,
    nativeSingleton:f.native.matchedSlotsOnlyWithTargetReading,
    nativeCompetitors:f.native.possibleCompetingReadings,
  }))})),
  product:report.product,
}));
