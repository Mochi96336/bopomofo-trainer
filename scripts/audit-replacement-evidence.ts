import { readFileSync, writeFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

interface Sentence { seedIndex:number; text:string|null; root:string|null; entryIds:string[] }
interface Hit { seedIndex:number; entryIndex:number; selectedEntryId:string; selectedUpos:string|null; selectedProfileId:string|null; previousEntryText:string|null; nextEntryText:string|null; alternativeEntryIds:string[] }
interface Exposure { readingEligibilityPolicy:string; sampleCount:number; successfulSentences:number; sentences:Sentence[]; hits:Hit[] }
interface Change { seedIndex:number; slot:number; priorId:string; newId:string }
interface Comparison { schemaVersion:string; changedDetails:Change[]; changedOutsideOriginallyInvalidSlot:number }
interface Evidence { entryId:string; status:string; projection:{source:string; reading:string; sourceEntryId:string}|null }
interface Coverage { schemaVersion:string; sourcePolicy:string; sampleCount:number; identities:Evidence[] }

function lexicalText(id:string):string {
  if(!id.startsWith("word:")) throw new Error("unexpected selected entry identity");
  const body=id.slice(5),at=body.lastIndexOf(":");
  if(at<=0)throw new Error("malformed selected entry identity");
  return body.slice(0,at);
}

/** Read-only. Dictionary projections are not exhaustive and cannot establish contextual sense. */
export function reviewReplacementEvidence(before:Exposure,after:Exposure,comparison:Comparison,coverage:Coverage) {
  if(before.readingEligibilityPolicy!=="standard-role-tenth-trial"
    ||after.readingEligibilityPolicy!=="standard-numeric-fen-trial"
    ||before.sampleCount!==2048||after.sampleCount!==2048
    ||before.successfulSentences!==2048||after.successfulSentences!==2048
    ||before.sentences.length!==2048||after.sentences.length!==2048
    ||!Array.isArray(after.hits)
    ||comparison.schemaVersion!=="moe-numeric-fen-paired-diff-v1"
    ||comparison.changedOutsideOriginallyInvalidSlot!==0
    ||coverage.schemaVersion!=="selected-moe-headword-coverage-v1"
    ||coverage.sourcePolicy!==after.readingEligibilityPolicy
    ||coverage.sampleCount!==2048){
    throw new Error("replacement review requires aligned final 2048-seed evidence");
  }
  if(comparison.changedDetails.length!==2)throw new Error("expected exactly two replacement slots");
  const seen=new Set<string>();
  const byIdentity=new Map(coverage.identities.map(x=>[x.entryId,x]));
  const entries=comparison.changedDetails.map(change=>{
    const {seedIndex,slot,priorId,newId}=change;
    const key=seedIndex+":"+slot;
    if(seen.has(key))throw new Error("duplicate changed lexical slot");
    seen.add(key);
    const prior=before.sentences[seedIndex],next=after.sentences[seedIndex];
    if(prior?.seedIndex!==seedIndex||next?.seedIndex!==seedIndex
      ||prior.entryIds[slot]!==priorId||next.entryIds[slot]!==newId
      ||prior.root!==next.root||prior.entryIds.length!==next.entryIds.length
      ||priorId===newId)throw new Error("changed slot or root does not match exposure");
    const changed=prior.entryIds.flatMap((id,i)=>id===next.entryIds[i]?[]:[i]);
    if(changed.length!==1||changed[0]!==slot)throw new Error("replacement has nonlocal changes");
    const hit=after.hits.find(h=>h.seedIndex===seedIndex&&h.entryIndex===slot);
    if(hit&&hit.selectedEntryId!==newId)throw new Error("selected hit identity disagrees");
    const evidence=byIdentity.get(newId);
    if(!evidence)throw new Error("replacement missing from final dictionary coverage");
    const projectionMatch=evidence.status==="matches-concised-projection"||evidence.status==="matches-revised-fallback-projection";
    return {
      seedIndex,slot,previousEntryId:priorId,replacementEntryId:newId,
      beforeSentence:prior.text,afterSentence:next.text,
      previousLexeme:slot>0?lexicalText(next.entryIds[slot-1]!):null,
      nextLexeme:slot+1<next.entryIds.length?lexicalText(next.entryIds[slot+1]!):null,
      selectedUpos:hit?.selectedUpos??null,
      selectedProfileId:hit?.selectedProfileId??null,
      alternativeReadingIds:hit?.alternativeEntryIds??[],
      dictionaryProjectionStatus:evidence.status,
      dictionaryProjection:evidence.projection,
      pronunciationEvidence:projectionMatch?"matches-partial-dictionary-projection":"needs-full-reference-review",
      contextualSense:"not-established",
      reviewRequired:true,
    };
  }).sort((a,b)=>a.seedIndex-b.seedIndex||a.slot-b.slot);
  return {
    schemaVersion:"replacement-evidence-review-v1",
    sourcePolicy:after.readingEligibilityPolicy,
    sampleCount:2048,
    changedSlotCount:entries.length,
    matchesPartialDictionaryProjection:entries.filter(x=>x.pronunciationEvidence==="matches-partial-dictionary-projection").length,
    needsFullReferenceReview:entries.filter(x=>x.pronunciationEvidence==="needs-full-reference-review").length,
    contextualSenseVerified:0,
    evidenceOnly:true,
    caveat:"Projection coverage is intentionally partial; even a matching pronunciation is not proof of the selected context's word sense. Missing projection is not an incorrect-sound label.",
    entries,
  };
}
if(process.argv[1]?.endsWith("audit-replacement-evidence.ts")) {
  const [beforePath,afterPath,comparisonPath,coveragePath,outputPath]=process.argv.slice(2);
  if(!beforePath||!afterPath||!comparisonPath||!coveragePath||!outputPath)
    throw new Error("usage: audit-replacement-evidence <before> <after> <comparison> <coverage> <output>");
  const result=reviewReplacementEvidence(
    JSON.parse(readFileSync(beforePath,"utf8")) as Exposure,
    JSON.parse(readFileSync(afterPath,"utf8")) as Exposure,
    JSON.parse(readFileSync(comparisonPath,"utf8")) as Comparison,
    JSON.parse(readFileSync(coveragePath,"utf8")) as Coverage);
  mkdirSync(dirname(outputPath),{recursive:true});
  writeFileSync(outputPath,JSON.stringify(result,null,2)+"\n");
  console.log(JSON.stringify(result,null,2));
}
