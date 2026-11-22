import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PRACTICE_CATALOG, SYNTAX_PROFILES, COMMONNESS_TIER_THRESHOLDS } from "../src/app/generated/catalog.js";
import { selectFormalSyntaxUtterance } from "../src/curriculum/frequency-first-utterance.js";
import { createSeededRandom } from "../src/curriculum/random.js";
import { catalogsForCommonnessTiers } from "../src/product/commonness-access.js";
import {
  createProductEnvironment, createFreshProgressForEnvironment, createProductState,
} from "../src/product/session.js";
import type { ProductEnvironment, ProductProgress } from "../src/product/types.js";
import type { CatalogEntry } from "../src/core/model.js";
import type { RuntimeSyntaxProfile } from "../src/syntax/types.js";
import { PRODUCT_READING_POLICY } from "../src/readings/product-reading-policy.js";
import type { GrammarUtteranceCandidate } from "../src/grammar/types.js";

const argv=process.argv.slice(2);
if(argv.length!==4||argv[0]!=="--triage"||argv[2]!=="--output")
  throw Error("usage: tsx scripts/audit-source-pos-sentence-ab.ts --triage official-triage.json --output report.json");
interface Candidate { entryId:string;dictionarySourceStatus:string;revisedExplicitPosTags:string[];sourceSupportsSelectedUpos:boolean|null; }
interface Row { word:string;upos:string;classification:string;positiveReadings:string[];candidates:Candidate[]; }
interface SourceReport { schemaVersion:string;sourceEdition:string;productionChanged:boolean;rows:Row[]; }
const report=JSON.parse(readFileSync(resolve(argv[1]!),"utf8")) as SourceReport;
if(report.schemaVersion!=="unresolved-reading-explicit-pos-triage-v1"
  ||report.sourceEdition!=="20260929"||report.productionChanged!==false||!Array.isArray(report.rows))
  throw Error("official role-review report has wrong schema");
const whole={practice:PRACTICE_CATALOG,syntaxProfiles:SYNTAX_PROFILES};
const byEntryId=new Map(PRACTICE_CATALOG.map(e=>[e.id,e]));
const licensed=new Map<string,string>();
const reviewedRows=report.rows.filter(row=>row.classification==="singleton-explicit-pos-double-source-review");
for(const row of reviewedRows) {
  const key=row.word+"/"+row.upos;
  if(licensed.has(key)||row.positiveReadings.length!==1 || row.candidates.length<2)
    throw Error("duplicate or invalid singleton group");
  const id=row.positiveReadings[0]!;
  if(!row.candidates.some(c=>c.entryId===id) ||
    row.candidates.some(c=>!byEntryId.has(c.entryId) || byEntryId.get(c.entryId)!.prompt.text!==row.word
      || c.dictionarySourceStatus!=="both-exact"))
    throw Error("source candidates are not exact identities in original product catalog");
  if(!row.candidates.every(c=>SYNTAX_PROFILES.some(p=>p.entryId===c.entryId&&p.upos===row.upos)))
    throw Error("candidate set lacks corresponding original syntax profile");
  licensed.set(key,id);
}
if(licensed.size===0)throw Error("no source-reviewed POS singleton candidates");
const researchEligibility=(entry:CatalogEntry,profile:RuntimeSyntaxProfile,slot:unknown,previous:CatalogEntry|null)=>
  PRODUCT_READING_POLICY.readingEligibility(entry,profile,slot,previous)
  && (licensed.get(entry.prompt.text+"/"+profile.upos) === undefined
      || licensed.get(entry.prompt.text+"/"+profile.upos)===entry.id);

function generate(env:ProductEnvironment,progress:ProductProgress,trial:boolean):GrammarUtteranceCandidate {
  return selectFormalSyntaxUtterance({
    entries:env.catalogs.practice,bindingEvidence:Object.values(progress.measurements.semantic.bindings),
    mode:progress.mode,layoutId:progress.layoutId,
    history:{
      recentEntryIds:progress.selection.recentEntryIds,
      recentUtteranceIds:progress.selection.recentUtteranceIds,
      recentWrittenForms:progress.selection.recentWrittenForms,
      recentConstructionIds:progress.selection.recentConstructionIds,
    },
    policy:env.utterancePolicy,profiles:env.catalogs.syntaxProfiles,
    ...PRODUCT_READING_POLICY,
    ...(trial?{readingEligibility:researchEligibility}:{}),
    preparedFormalSyntaxLexicon:env.preparedPracticeLexicon,
    preparedFrequencyFirstEntries:env.preparedPracticeEntries,
    preparedFormalSyntaxExecution:env.preparedPracticeFormalSyntaxExecution,
    random:createSeededRandom(progress.seed+":practice:"+progress.practiceRoundsCompleted),
  }).utterance;
}
function fingerprint(u:GrammarUtteranceCandidate):string{
  return JSON.stringify([u.entries.map(e=>e.id),u.syntaxProfileIds]);
}
function run(scope:"tier1"|"all",env:ProductEnvironment){
  const profiles=new Map(env.catalogs.syntaxProfiles.map(p=>[p.id,p]));
  const oldCount=new Map<string,number>(),newCount=new Map<string,number>();
  const examples=new Map<string,string[]>();
  let changed=0,shippedMatch=true,allSuccess=0,totalOld=0,totalNew=0;
  for(let i=0;i<512;i++){
    const progress=createFreshProgressForEnvironment(env,"source-pos-sentence:"+scope+":"+i,"guided","zhuyin-standard");
    const original=generate(env,progress,false),candidate=generate(env,progress,true);
    if(i===0)shippedMatch=fingerprint(createProductState(env,progress,0).round.selection.utterance)===fingerprint(original);
    if(fingerprint(original)!==fingerprint(candidate))changed++;
    allSuccess++;totalOld+=original.entries.length;totalNew+=candidate.entries.length;
    for(const [arm,u,target] of [["old",original,oldCount],["new",candidate,newCount]] as const){
      if(u.syntaxProfileIds?.length!==u.entries.length)throw Error("missing syntax profiles");
      for(let j=0;j<u.entries.length;j++){
        const e=u.entries[j]!, p=profiles.get(u.syntaxProfileIds[j]!);
        if(!p||p.entryId!==e.id)throw Error("selected profile/entry mismatch");
        const key=e.prompt.text+"/"+p.upos,approved=licensed.get(key);
        if(approved===undefined)continue;
        if(e.id!==approved)throw Error("unlicensed source-reading role selected: "+e.id);
        target.set(key,(target.get(key)??0)+1);
        if(arm==="new"){
          const x=examples.get(key)??[];
          if(x.length<3)x.push(i+": "+u.text+" ["+e.id+"]");
          examples.set(key,x);
        }
      }
    }
  }
  if(!shippedMatch)throw Error("baseline cannot reproduce unchanged product");
  return {
    scope,draws:512,completedSentences:allSuccess,
    changedFinalSentenceSelections:changed,changedRatio:changed/512,
    oldLexicalOccurrences:totalOld,newLexicalOccurrences:totalNew,
    baselineSourceReadingOccurrences:[...oldCount.values()].reduce((a,b)=>a+b,0),
    candidateSourceReadingOccurrences:[...newCount.values()].reduce((a,b)=>a+b,0),
    selectedGroups:[...licensed.keys()].filter(k=>newCount.has(k)).map(key=>({
      wordUpos:key,baseline:oldCount.get(key)??0,candidate:newCount.get(key)??0,examples:examples.get(key)??[],
    })),
  };
}
const out={
  schemaVersion:"exact-moe-pos-sentence-ab-v1",
  claim:"RESEARCH ONLY; exact dictionary [POS] annotations are not sentence reading ground truth",
  sourceEdition:"20260929",reviewCandidateGroups:licensed.size,
  productionPolicyUnchanged:true,
  tier1:run("tier1",createProductEnvironment(catalogsForCommonnessTiers(whole,COMMONNESS_TIER_THRESHOLDS,[1]))),
  all:run("all",createProductEnvironment(whole)),
};
writeFileSync(resolve(argv[3]!),JSON.stringify(out,null,2)+"\n","utf8");
console.log("MOE_EXACT_POS_SENTENCE_AB "+JSON.stringify({
  reviewCandidateGroups:out.reviewCandidateGroups,
  tier1:{draws:out.tier1.draws,changed:out.tier1.changedFinalSentenceSelections,newOccurrences:out.tier1.candidateSourceReadingOccurrences},
  all:{draws:out.all.draws,changed:out.all.changedFinalSentenceSelections,newOccurrences:out.all.candidateSourceReadingOccurrences},
  productionPolicyUnchanged:true,
}));
