import { readFileSync, writeFileSync } from "node:fs";
import { catalogEntryId } from "../src/core/catalog-entry-id.js";

interface Sentence {
  readonly seedIndex: number;
  readonly text: string | null;
  readonly root: string | null;
  readonly entryIds: readonly string[];
}
interface Hit {
  readonly seedIndex: number;
  readonly text: string;
  readonly selectedEntryId: string;
}
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

export function compareMoeStandardLe(before: Report, after: Report) {
  if (before.readingEligibilityPolicy !== "duoshao-zhong-trial"
    || after.readingEligibilityPolicy !== "standard-le-trial"
    || before.seedNamespace !== after.seedNamespace
    || before.catalogEntryCount !== after.catalogEntryCount
    || before.sampleCount !== 2048 || after.sampleCount !== 2048
    || before.sentences.length !== 2048 || after.sentences.length !== 2048
    || before.failedSentences !== 0 || after.failedSentences !== 0
    || before.successfulSentences !== 2048 || after.successfulSentences !== 2048) {
    throw new Error("MOE 了 reading requires paired 2048-seed successful matching baselines");
  }
  const wrongId = catalogEntryId("了", "ㄌㄧㄠ4");
  const beforeBad = before.hits.filter(h => h.text === "了" && h.selectedEntryId === wrongId);
  const afterBad = after.hits.filter(h => h.text === "了" && h.selectedEntryId === wrongId);
  if (!beforeBad.length || !beforeBad.some(h => h.seedIndex === 1681)) {
    throw new Error("pinned corpus did not reproduce unlicensed 了/ㄌㄧㄠ4 at seed 1681");
  }
  if (afterBad.length) {
    throw new Error("new policy still selected unlicensed standalone 了/ㄌㄧㄠ4");
  }

  let otherPositionsChanged = 0;
  const changes: Array<{
    readonly seedIndex: number;
    readonly slot: number;
    readonly priorId: string;
    readonly newId: string;
  }> = [];
  for (let seed = 0; seed < 2048; seed++) {
    const left = before.sentences[seed];
    const right = after.sentences[seed];
    if (!left || !right || left.seedIndex !== seed || right.seedIndex !== seed
      || left.root !== right.root || left.entryIds.length !== right.entryIds.length) {
      throw new Error("sentence structure or seed alignment changed at "+seed);
    }
    const positions = left.entryIds.flatMap((id,i) => id === right.entryIds[i] ? [] : [i]);
    if (positions.length > 1 || (positions.length === 0 && left.text !== right.text)) {
      otherPositionsChanged++;
    }
    if (positions.length === 1) {
      const slot = positions[0]!;
      changes.push({
        seedIndex:seed,
        slot,
        priorId:left.entryIds[slot]!,
        newId:right.entryIds[slot]!,
      });
    }
  }
  if (otherPositionsChanged !== 0) {
    throw new Error("new 了 gate changed multiple slots or unexplained text: "+otherPositionsChanged);
  }
  const changedSeeds = changes.map(x => x.seedIndex);
  if (!changedSeeds.includes(1681) || beforeBad.some(h => !changedSeeds.includes(h.seedIndex))) {
    throw new Error("some previously bad 了/ㄌㄧㄠ4 outputs were not replaced");
  }

  // The reviewed gate may change other eligible draws because a high-weight,
  // illegal lexical entry was removed from their frontier. Those *are not*
  // additional incorrect readings without independent evidence.
  return {
    schemaVersion:"moe-standard-le-reading-2048-comparison-v1",
    population:2048,
    unapprovedLeLiao4Before:beforeBad.length,
    unapprovedLeLiao4After:afterBad.length,
    baselineBadSeeds:[...new Set(beforeBad.map(x=>x.seedIndex))].sort((a,b)=>a-b),
    changedSeeds,
    changedSeedsWithoutBadBefore:changedSeeds.filter(i=>!beforeBad.some(h=>h.seedIndex===i)),
    changesOutsideSingleSlot:otherPositionsChanged,
    changedDetails:changes,
    disclaimer:"Lexical entry identity changes are not all verified pronunciation errors. Both MOE-reviewed 了 readings remain licensed.",
  };
}
if (process.argv[1]?.endsWith("compare-moe-standard-le.ts")) {
  const [beforePath, afterPath, outPath] = process.argv.slice(2);
  if (!beforePath || !afterPath || !outPath) throw new Error("usage: compare-moe-standard-le <old.json> <new.json> <summary.json>");
  const report = compareMoeStandardLe(
    JSON.parse(readFileSync(beforePath,"utf8")) as Report,
    JSON.parse(readFileSync(afterPath,"utf8")) as Report,
  );
  writeFileSync(outPath,JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({
    population:report.population,
    unapprovedLeLiao4Before:report.unapprovedLeLiao4Before,
    unapprovedLeLiao4After:report.unapprovedLeLiao4After,
    changedSeeds:report.changedSeeds,
    changesOutsideSingleSlot:report.changesOutsideSingleSlot,
    changedDetails:report.changedDetails.slice(0,25),
  },null,2));
}
