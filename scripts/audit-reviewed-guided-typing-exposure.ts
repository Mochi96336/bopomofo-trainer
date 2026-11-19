import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  PRACTICE_CATALOG, SYNTAX_PROFILES, COMMONNESS_TIER_THRESHOLDS,
} from "../src/app/generated/catalog.js";
import { catalogsForCommonnessTiers } from "../src/product/commonness-access.js";
import { createProductEnvironment, createFreshProgressForEnvironment, createProductState } from "../src/product/session.js";
import { selectFormalSyntaxUtterance } from "../src/curriculum/frequency-first-utterance.js";
import { createSeededRandom } from "../src/curriculum/random.js";
import { PRODUCT_READING_POLICY } from "../src/readings/product-reading-policy.js";
import { compileGuidedTypingFrontier, parseGuidedTypingManifest } from "../src/readings/reviewed-guided-typing-frontier.js";
import type { GrammarUtteranceCandidate } from "../src/grammar/types.js";
import type { ProductEnvironment, ProductProgress } from "../src/product/types.js";

const args=process.argv.slice(2);
if(args.length!==2 || args[0]!=="--output" || !args[1])
  throw new Error("usage: tsx scripts/audit-reviewed-guided-typing-exposure.ts --output report.json");
const manifest = parseGuidedTypingManifest(JSON.parse(readFileSync(
  new URL("../data/readings/reviewed-guided-typing-readings.json",import.meta.url),"utf8"
)) as unknown);
const full={practice:PRACTICE_CATALOG,syntaxProfiles:SYNTAX_PROFILES};
const compiled=compileGuidedTypingFrontier(full.practice,full.syntaxProfiles,manifest);
const licensed=compiled.licensedWordUposGroups;
const groupIds = new Map(manifest.groups.map(g=>[
  JSON.stringify([g.word,g.upos]),new Set(g.readings.map(r=>r.entryId))
]));
function selected(
  env:ProductEnvironment,progress:ProductProgress,
  filter:ReturnType<typeof compiled.filterForMode>,
):GrammarUtteranceCandidate{
  return selectFormalSyntaxUtterance({
    entries:env.catalogs.practice,
    bindingEvidence:Object.values(progress.measurements.semantic.bindings),
    mode:progress.mode,layoutId:progress.layoutId,
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
  return JSON.stringify([utterance.entries.map(e=>e.id),utterance.syntaxProfileIds??[]]);
}
function audit(scope:"tier1"|"all",env:ProductEnvironment){
  const byProfileId=new Map(env.catalogs.syntaxProfiles.map(p=>[p.id,p]));
  const byArm={
    baseline:new Map<string,{count:number,readings:Map<string,number>,examples:string[]}>(),
    reviewed:new Map<string,{count:number,readings:Map<string,number>,examples:string[]}>(),
  };
  for(const key of licensed)for(const target of Object.values(byArm)){
    target.set(key,{count:0,readings:new Map(),examples:[]});
  }
  const countArm=(arm:"baseline"|"reviewed",utt:GrammarUtteranceCandidate,seed:number)=>{
    if(utt.syntaxProfileIds?.length!==utt.entries.length)throw Error("missing final syntax profiles");
    for(let i=0;i<utt.entries.length;i++){
      const entry=utt.entries[i]!;
      const profile=byProfileId.get(utt.syntaxProfileIds![i]!);
      if(!profile)throw Error("unknown selected profile");
      const key=JSON.stringify([entry.prompt.text,profile.upos]);
      const target=byArm[arm].get(key);
      if(!target)continue;
      if(!groupIds.get(key)?.has(entry.id))
        throw Error("reviewed typing target without exact reading evidence: "+entry.id);
      target.count++;
      target.readings.set(entry.id,(target.readings.get(entry.id)??0)+1);
      if(target.examples.length<4)target.examples.push(seed+": "+entry.id+" "+utt.text);
    }
  };
  const rounds=512;
  let changed=0,baselineTotal=0,reviewedTotal=0;
  for(let seed=0;seed<rounds;seed++){
    const progress=createFreshProgressForEnvironment(env,"guided-reading-paired:"+scope+":"+seed,"guided","standard");
    const base=selected(env,progress,PRODUCT_READING_POLICY.readingFrontierFilter);
    // The actual product function must be identical to our baseline, avoiding
    // a mistaken comparison across different draw policies or seed namespaces.
    if(seed===0){
      const product=createProductState(env,progress,0).round.selection.utterance;
      if(identity(product)!==identity(base))throw Error("baseline cannot reproduce shipping product");
    }
    const trial=selected(env,progress,compiled.filterForMode("guided"));
    if(identity(base)!==identity(trial))changed++;
    baselineTotal+=base.entries.length;
    reviewedTotal+=trial.entries.length;
    countArm("baseline",base,seed);
    countArm("reviewed",trial,seed);
  }
  const rows=licensed.map(key=>{
    const b=byArm.baseline.get(key)!,t=byArm.reviewed.get(key)!;
    return {
      group:JSON.parse(key), baselineOccurrences:b.count,
      reviewedOccurrences:t.count,
      distinctReviewedReadingIds:t.readings.size,
      selectedReadings:Object.fromEntries([...t.readings].sort(([a],[b])=>a.localeCompare(b))),
      examples:t.examples,
    };
  });
  return {
    scope,pairedFreshGuidedFirstRounds:rounds,
    baselineLexicalOccurrences:baselineTotal,
    reviewedLexicalOccurrences:reviewedTotal,
    changedFinalEntryProfileSequences:changed,
    baselineTargetOccurrences:rows.reduce((sum,row)=>sum+row.baselineOccurrences,0),
    reviewedTargetOccurrences:rows.reduce((sum,row)=>sum+row.reviewedOccurrences,0),
    rows,
  };
}
const report={
  schemaVersion:"reviewed-guided-typing-ab-v1",
  purpose:"Explicitly visible Bopomofo keyboard practice only; neither free alternation nor correct reading for arbitrary semantic sentence.",
  licensedGroups:licensed,
  tier1:audit("tier1",createProductEnvironment(
    catalogsForCommonnessTiers(full,COMMONNESS_TIER_THRESHOLDS,[1]))),
  all:audit("all",createProductEnvironment(full)),
  recallFrontierUnchanged:compiled.filterForMode("recall")===PRODUCT_READING_POLICY.readingFrontierFilter,
  noProductionPolicyChanges:true,
};
if(!report.recallFrontierUnchanged)throw new Error("recall unexpectedly changed");
writeFileSync(resolve(args[1]!),JSON.stringify(report,null,2)+"\n","utf8");
console.log("REVIEWED_GUIDED_TYPING_AB_JSON "+JSON.stringify({
  tier1:((({scope,pairedFreshGuidedFirstRounds,changedFinalEntryProfileSequences,baselineTargetOccurrences,reviewedTargetOccurrences,rows})=>({scope,pairedFreshGuidedFirstRounds,changedFinalEntryProfileSequences,baselineTargetOccurrences,reviewedTargetOccurrences,readings:rows.map(r=>({group:r.group,selectedReadings:r.selectedReadings}))}))(report.tier1)),
  all:((({scope,pairedFreshGuidedFirstRounds,changedFinalEntryProfileSequences,baselineTargetOccurrences,reviewedTargetOccurrences,rows})=>({scope,pairedFreshGuidedFirstRounds,changedFinalEntryProfileSequences,baselineTargetOccurrences,reviewedTargetOccurrences,readings:rows.map(r=>({group:r.group,selectedReadings:r.selectedReadings}))}))(report.all)),
  recallFrontierUnchanged:report.recallFrontierUnchanged,
  noProductionPolicyChanges:true,
}));
