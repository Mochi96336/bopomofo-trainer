import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { createSeededRandom, weightedPick } from "../src/curriculum/random.js";
import {
  FREQUENCY_FIRST_UTTERANCE_POLICY,
  scoreFrequencyFirstEntry,
} from "../src/curriculum/frequency-first-utterance.js";
import type { CatalogEntry } from "../src/core/model.js";
import type { LearnerBindingEvidence } from "../src/curriculum/types.js";

interface Candidate {
  id: string;
  source: {split: "train" | "dev" | "test"; sent_id: string};
  text: string;
  contextSpan: string;
  targetChar: string;
  reading: string;
  targetToken: string;
  sense: string;
  reviewStatus: string;
  selectionEligible: boolean;
}
interface Data {schemaVersion:string;metadata:{selectionEligible:boolean};records:Candidate[]}
const input = "data/research/attested-polyphonic-context-candidates.json";
const output = process.argv[2] ?? "data/generated/attested-candidate-selection-prototype.json";
const parsed = JSON.parse(readFileSync(input,"utf8")) as Data;
if (parsed.schemaVersion !== "attested-polyphonic-context-candidates-v1") throw new Error("unknown candidate schema");
if (parsed.metadata.selectionEligible || parsed.records.some(r => r.selectionEligible)) {
  throw new Error("pending human reading-review data must remain outside production");
}
const ids=new Set<string>();
for(const row of parsed.records){
  if(ids.has(row.id))throw new Error("duplicate source record "+row.id);
  ids.add(row.id);
  if(!row.source.sent_id || !row.text.includes(row.contextSpan) || !row.contextSpan.includes(row.targetChar)
    || !/^ㄅ|^ㄆ|^ㄇ|^ㄈ|^ㄉ|^ㄊ|^ㄋ|^ㄌ|^ㄍ|^ㄎ|^ㄏ|^ㄐ|^ㄑ|^ㄒ|^ㄓ|^ㄔ|^ㄕ|^ㄖ|^ㄗ|^ㄘ|^ㄙ|^ㄧ|^ㄨ|^ㄩ|^ㄚ|^ㄛ|^ㄜ|^ㄝ|^ㄞ|^ㄟ|^ㄠ|^ㄡ|^ㄢ|^ㄣ|^ㄤ|^ㄥ|^ㄦ/.test(row.reading)
    || !/^tone:[1-5]$/.test(row.targetToken)
    || row.reviewStatus !== "pending-independent-reading-review") {
    throw new Error("invalid candidate metadata "+row.id);
  }
}
// The auditable prototype uses only TRAIN candidates. DEV and TEST are held
// out for future unseen-context evaluation; there are no train/validation
// leaks into a measured learning effectiveness claim.
const train=parsed.records.filter(r=>r.source.split==="train");
if (train.length<3)throw new Error("insufficient candidate pool");
const mode="guided",layoutId="standard";
type Cohort = "no-errors" | "weak-third-tone" | "weak-fourth-tone";
const cohorts:readonly Cohort[]=["no-errors","weak-third-tone","weak-fourth-tone"];
function evidence(cohort:Cohort):readonly LearnerBindingEvidence[]{
  const tokenId=cohort==="weak-third-tone"?"tone:3":cohort==="weak-fourth-tone"?"tone:4":null;
  return tokenId===null?[]:[{scope:{mode,layoutId,tokenId},attempts:16,errors:12,
    timingSamples:0,currentTimeToTypeMs:null,bestTimeToTypeMs:null}];
}
function makeEntry(row:Candidate):CatalogEntry{
  // This is a FOCAL CHARACTER scoring proxy, not an encoded entire-sentence
  // transcription: no non-focal syllable tokens are counted or claimed.
  return {id:"verified-proxy:"+row.id,prompt:{text:row.targetChar,locale:"zh-TW"},
    syllables:[{tokens:[row.targetToken]}],tags:["research-simulation"],provenanceIds:[row.id]};
}
const entries=train.map(makeEntry);
const samples=512;
const summary:Record<Cohort,{counts:Record<string,number>;toneCounts:Record<string,number>;sampleSourceIds:string[]}> =
  Object.fromEntries(cohorts.map(c=>[c,{counts:{},toneCounts:{},sampleSourceIds:[]}])) as Record<Cohort,{counts:Record<string,number>;toneCounts:Record<string,number>;sampleSourceIds:string[]}>;
for (const cohort of cohorts){
  const weights=entries.map((entry,i)=>{
    const score=scoreFrequencyFirstEntry(entry,{
      entries, bindingEvidence:evidence(cohort),mode,layoutId,
      history:{recentEntryIds:[],recentUtteranceIds:[],recentTemplateIds:[]},
      policy:FREQUENCY_FIRST_UTTERANCE_POLICY,
    });
    if(!Number.isFinite(score.totalWeight)||score.totalWeight<=0)throw new Error("invalid model score "+train[i]!.id);
    return {value:train[i]!,weight:score.totalWeight};
  });
  for(let seed=0;seed<samples;seed++){
    const selected=weightedPick(weights,createSeededRandom("attested-fixed-"+seed));
    const row=summary[cohort];row.counts[selected.id]=(row.counts[selected.id]??0)+1;
    row.toneCounts[selected.targetToken]=(row.toneCounts[selected.targetToken]??0)+1;
    if(seed<8)row.sampleSourceIds.push(selected.id);
  }
}
for(const cohort of cohorts){
  if(Object.values(summary[cohort].counts).reduce((a,b)=>a+b,0)!==samples)throw new Error("bad selected counts");
}
const report={
  schemaVersion:"attested-fixed-reading-selection-research-v1",
  samplesPerCohort:samples,trainCandidates:train.length,
  excludedHeldOutCandidates:parsed.records.length-train.length,
  sourceTextOrigin:"verbatim UD Chinese GSD by sent_id",
  pronunciationStatus:"provisional manually assigned; NOT independently verified",
  simulationOnly:true,
  selectionMechanism:"real scoreFrequencyFirstEntry + weightedPick with frozen seeds, focal syllable only",
  limitation:"A focal-character-only entry score proxy, NOT production sentence-level scoring; does not evaluate sentence naturalness, real comprehension or user outcomes.",
  cohorts:summary,
};
mkdirSync(dirname(output),{recursive:true});
writeFileSync(output,JSON.stringify(report,null,2)+"\n");
console.log(JSON.stringify({samplesPerCohort:samples,trainCandidates:train.length,excludedHeldOutCandidates:report.excludedHeldOutCandidates,
  toneCounts:Object.fromEntries(cohorts.map(c=>[c,summary[c].toneCounts]))},null,2));
