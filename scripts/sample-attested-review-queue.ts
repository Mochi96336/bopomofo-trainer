import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

export interface ReviewCandidate {
  readonly split: string;
  readonly sentenceId: string;
  readonly tokenId: number;
  readonly originalSentence: string;
  readonly word: string;
  readonly corpusUpos: string;
  readonly corpusHeadId: number;
  readonly corpusDependency: string;
  readonly previousWord: string | null;
  readonly nextWord: string | null;
  readonly reviewStatus: string;
}
export interface ReviewQueue {
  readonly trainQueueSize: number;
  readonly trainReviewCandidates: readonly ReviewCandidate[];
}
function score(row:ReviewCandidate) {
  return createHash("sha256").update(
    "attested-independent-review-v1|" + row.sentenceId + ":" + row.tokenId,
  ).digest("hex");
}
export function selectBlindReviewSample(queue:ReviewQueue, perGroup=8) {
  if(!Number.isSafeInteger(perGroup)||perGroup<1) throw new Error("invalid group limit");
  if(queue.trainReviewCandidates.length!==queue.trainQueueSize)throw new Error("queue length mismatch");
  const seen=new Set<string>();
  const groups=new Map<string,ReviewCandidate[]>();
  for(const row of queue.trainReviewCandidates){
    if(row.split!=="train"||row.reviewStatus!=="unlabeled")
      throw new Error("review sample only accepts unlabeled train rows");
    if(!["種","給"].includes(row.word))throw new Error("unexpected word");
    const identity=row.sentenceId+":"+row.tokenId;
    if(seen.has(identity))throw new Error("duplicate review occurrence "+identity);
    seen.add(identity);
    const group=row.word+"/"+row.corpusUpos;
    groups.set(group,[...(groups.get(group)??[]),row]);
  }
  const selected = [...groups.entries()].sort(([a],[b])=>a.localeCompare(b,"zh-Hant"))
    .map(([group,rows])=>({
      group,available:rows.length,
      // Keep all rare groups; a seeded hash ranking reduces corpus-order bias.
      sample:rows.slice().sort((a,b)=>
        score(a).localeCompare(score(b))
        || a.sentenceId.localeCompare(b.sentenceId)
        || a.tokenId-b.tokenId).slice(0,perGroup),
    }));
  return {
    schemaVersion:"attested-blind-human-review-sample-v1",
    source:"pinned GSD train-only queue",
    selection:"Stable SHA-256 ranking per written-word/oracle-UPOS group; no UD Translit or gold",
    manuallyApprovedReadings:0,
    eligibleForTrainingOrEvaluation:false,
    groups:selected,
  };
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
  const input=process.argv[2]??"data/generated/attested-standalone-unlabeled-train-queue.json";
  const output=process.argv[3]??"data/generated/attested-standalone-human-review-sample.json";
  const queue=JSON.parse(readFileSync(input,"utf8")) as ReviewQueue;
  const report=selectBlindReviewSample(queue,8);
  mkdirSync(dirname(output),{recursive:true});
  writeFileSync(output,JSON.stringify(report,null,2)+"\n","utf8");
  for(const g of report.groups){
    console.log("\n"+g.group+" ("+g.sample.length+"/"+g.available+", READINGS NOT ANNOTATED)");
    for(const row of g.sample){
      console.log(row.sentenceId+"#"+row.tokenId+
        " ["+row.previousWord+"|"+row.word+"|"+row.nextWord+"]"+
        " head="+row.corpusHeadId+" rel="+row.corpusDependency);
      console.log("  "+row.originalSentence.slice(0,220));
    }
  }
}
