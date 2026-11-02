import { readFileSync, writeFileSync } from "node:fs";
import { NONSTANDARD_DE_FOURTH_TONE_ID } from "../src/readings/moe-standard-de.js";

interface Sentence {
  readonly seedIndex: number;
  readonly text: string | null;
  readonly root: string | null;
  readonly entryIds: readonly string[];
}
interface Hit { readonly seedIndex: number; readonly text: string; readonly selectedEntryId: string }
interface Report {
  readonly readingEligibilityPolicy: string;
  readonly seedNamespace: string;
  readonly catalogEntryCount: number;
  readonly sampleCount: number;
  readonly failedSentences: number;
  readonly successfulSentences: number;
  readonly sentences: readonly Sentence[];
  readonly hits: readonly Hit[];
}

export function compareMoeStandardDe(before: Report, after: Report) {
  if (before.readingEligibilityPolicy !== "standard-bi-trial"
    || after.readingEligibilityPolicy !== "standard-de-trial"
    || before.seedNamespace !== after.seedNamespace
    || before.catalogEntryCount !== after.catalogEntryCount
    || before.sampleCount !== 2048 || after.sampleCount !== 2048
    || before.sentences.length !== 2048 || after.sentences.length !== 2048
    || before.failedSentences !== 0 || after.failedSentences !== 0
    || before.successfulSentences !== 2048 || after.successfulSentences !== 2048) {
    throw new Error("MOE 得 comparison requires exact 2048 paired prior-product seeds");
  }
  const rejectedId = NONSTANDARD_DE_FOURTH_TONE_ID;
  const badHits = before.hits.filter(h => h.text === "得" && h.selectedEntryId === rejectedId);
  const afterBadHits = after.hits.filter(h => h.text === "得" && h.selectedEntryId === rejectedId);
  const badSeeds = [...new Set(badHits.map(h => h.seedIndex))].sort((a,b) => a-b);
  if (badHits.length !== 2 || JSON.stringify(badSeeds) !== JSON.stringify([967,1013])) {
    throw new Error("frozen prior-product 得/ㄉㄜ4 exposure changed; re-review actual seed evidence");
  }
  if (afterBadHits.length !== 0) throw new Error("invalid 得/ㄉㄜ4 still selected");
  const changedSeeds:number[] = [];
  const changedDetails: Array<{seedIndex:number;slot:number;priorId:string;newId:string}> = [];
  for (let i=0; i<2048; i++) {
    const left = before.sentences[i];
    const right = after.sentences[i];
    if (!left || !right || left.seedIndex !== i || right.seedIndex !== i
      || left.root !== right.root || left.entryIds.length !== right.entryIds.length) {
      throw new Error("syntax structure or seed alignment changed at "+i);
    }
    const slots = left.entryIds.flatMap((id, slot) => id === right.entryIds[slot] ? [] : [slot]);
    if (slots.length > 1 || (slots.length === 0 && left.text !== right.text)) {
      throw new Error("multi-slot or unexplained text drift at seed "+i);
    }
    if (slots.length === 0) {
      if (left.entryIds.includes(rejectedId) || right.entryIds.includes(rejectedId)) {
        throw new Error("unrepaired or newly introduced 得/ㄉㄜ4 at seed "+i);
      }
      continue;
    }
    const slot = slots[0]!;
    if (left.entryIds[slot] !== rejectedId || right.entryIds.includes(rejectedId)) {
      throw new Error("unrelated or wrong-slot change at seed "+i);
    }
    changedSeeds.push(i);
    changedDetails.push({
      seedIndex:i,slot,priorId:left.entryIds[slot]!,newId:right.entryIds[slot]!,
    });
  }
  if (JSON.stringify(changedSeeds) !== JSON.stringify(badSeeds)) {
    throw new Error("changed seeds differ from previously invalid 得 exposure");
  }
  return {
    schemaVersion:"moe-de-paired-reading-diff-v1",
    sampleCount:2048,
    unsupportedDeFourthToneBefore:badHits.length,
    unsupportedDeFourthToneAfter:afterBadHits.length,
    badSeeds,
    changedSeeds,
    changedOutsideOriginallyInvalidSlot:0,
    changedDetails,
    caveat:"Only a confirmed exact reading-identity discrepancy, not an estimate of all pronunciation errors.",
  };
}

if (process.argv[1]?.endsWith("compare-moe-standard-de.ts")) {
  const [beforePath, afterPath, outputPath] = process.argv.slice(2);
  if (!beforePath || !afterPath || !outputPath) {
    throw new Error("usage: compare-moe-standard-de <before.json> <after.json> <summary.json>");
  }
  const result = compareMoeStandardDe(
    JSON.parse(readFileSync(beforePath,"utf8")) as Report,
    JSON.parse(readFileSync(afterPath,"utf8")) as Report,
  );
  writeFileSync(outputPath,JSON.stringify(result,null,2)+"\n");
  console.log(JSON.stringify(result,null,2));
}
