import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { PRACTICE_CATALOG, SYNTAX_PROFILES, COMMONNESS_TIER_THRESHOLDS } from "../src/app/generated/catalog.js";
import { catalogsForCommonnessTiers } from "../src/product/commonness-access.js";
import {
  createProductEnvironment, createFreshProgressForEnvironment, createProductState,
} from "../src/product/session.js";

interface PendingRow {
  readonly word: string;
  readonly upos: string;
  readonly readingEntryIds: readonly string[];
  readonly directCompatibleCount: number;
  readonly directSingleReadingCount: number;
  readonly directMultipleReadingCount: number;
  readonly pronunciationLicensed: false;
}
interface PendingReport {
  readonly schemaVersion: string;
  readonly pendingGroups: number;
  readonly rows: readonly PendingRow[];
  readonly productionPolicyChanged: false;
}

/**
 * Read-only, real selected Tier1 exposure for every pending polyphone group.
 * No new reading is activated. A selected word/UPOS does NOT prove its reading
 * in the sentence: no independent gold pronunciation or selected feature label.
 */
const args=process.argv.slice(2);
if(args.length!==4 || args[0]!=="--pending" || args[2]!=="--output")
  throw new Error("usage: tsx scripts/audit-pending-tier1-delivered-exposure.ts --pending pending-tier1-grammar-slots.json --output result.json");
const pending=JSON.parse(readFileSync(resolve(args[1]!),"utf8")) as PendingReport;
if(pending.schemaVersion!=="pending-tier1-direct-grammar-slots-v1"
  || pending.pendingGroups!==116 || pending.rows.length!==116 || pending.productionPolicyChanged!==false)
  throw new Error("unexpected pending Tier1 population or changed grammar audit");
const groupByKey=new Map<string,{
  word:string;upos:string;readingEntryIds:readonly string[];
  directCompatibleCount:number;directSingleReadingCount:number;
  directMultipleReadingCount:number;occurrences:number;rounds:number;
  readingIdCounts:Map<string,number>;samples:string[];
}>();
for(const row of pending.rows){
  const key=JSON.stringify([row.word,row.upos]);
  if(groupByKey.has(key) || row.pronunciationLicensed!==false
    || row.readingEntryIds.length<2 || new Set(row.readingEntryIds).size!==row.readingEntryIds.length
    || row.directSingleReadingCount!==0)
    throw new Error("invalid, prelicensed, duplicated or newly singleton pending group: "+key);
  groupByKey.set(key,{
    word:row.word,upos:row.upos,readingEntryIds:row.readingEntryIds,
    directCompatibleCount:row.directCompatibleCount,
    directSingleReadingCount:row.directSingleReadingCount,
    directMultipleReadingCount:row.directMultipleReadingCount,
    occurrences:0,rounds:0,readingIdCounts:new Map(),samples:[],
  });
}
const full={practice:PRACTICE_CATALOG,syntaxProfiles:SYNTAX_PROFILES};
const tier=catalogsForCommonnessTiers(full,COMMONNESS_TIER_THRESHOLDS,[1]);
const env=createProductEnvironment(tier);
const profiles=new Map(tier.syntaxProfiles.map(p=>[p.id,p]));
const rounds=2048;
let lexicalOccurrences=0;
let selectedPendingOccurrences=0;
let roundsContainingPending=0;
const distinctEntryIds=new Set<string>();
for(let seed=0;seed<rounds;seed++){
  const progress=createFreshProgressForEnvironment(env,"pending-tier1-delivery:"+seed,"guided","standard");
  const utterance=createProductState(env,progress,0).round.selection.utterance;
  if(!utterance.syntaxProfileIds || utterance.syntaxProfileIds.length!==utterance.entries.length)
    throw new Error("product round did not retain per-token selected syntax profiles");
  const appeared=new Set<string>();
  for(let i=0;i<utterance.entries.length;i++){
    const entry=utterance.entries[i]!;
    distinctEntryIds.add(entry.id);
    lexicalOccurrences++;
    const profile=profiles.get(utterance.syntaxProfileIds[i]!);
    if(!profile) throw new Error("unknown selected syntax profile");
    const key=JSON.stringify([entry.prompt.text,profile.upos]);
    const row=groupByKey.get(key);
    if(!row)continue;
    if(!row.readingEntryIds.includes(entry.id))
      throw new Error("selected reading not in compiled conflicting group: "+entry.id);
    row.occurrences++;
    row.readingIdCounts.set(entry.id,(row.readingIdCounts.get(entry.id)??0)+1);
    if(row.samples.length<2)row.samples.push(entry.id+" "+utterance.text);
    selectedPendingOccurrences++;
    appeared.add(key);
  }
  if(appeared.size>0)roundsContainingPending++;
  for(const key of appeared) groupByKey.get(key)!.rounds++;
}
const rows=[...groupByKey.values()].map(row=>({
  word:row.word,upos:row.upos,readingEntryIds:row.readingEntryIds,
  directCompatibleCount:row.directCompatibleCount,
  directSingleReadingCount:row.directSingleReadingCount,
  directMultipleReadingCount:row.directMultipleReadingCount,
  deliveredOccurrences:row.occurrences,
  deliveredRoundCount:row.rounds,
  selectedReadingIdCounts:Object.fromEntries([...row.readingIdCounts].sort(([a],[b])=>a.localeCompare(b))),
  samples:row.samples,
  interpretation:row.occurrences===0
    ?"not-observed-in-bounded-product-selection; not proven unreachable"
    :"native-product-selected-entry; pronunciation correctness not independently proven",
  productionReadingLicensed:false,
})).sort((a,b)=>b.deliveredOccurrences-a.deliveredOccurrences || a.word.localeCompare(b.word,"zh-Hant"));
const report={
  schemaVersion:"pending-tier1-real-delivery-v1",
  source:"compiled current production Tier1 grammar, catalog, and reading policy",
  policy:"research-only, zero reading activations. Selection counts are not gold pronunciation labels.",
  baselineFreshFirstRounds:rounds,
  lexicalOccurrences,
  distinctSelectedEntryIds:distinctEntryIds.size,
  selectedPendingOccurrences,
  roundsContainingPending,
  totalPendingGroups:rows.length,
  groupsObservedInRealSelection:rows.filter(x=>x.deliveredOccurrences>0).length,
  groupsNotObservedInRealSelection:rows.filter(x=>x.deliveredOccurrences===0).length,
  zeroDirectCompatibleGroups:rows.filter(x=>x.directCompatibleCount===0).length,
  zeroDirectSingletonGroups:rows.filter(x=>x.directSingleReadingCount===0).length,
  rows,productionPolicyChanged:false,
};
writeFileSync(resolve(args[3]!),JSON.stringify(report,null,2)+"\n","utf8");
console.log("PENDING_TIER1_REAL_DELIVERY_JSON "+JSON.stringify({
  baselineFreshFirstRounds:report.baselineFreshFirstRounds,
  lexicalOccurrences:report.lexicalOccurrences,
  selectedPendingOccurrences:report.selectedPendingOccurrences,
  roundsContainingPending:report.roundsContainingPending,
  groupsObservedInRealSelection:report.groupsObservedInRealSelection,
  groupsNotObservedInRealSelection:report.groupsNotObservedInRealSelection,
  zeroDirectCompatibleGroups:report.zeroDirectCompatibleGroups,
  zeroDirectSingletonGroups:report.zeroDirectSingletonGroups,
  topObserved:report.rows.filter(r=>r.deliveredOccurrences>0).slice(0,20).map(r=>({
    word:r.word,upos:r.upos,count:r.deliveredOccurrences,readings:r.selectedReadingIdCounts,
  })),
  productionPolicyChanged:false,
}));
