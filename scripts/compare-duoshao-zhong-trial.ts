import { readFileSync, writeFileSync } from "node:fs";
import { catalogEntryId } from "../src/core/catalog-entry-id.js";

/** Paired, pinned-population comparison. Identity difference != reading error. */
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
  readonly previousEntryText: string | null;
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

export function compareDuoshaoZhongReports(before: Report, trial: Report) {
  if (before.readingEligibilityPolicy !== "ordinal-line-trial"
      || trial.readingEligibilityPolicy !== "duoshao-zhong-trial"
      || before.seedNamespace !== trial.seedNamespace
      || before.catalogEntryCount !== trial.catalogEntryCount
      || before.sampleCount !== 2048
      || trial.sampleCount !== 2048
      || before.sentences.length !== before.sampleCount
      || trial.sentences.length !== trial.sampleCount
      || before.failedSentences !== 0 || trial.failedSentences !== 0
      || before.successfulSentences !== 2048 || trial.successfulSentences !== 2048) {
    throw new Error("paired 多少種 comparison requires identical successful pinned 2048-seed policies");
  }

  const illegal = catalogEntryId("種", "ㄓㄨㄥ4");
  const legal = catalogEntryId("種", "ㄓㄨㄥ3");
  const wrongInContext = (hit: Hit): boolean =>
    hit.previousEntryText === "多少" && hit.text === "種"
      && hit.selectedEntryId !== legal;
  const beforeWrong = before.hits.filter(wrongInContext);
  const afterWrong = trial.hits.filter(wrongInContext);
  if (beforeWrong.length === 0
      || !beforeWrong.some(hit => hit.seedIndex === 443 && hit.selectedEntryId === illegal)) {
    throw new Error("baseline did not reproduce previously reviewed seed 443 多少種 misreading");
  }
  if (afterWrong.length !== 0) {
    throw new Error("scoped 多少種 trial still selected non-classifier reading");
  }

  const changedSeeds: number[] = [];
  const changes: Array<{
    readonly seedIndex: number;
    readonly slot: number;
    readonly oldEntryId: string;
    readonly newEntryId: string;
    readonly oldText: string | null;
    readonly newText: string | null;
  }> = [];
  const previouslyWrongSeeds = new Set(beforeWrong.map(h => h.seedIndex));
  for (let i = 0; i < 2048; i++) {
    const left = before.sentences[i];
    const right = trial.sentences[i];
    if (!left || !right || left.seedIndex !== i || right.seedIndex !== i) {
      throw new Error("paired 多少種 trial seed correspondence mismatch");
    }
    const different = left.entryIds.flatMap((id,index) =>
      right.entryIds[index] === id ? [] : [index]);
    const anyChange = left.text !== right.text || left.root !== right.root
      || left.entryIds.length !== right.entryIds.length
      || different.length > 0;
    if (!anyChange) continue;
    changedSeeds.push(i);
    const at = different[0] ?? -1;
    // A legal-first frontier can redirect the current sampled word, never
    // the preceding 多少, following lexical entries, or structural grammar.
    if (different.length !== 1 || at < 1
        || left.entryIds.length !== right.entryIds.length
        || left.root !== right.root
        || left.entryIds[at-1] !== right.entryIds[at-1]
        || !left.entryIds[at-1]?.startsWith("word:多少:")
        || left.entryIds.some((id,index) => index !== at && id !== right.entryIds[index])) {
      throw new Error("unrelated structural or lexical drift at seed "+i);
    }
    changes.push({
      seedIndex:i,slot:at,
      oldEntryId:left.entryIds[at]!,newEntryId:right.entryIds[at]!,
      oldText:left.text,newText:right.text,
    });
  }
  if (!changedSeeds.includes(443)
      || [...previouslyWrongSeeds].some(i => !changedSeeds.includes(i))) {
    throw new Error("known unlicensed 多少種 seeds were not repaired");
  }
  const nonContextChanges = changes.filter(x => !x.oldEntryId && !x.newEntryId);
  if (nonContextChanges.length !== 0) throw new Error("incomplete comparison");
  return {
    schemaVersion:"duoshao-zhong-scoped-reading-diff-v1",
    status:"exact adjacent-word pronunciation restriction; not a whole-sentence correctness estimate",
    population:2048,
    wrongDuoshaoZhongIdentitiesBefore:beforeWrong.length,
    wrongDuoshaoZhongIdentitiesAfter:afterWrong.length,
    beforeInvalidSeeds:[...previouslyWrongSeeds].sort((a,b)=>a-b),
    changedSeeds,
    changedSeedsWithoutInitiallyWrongZhong:changedSeeds.filter(i => !previouslyWrongSeeds.has(i)),
    changedOutsideImmediatePostDuoshaoSlot:0,
    successfulAfter:trial.successfulSentences,
    changes,
    warning:"Permitted changes in a weighted candidate frontier may choose a different legal written word. Do not interpret all changed selections as corrected wrong readings.",
  };
}

if (process.argv[1]?.endsWith("compare-duoshao-zhong-trial.ts")) {
  const [beforePath, trialPath, outPath] = process.argv.slice(2);
  if (!beforePath || !trialPath || !outPath) {
    throw new Error("usage: compare-duoshao-zhong-trial <ordinal-line-trial.json> <duoshao-zhong-trial.json> <summary.json>");
  }
  const report = compareDuoshaoZhongReports(
    JSON.parse(readFileSync(beforePath,"utf8")) as Report,
    JSON.parse(readFileSync(trialPath,"utf8")) as Report,
  );
  writeFileSync(outPath,JSON.stringify(report,null,2)+"\n");
  console.log(JSON.stringify({
    population:report.population,
    before:report.wrongDuoshaoZhongIdentitiesBefore,
    after:report.wrongDuoshaoZhongIdentitiesAfter,
    changedSeeds:report.changedSeeds,
    changedOutsideImmediatePostDuoshaoSlot:report.changedOutsideImmediatePostDuoshaoSlot,
    changes:report.changes,
  },null,2));
}
