import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { catalogEntryId } from "../src/core/catalog-entry-id.js";

interface Sentence {
  readonly seedIndex: number;
  readonly text: string | null;
  readonly entryIds: readonly string[];
  readonly root: string | null;
}
interface Hit {
  readonly seedIndex: number;
  readonly text: string;
  readonly selectedUpos: string | null;
  readonly selectedEntryId: string;
  readonly previousEntryText: string | null;
}
interface Audit {
  readonly readingEligibilityPolicy: string;
  readonly seedNamespace: string;
  readonly catalogEntryCount: number;
  readonly sampleCount: number;
  readonly failedSentences: number;
  readonly successfulSentences: number;
  readonly sentences: readonly Sentence[];
  readonly hits: readonly Hit[];
}
const [oldFile, newFile, output] = process.argv.slice(2);
if (!oldFile || !newFile || !output) throw new Error("usage: compare-contextual-valid-first baseline variant output");
const old = JSON.parse(readFileSync(oldFile, "utf8")) as Audit;
const variant = JSON.parse(readFileSync(newFile, "utf8")) as Audit;
if (old.readingEligibilityPolicy !== "ordinal-line-trial"
  || variant.readingEligibilityPolicy !== "contextual-valid-first"
  || old.seedNamespace !== variant.seedNamespace
  || old.catalogEntryCount !== variant.catalogEntryCount
  || old.sampleCount !== 2048 || variant.sampleCount !== 2048
  || old.successfulSentences !== 2048 || variant.successfulSentences !== 2048
  || old.failedSentences !== 0 || variant.failedSentences !== 0
  || old.sentences.length !== 2048 || variant.sentences.length !== 2048) {
  throw new Error("paired experiments differ in population or generation success");
}
const ordinal = /^第[一二三四五六七八九十百千萬兩零〇0-9０-９]+$/u;
const rowId = catalogEntryId("行", "ㄏㄤ2");
const haoId = catalogEntryId("好", "ㄏㄠ3");
function wrong(h: Hit): boolean {
  return (h.text === "好" && h.selectedUpos === "ADJ" && h.selectedEntryId !== haoId)
    || (h.text === "行" && h.previousEntryText !== null
      && ordinal.test(h.previousEntryText) && h.selectedEntryId !== rowId);
}
if (old.hits.some(wrong) || variant.hits.some(wrong)) {
  throw new Error("either policy produced an unlicensed reviewed context reading");
}
const oldHao = old.hits.filter(h => h.text === "好" && h.selectedUpos === "ADJ");
const newHao = variant.hits.filter(h => h.text === "好" && h.selectedUpos === "ADJ");
const oldRow = old.hits.filter(h => h.text === "行" && h.previousEntryText !== null && ordinal.test(h.previousEntryText));
const newRow = variant.hits.filter(h => h.text === "行" && h.previousEntryText !== null && ordinal.test(h.previousEntryText));
const beforeHaoSeeds = new Set(oldHao.map(h=>h.seedIndex));
let singleSlotChanges = 0, additionalSlotChanges = 0, rootChanges = 0, textOnlyChanges = 0;
const changes: Array<{
  seedIndex: number; before: string | null; after: string | null;
  indexes: readonly number[]; beforeAt: readonly string[]; afterAt: readonly string[];
  rootChanged: boolean;
}> = [];
for (let i=0;i<2048;i++) {
  const a=old.sentences[i]!,b=variant.sentences[i]!;
  if(a.seedIndex!==i || b.seedIndex!==i)throw new Error("seed mismatch");
  const indexes: number[] = [];
  for (let j=0;j<Math.max(a.entryIds.length,b.entryIds.length);j++){
    if (a.entryIds[j]!==b.entryIds[j])indexes.push(j);
  }
  const rootChanged=a.root!==b.root;
  if (!indexes.length && !rootChanged && a.text===b.text)continue;
  if (indexes.length===1 && !rootChanged)singleSlotChanges++;
  else if (indexes.length>1)additionalSlotChanges++;
  if(rootChanged)rootChanges++;
  if(indexes.length===0)textOnlyChanges++;
  changes.push({
    seedIndex:i,before:a.text,after:b.text,indexes,
    beforeAt:indexes.map(j=>a.entryIds[j]??"<missing>"),
    afterAt:indexes.map(j=>b.entryIds[j]??"<missing>"),
    rootChanged,
  });
}
const report={
  schemaVersion:"contextual-valid-first-2048-v1",
  purpose:"measure sampling distribution and lexical/grammar drift after adding reviewed 好/ADJ to ordinal legal-first policy",
  sampleCount:2048,
  reviewedInvalidReadingsOld:old.hits.filter(wrong).length,
  reviewedInvalidReadingsVariant:variant.hits.filter(wrong).length,
  generatedBoth:2048,
  observations:{
    adjectiveHaoOld:oldHao.length,adjectiveHaoVariant:newHao.length,
    ordinalRowOld:oldRow.length,ordinalRowVariant:newRow.length,
    changedSeeds:changes.length,
    changedSeedsWithoutPreviouslySelectedHao:changes.filter(x=>!beforeHaoSeeds.has(x.seedIndex)).length,
    oneLexicalSlotOnlyChanges:singleSlotChanges,
    multipleLexicalSlotChanges:additionalSlotChanges,
    changedGrammarRoots:rootChanges,
    textOnlyChanges,
  },
  samples:changes.slice(0,40),
  seed10:{before:old.sentences[10],after:variant.sentences[10]},
  limitations:[
    "A fixed seed is not a human-rated natural sentence.",
    "Legal-first weights may change a sampled word even when the initially selected word was already legal.",
    "This 2048-sample composer baseline has no individual learner error history.",
    "Profile legality is verified, but exact semantics and full sentence naturalness are not human reviewed.",
  ],
};
mkdirSync(dirname(output),{recursive:true});
writeFileSync(output,JSON.stringify(report,null,2)+"\n","utf8");
console.log(JSON.stringify({observations:report.observations,seed10:report.seed10,examples:report.samples.slice(0,10)},null,2));
