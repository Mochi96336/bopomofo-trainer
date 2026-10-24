import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { gitBlobSha, parseConlluSentences } from "./verify-attested-ud-source.js";

export const PINNED_GSD_BLOBS = {
  train: "9aec4ae103fb5b7218f637afd686caf3b587a8e6",
  dev: "8b967948097a2e4bebe7f5d0e053c4fed4fe3baa",
  test: "3b15be45a96edcb21736f220e73fdccade231ca5",
} as const;
type Split = keyof typeof PINNED_GSD_BLOBS;
const SPLITS = ["train","dev","test"] as const;
const TARGETS = new Set(["種","給"]);

interface SourceInputs {
  readonly train: string;
  readonly dev: string;
  readonly test: string;
}
interface Candidate {
  readonly split: "train";
  readonly sentenceId: string;
  readonly tokenId: number;
  readonly originalSentence: string;
  readonly word: string;
  readonly corpusUpos: string;
  readonly corpusHeadId: number;
  readonly corpusDependency: string;
  readonly previousWord: string | null;
  readonly nextWord: string | null;
  readonly reviewStatus: "unlabeled";
}
type SplitStats = Record<string, number>;

export function buildStandaloneReviewQueue(
  sources: SourceInputs,
  pinned: Readonly<Record<Split,string>> = PINNED_GSD_BLOBS,
) {
  const candidates: Candidate[] = [];
  const counts: Record<Split,SplitStats> = {train:{},dev:{},test:{}};
  const sentenceCounts: Record<Split,number> = {train:0,dev:0,test:0};
  for (const split of SPLITS) {
    const raw = sources[split];
    const actualSha = gitBlobSha(raw);
    if (actualSha !== pinned[split]) {
      throw new Error(split + " corpus blob mismatch: actual=" + actualSha
        + " pinned=" + pinned[split]);
    }
    const sentences = parseConlluSentences(raw);
    sentenceCounts[split] = sentences.size;
    for (const sentence of sentences.values()) {
      const tokens = [...sentence.tokens.values()].sort((a,b)=>a.id-b.id);
      for (let i=0;i<tokens.length;i++) {
        const token=tokens[i]!;
        if (!TARGETS.has(token.form)) continue;
        const key = token.form + "/" + token.upos;
        counts[split][key] = (counts[split][key] ?? 0) + 1;
        if (split !== "train") continue;
        candidates.push({
          split:"train",sentenceId:sentence.id,tokenId:token.id,
          originalSentence:sentence.text,
          word:token.form,corpusUpos:token.upos,
          corpusHeadId:token.head,corpusDependency:token.deprel,
          previousWord:tokens[i-1]?.form ?? null,
          nextWord:tokens[i+1]?.form ?? null,
          reviewStatus:"unlabeled",
        });
      }
    }
  }
  // Do not copy UD Translit or MOE gold into this review queue.
  // No dev/test sentences are exported: their exact context stays held out.
  return {
    schemaVersion:"attested-standalone-homograph-review-queue-v1",
    sourceCommit:"22f73e87f7ddc530bb131a6b7587971a03e1a712",
    sourceBlobs:pinned,
    sourceLicense:"CC BY-SA 4.0",
    sourceRepository:"https://github.com/UniversalDependencies/UD_Chinese-GSD",
    objective:"Locate natural standalone tokens for independent reading review; NOT predict their pronunciations.",
    sourceTranslitNeverUsedAsGold:true,
    reviewPolicy:"Annotate train candidates independently; keep dev/test contexts held out; verify meanings against MOE.",
    trainQueueSize:candidates.length,
    sentenceCounts,
    groupCounts:counts,
    trainReviewCandidates:candidates,
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [train,dev,test,output] = process.argv.slice(2);
  if (!train || !dev || !test || !output) {
    throw new Error("Usage: mine-attested-standalone-contexts.ts <train> <dev> <test> <output.json>");
  }
  const report = buildStandaloneReviewQueue({
    train:readFileSync(train,"utf8"),
    dev:readFileSync(dev,"utf8"),
    test:readFileSync(test,"utf8"),
  });
  mkdirSync(dirname(output),{recursive:true});
  writeFileSync(output,JSON.stringify(report,null,2)+"\n","utf8");
  console.log(JSON.stringify({
    trainQueueSize:report.trainQueueSize,
    sentenceCounts:report.sentenceCounts,
    groupCounts:report.groupCounts,
    note:"Counts are NOT pronunciation categories. No automatically assigned gold readings.",
  },null,2));
}
