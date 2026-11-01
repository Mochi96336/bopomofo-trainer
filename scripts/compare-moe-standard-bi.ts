import { readFileSync, writeFileSync } from "node:fs";
import { catalogEntryId } from "../src/core/catalog-entry-id.js";

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
export function compareMoeStandardBi(before: Report, after: Report) {
  if (before.readingEligibilityPolicy !== "standard-le-trial"
    || after.readingEligibilityPolicy !== "standard-bi-trial"
    || before.seedNamespace !== after.seedNamespace
    || before.catalogEntryCount !== after.catalogEntryCount
    || before.sampleCount !== 2048 || after.sampleCount !== 2048
    || before.sentences.length !== 2048 || after.sentences.length !== 2048
    || before.failedSentences !== 0 || after.failedSentences !== 0
    || before.successfulSentences !== 2048 || after.successfulSentences !== 2048) {
    throw new Error("MOE 比 identity comparison requires the exact 2048 seeded population and prior product policy");
  }
  const rejectedId = catalogEntryId("比", "ㄅㄧ1");
  const beforeBad = before.hits.filter(h => h.text === "比" && h.selectedEntryId === rejectedId);
  const afterBad = after.hits.filter(h => h.text === "比" && h.selectedEntryId === rejectedId);
  if (!beforeBad.length) throw new Error("no disallowed 比/ㄅㄧ1 observed in previous shipping policy");
  if (afterBad.length) throw new Error("unapproved 比/ㄅㄧ1 still observed after gate");
  const changedSeeds: number[] = [];
  const changedDetails: Array<{ seedIndex:number; slot:number; priorId:string; newId:string }> = [];
  for (let i = 0; i < 2048; i++) {
    const left = before.sentences[i];
    const right = after.sentences[i];
    if (!left || !right || left.seedIndex !== i || right.seedIndex !== i
      || left.root !== right.root || left.entryIds.length !== right.entryIds.length) {
      throw new Error("seed alignment or syntax structure drift at "+i);
    }
    const positions = left.entryIds.flatMap((id,slot) => id === right.entryIds[slot] ? [] : [slot]);
    if (positions.length > 1 || (positions.length === 0 && left.text !== right.text)) {
      throw new Error("non-local lexical identity drift at seed "+i);
    }
    if (positions.length === 0) continue;
    const at = positions[0]!;
    // A prior initially-invalid draw in a failed intermediate attempt can
    // advance the shared RNG and alter a later successful candidate. Such
    // selections are side effects, NOT corrected pronunciation errors.
    // Keep the strict one-slot + unchanged-syntax gate and report every case.
    changedSeeds.push(i);
    changedDetails.push({
      seedIndex:i, slot:at,
      priorId:left.entryIds[at]!, newId:right.entryIds[at]!,
    });
  }
  const badSeeds=[...new Set(beforeBad.map(h=>h.seedIndex))].sort((a,b)=>a-b);
  if (badSeeds.some(seed => !changedSeeds.includes(seed))) {
    throw new Error("a previously unlicensed visible 比 identity was not replaced");
  }
  const changedWithoutInitiallyWrongBi = changedSeeds.filter(seed => !badSeeds.includes(seed));
  return {
    schemaVersion:"moe-bi-paired-reading-diff-v1",
    sampleCount:2048,
    rejectedBiFirstToneBefore:beforeBad.length,
    rejectedBiFirstToneAfter:afterBad.length,
    beforeBadSeeds:badSeeds,
    changedSeeds,
    changedWithoutInitiallyWrongBi,
    changedOutsideSingleLexicalSlot:0,
    changedDetails,
    caveat:"Restricted identity disagreement only; not an estimate of all context-dependent reading errors.",
  };
}
if (process.argv[1]?.endsWith("compare-moe-standard-bi.ts")) {
  const [beforePath,afterPath,outputPath] = process.argv.slice(2);
  if (!beforePath || !afterPath || !outputPath) throw new Error("usage: compare-moe-standard-bi <before.json> <after.json> <summary.json>");
  const result = compareMoeStandardBi(
    JSON.parse(readFileSync(beforePath,"utf8")) as Report,
    JSON.parse(readFileSync(afterPath,"utf8")) as Report,
  );
  writeFileSync(outputPath,JSON.stringify(result,null,2)+"\n");
  console.log(JSON.stringify(result,null,2));
}
