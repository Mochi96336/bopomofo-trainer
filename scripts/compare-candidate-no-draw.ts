import { readFileSync,writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { catalogEntryId } from "../src/core/catalog-entry-id.js";

export interface SeedSentence {
  readonly seedIndex:number;
  readonly text:string|null;
  readonly root:string|null;
  readonly entryIds:readonly string[];
}
export interface TargetHit {
  readonly seedIndex:number;
  readonly text:string;
  readonly selectedUpos:string|null;
  readonly selectedEntryId:string;
}
export interface NoDrawAudit {
  readonly readingEligibilityPolicy:string;
  readonly sampleCount:number;
  readonly successfulSentences:number;
  readonly failedSentences:number;
  readonly seedNamespace:string;
  readonly catalogEntryCount:number;
  readonly sentences:readonly SeedSentence[];
  readonly hits:readonly TargetHit[];
}
const flags=[
  {word:"種",upos:"NOUN",id:catalogEntryId("種","ㄓㄨㄥ4")},
  {word:"給",upos:"VERB",id:catalogEntryId("給","ㄐㄧ3")},
] as const;
function flagged(hit:TargetHit) {
  return flags.some(x=>hit.text===x.word
    && hit.selectedUpos===x.upos&&hit.selectedEntryId===x.id);
}
function identity(sentence:SeedSentence) {
  return JSON.stringify([sentence.text,sentence.root,sentence.entryIds]);
}
function verify(population:NoDrawAudit,policy:string,origin:NoDrawAudit) {
  if(population.readingEligibilityPolicy!==policy
    ||population.sampleCount!==2048||population.successfulSentences!==2048
    ||population.failedSentences!==0||population.sentences.length!==2048
    ||population.seedNamespace!==origin.seedNamespace
    ||population.catalogEntryCount!==origin.catalogEntryCount)
    throw new Error("incomparable or incomplete 2048-seed population: "+policy);
  for(let seed=0;seed<2048;seed++){
    const s=population.sentences[seed]!;
    if(s.seedIndex!==seed||s.text===null)throw new Error("noncanonical or failed seed: "+seed);
  }
  for(const h of population.hits){
    if(!population.sentences[h.seedIndex]?.entryIds.includes(h.selectedEntryId))
      throw new Error("untraceable exact selected pronunciation identity: "+h.seedIndex);
  }
}
export function compareSingletonNoDraw(
  baseline:NoDrawAudit,
  previous:NoDrawAudit,
  noDraw:NoDrawAudit,
) {
  verify(baseline,"reviewed-roles",baseline);
  verify(previous,"candidate-risk-abstention-preserve-word-trial",baseline);
  verify(noDraw,"candidate-risk-abstention-singleton-no-draw-trial",baseline);
  const originals=baseline.hits.filter(flagged);
  if(originals.length===0)throw new Error("pinned population contains no risk candidates");
  const seeds=new Set(originals.map(x=>x.seedIndex));
  if(seeds.size!==originals.length)throw new Error("duplicate flagged occurrences need explicit occurrence ID");
  if(previous.hits.some(flagged)||noDraw.hits.some(flagged))
    throw new Error("the proposed candidate policy retained a predeclared risky reading");
  const changed=(trial:NoDrawAudit)=>{
    const indexes:number[]=[];
    for(let i=0;i<2048;i++){
      if(identity(baseline.sentences[i]!)!==identity(trial.sentences[i]!)){
        if(!seeds.has(i))throw new Error("unrelated seed drift: "+i);
        indexes.push(i);
      }
    }
    return indexes;
  };
  const beforeChanged=changed(previous),afterChanged=changed(noDraw);
  const hasWord=(report:NoDrawAudit,seed:number,word:string)=>
    report.hits.some(h=>h.seedIndex===seed&&h.text===word);
  const cases=originals.map(hit=>{
    if(!hasWord(previous,hit.seedIndex,hit.text))
      throw new Error("previous preserve-word trial dropped target");
    if(!hasWord(noDraw,hit.seedIndex,hit.text))
      throw new Error("no-draw trial dropped target");
    const first=baseline.sentences[hit.seedIndex]!;
    const old=previous.sentences[hit.seedIndex]!;
    const now=noDraw.sentences[hit.seedIndex]!;
    return {
      seedIndex:hit.seedIndex,
      originalWord:hit.text,
      originalSelectedReadingId:hit.selectedEntryId,
      originalSentence:first.text,
      previousRescueSentence:old.text,
      singletonRescueSentence:now.text,
      previousSentenceUnchanged:old.text===first.text,
      newSentenceUnchanged:now.text===first.text,
      previousWholeSentenceIdentityUnchanged:identity(old)===identity(first),
      newWholeSentenceIdentityUnchanged:identity(now)===identity(first),
      newSelectedTargetReadingIds:noDraw.hits.filter(h=>
        h.seedIndex===hit.seedIndex&&h.text===hit.text).map(h=>h.selectedEntryId),
      independentlyVerifiedCorrectReading:false,
      independentlyVerifiedSentenceNaturalness:false,
    };
  });
  const preservedBefore=cases.filter(x=>x.previousSentenceUnchanged).length;
  const preservedAfter=cases.filter(x=>x.newSentenceUnchanged).length;
  if(preservedAfter<preservedBefore)
    throw new Error("no-extra-RNG trial worsened sentence preservation");
  return {
    schemaVersion:"candidate-risk-abstention-no-extra-rng-comparison-v1",
    samples:2048,
    originalFlaggedCandidateCount:originals.length,
    newlyFlaggedCandidateCount:noDraw.hits.filter(flagged).length,
    originalTargetWordsDropped:0,
    unrelatedSeedDrift:0,
    beforeChangedSeedCount:beforeChanged.length,
    afterChangedSeedCount:afterChanged.length,
    previousIdenticalWrittenSentences:preservedBefore,
    singletonNoDrawIdenticalWrittenSentences:preservedAfter,
    previousIdenticalFullEntryIds:cases.filter(x=>x.previousWholeSentenceIdentityUnchanged).length,
    singletonIdenticalFullEntryIds:cases.filter(x=>x.newWholeSentenceIdentityUnchanged).length,
    cases,
    approvedForProduct:false,
    independentHeldoutAccuracy:null,
    note:"Same written text is not evidence of a correct phonetic sense. The selected target identity changes; exact original entryIds SHOULD differ. This compares collateral lexical changes only.",
  };
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  const [original,previous,newTrial,out]=process.argv.slice(2);
  if(!original||!previous||!newTrial||!out)
    throw new Error("usage: tsx scripts/compare-candidate-no-draw.ts <baseline> <prior-preserve> <singleton> <out>");
  const result=compareSingletonNoDraw(
    JSON.parse(readFileSync(original,"utf8")) as NoDrawAudit,
    JSON.parse(readFileSync(previous,"utf8")) as NoDrawAudit,
    JSON.parse(readFileSync(newTrial,"utf8")) as NoDrawAudit,
  );
  writeFileSync(out,JSON.stringify(result,null,2)+"\n","utf8");
  console.log(JSON.stringify({
    samples:result.samples,
    originalFlaggedCandidateCount:result.originalFlaggedCandidateCount,
    newlyFlaggedCandidateCount:result.newlyFlaggedCandidateCount,
    originalTargetWordsDropped:result.originalTargetWordsDropped,
    unrelatedSeedDrift:result.unrelatedSeedDrift,
    previousIdenticalWrittenSentences:result.previousIdenticalWrittenSentences,
    singletonNoDrawIdenticalWrittenSentences:result.singletonNoDrawIdenticalWrittenSentences,
    beforeChangedSeedCount:result.beforeChangedSeedCount,
    afterChangedSeedCount:result.afterChangedSeedCount,
    independentHeldoutAccuracy:result.independentHeldoutAccuracy,
  },null,2));
}
