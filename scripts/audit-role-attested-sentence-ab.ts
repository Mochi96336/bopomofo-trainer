import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PRACTICE_CATALOG, SYNTAX_PROFILES, COMMONNESS_TIER_THRESHOLDS } from "../src/app/generated/catalog.js";
import { selectFormalSyntaxUtterance } from "../src/curriculum/frequency-first-utterance.js";
import { createSeededRandom } from "../src/curriculum/random.js";
import { catalogsForCommonnessTiers } from "../src/product/commonness-access.js";
import { createProductEnvironment, createFreshProgressForEnvironment, createProductState } from "../src/product/session.js";
import type { ProductEnvironment, ProductProgress } from "../src/product/types.js";
import { PRODUCT_READING_POLICY } from "../src/readings/product-reading-policy.js";
import {
  allowReviewedRoleReadings, excludeUnresolvedReadingGroups,
  REVIEWED_READING_ROLE_FRONTIERS,
} from "../src/readings/reading-frontier.js";
import type { GrammarUtteranceCandidate } from "../src/grammar/types.js";

const argv=process.argv.slice(2);
if(argv.length!==2 || argv[0]!=="--output" || !argv[1])throw Error("usage: tsx scripts/audit-role-attested-sentence-ab.ts --output result.json");

const full={practice:PRACTICE_CATALOG,syntaxProfiles:SYNTAX_PROFILES};
const reviews=new Map(REVIEWED_READING_ROLE_FRONTIERS.map(row=>[
  row.word+"/"+row.upos,new Set<string>(row.readings),
]));

function generate(
  env:ProductEnvironment, progress:ProductProgress,
  filter:typeof excludeUnresolvedReadingGroups,
):GrammarUtteranceCandidate {
  return selectFormalSyntaxUtterance({
    entries:env.catalogs.practice,
    bindingEvidence:Object.values(progress.measurements.semantic.bindings),
    mode:progress.mode,
    layoutId:progress.layoutId,
    history:{
      recentEntryIds:progress.selection.recentEntryIds,
      recentUtteranceIds:progress.selection.recentUtteranceIds,
      recentWrittenForms:progress.selection.recentWrittenForms,
      recentConstructionIds:progress.selection.recentConstructionIds,
    },
    policy:env.utterancePolicy,
    profiles:env.catalogs.syntaxProfiles,
    ...PRODUCT_READING_POLICY,
    readingFrontierFilter:filter,
    preparedFormalSyntaxLexicon:env.preparedPracticeLexicon,
    preparedFrequencyFirstEntries:env.preparedPracticeEntries,
    preparedFormalSyntaxExecution:env.preparedPracticeFormalSyntaxExecution,
    random:createSeededRandom(progress.seed+":practice:"+progress.practiceRoundsCompleted),
  }).utterance;
}
function identity(utterance:GrammarUtteranceCandidate):string{
  return JSON.stringify([utterance.entries.map(x=>x.id),utterance.syntaxProfileIds]);
}
function audit(scope:"tier1"|"all",env:ProductEnvironment) {
  const byProfile=new Map(env.catalogs.syntaxProfiles.map(p=>[p.id,p]));
  const selected=new Map<string,Map<string,number>>();
  const examples=new Map<string,string[]>();
  for(const key of reviews.keys()){selected.set(key,new Map());examples.set(key,[]);}
  let changed=0,oldTotal=0,newTotal=0,targetCount=0,successful=0;
  const draws=512;
  for(let n=0;n<draws;n++){
    const progress=createFreshProgressForEnvironment(env,"role-attested-pair:"+scope+":"+n,"guided","zhuyin-standard");
    const original=generate(env,progress,excludeUnresolvedReadingGroups);
    const trial=generate(env,progress,allowReviewedRoleReadings);
    if(n===0){
      const shipped=createProductState(env,progress,0).round.selection.utterance;
      if(identity(shipped)!==identity(trial))throw Error("candidate does not reproduce actual product selector");
    }
    successful++;
    oldTotal+=original.entries.length;
    newTotal+=trial.entries.length;
    if(identity(original)!==identity(trial))changed++;
    if(trial.syntaxProfileIds?.length!==trial.entries.length)throw Error("final profile alignment lost");
    for(let i=0;i<trial.entries.length;i++){
      const e=trial.entries[i]!;
      const p=byProfile.get(trial.syntaxProfileIds[i]!);
      if(p===undefined||p.entryId!==e.id)throw Error("selected entry/profile mismatch");
      const key=e.prompt.text+"/"+p.upos;
      const allowed=reviews.get(key);
      if(allowed===undefined)continue;
      if(!allowed.has(e.id))throw Error("unauthorized role reading selected: "+e.id);
      targetCount++;
      const frequency=selected.get(key)!;
      frequency.set(e.id,(frequency.get(e.id)??0)+1);
      const list=examples.get(key)!;
      if(list.length<4)list.push(n+": "+trial.text+" ["+e.id+"]");
    }
  }
  return {
    scope,draws,successfulSentences:successful,
    changedFinalSentenceSelections:changed,
    changedSelectionRatio:changed/draws,
    baselineLexicalOccurrences:oldTotal,trialLexicalOccurrences:newTotal,
    attestedTargetOccurrences:targetCount,
    reviewedGroups:[...reviews.keys()].map(key=>({
      wordUpos:key,
      selectedReadings:Object.fromEntries([...(selected.get(key)??new Map())].sort(([a],[b])=>a.localeCompare(b))),
      examples:examples.get(key)??[],
    })),
  };
}
const report={
  schemaVersion:"same-sentence-role-attested-paired-audit-v1",
  policy:"same existing sentence generator and catalog; no new UI/exercise/word list; exact pronunciation-role attestation, no sentence semantics inference",
  licensedWordUposPairs:[...reviews.keys()],
  tier1:audit("tier1",createProductEnvironment(catalogsForCommonnessTiers(full,COMMONNESS_TIER_THRESHOLDS,[1]))),
  all:audit("all",createProductEnvironment(full)),
  baselineUnchanged:excludeUnresolvedReadingGroups!==allowReviewedRoleReadings,
};
writeFileSync(resolve(argv[1]!),JSON.stringify(report,null,2)+"\n","utf8");
console.log("ROLE_ATTESTED_SENTENCE_AB "+JSON.stringify(report));
