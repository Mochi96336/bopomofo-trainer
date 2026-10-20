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

const [beforePath, trialPath, outputPath] = process.argv.slice(2);
if (!beforePath || !trialPath || !outputPath) {
  throw new Error("usage: compare-ordinal-line-trial <reviewed-roles.json> <ordinal-line-trial.json> <output.json>");
}
const before = JSON.parse(readFileSync(beforePath, "utf8")) as Report;
const trial = JSON.parse(readFileSync(trialPath, "utf8")) as Report;
if (before.readingEligibilityPolicy !== "reviewed-roles"
  || trial.readingEligibilityPolicy !== "ordinal-line-trial"
  || before.seedNamespace !== trial.seedNamespace
  || before.catalogEntryCount !== trial.catalogEntryCount
  || before.sampleCount !== trial.sampleCount
  || before.sentences.length !== before.sampleCount
  || trial.sentences.length !== trial.sampleCount
  || before.sampleCount !== 2048) {
  throw new Error("ordinal line trial requires the same pinned 2048-seed product-family population");
}
if (before.failedSentences !== 0 || trial.failedSentences !== 0
  || before.successfulSentences !== before.sampleCount
  || trial.successfulSentences !== trial.sampleCount) {
  throw new Error("ordinal line trial failed sentence generation");
}

const ROW_ID = catalogEntryId("行", "ㄏㄤ2");
const ordinal = /^第[一二三四五六七八九十百千萬兩零〇0-9０-９]+$/u;
const wrong = (h: Hit): boolean =>
  h.text === "行" && h.selectedEntryId !== ROW_ID
  && h.previousEntryText !== null && ordinal.test(h.previousEntryText);
const beforeWrong = before.hits.filter(wrong);
const trialWrong = trial.hits.filter(wrong);
if (beforeWrong.length === 0) throw new Error("baseline did not exercise the targeted ordinal-row misreading");
if (trialWrong.length > 0) throw new Error("trial still emitted the wrong reading in 第N行");
const affected = new Set(beforeWrong.map(h => h.seedIndex));
// Changing a candidate distribution may alter a written word that was
// already valid, but ONLY at the lexical position immediately after 第N.
// The original and later positions must remain exactly identical.
const isOrdinalCatalogId = (id: string): boolean =>
  /^word:第[一二三四五六七八九十百千萬兩零〇0-9０-９]+:/u.test(id);
let alteredPositionsOutsideOrdinal = 0;
const observedChanges: Array<{
  seedIndex: number; lexicalPosition: number;
  previouslySelectedWord: string; newlySelectedWord: string;
}> = [];
for (let seedIndex = 0; seedIndex < before.sampleCount; seedIndex++) {
  const left = before.sentences[seedIndex]!;
  const right = trial.sentences[seedIndex]!;
  const indices = left.entryIds.flatMap((id, index) =>
    right.entryIds[index] === id ? [] : [index]);
  if (indices.length === 0 && left.text === right.text && left.root === right.root) continue;
  const pos = indices[0] ?? -1;
  if (indices.length !== 1
    || left.entryIds.length !== right.entryIds.length
    || left.root !== right.root
    || pos < 1
    || !isOrdinalCatalogId(left.entryIds[pos - 1]!)) {
    alteredPositionsOutsideOrdinal += 1;
  }
  observedChanges.push({
    seedIndex,
    lexicalPosition: pos,
    previouslySelectedWord: left.entryIds[pos] ?? "missing",
    newlySelectedWord: right.entryIds[pos] ?? "missing",
  });
}
if (alteredPositionsOutsideOrdinal !== 0) {
  throw new Error("legal-first ordinal selection changed other lexical positions or sentence structures");
}
const alteredSeeds: number[] = [];
for (let i = 0; i < before.sampleCount; i += 1) {
  const left = before.sentences[i], right = trial.sentences[i];
  if (!left || !right || left.seedIndex !== i || right.seedIndex !== i) {
    throw new Error("noncanonical seed correspondence in ordinal trial");
  }
  if (left.text !== right.text || left.root !== right.root
    || left.entryIds.join("|") !== right.entryIds.join("|")) {
    alteredSeeds.push(i);
  }
}
if (alteredSeeds.length === 0
  || [...affected].some(seedIndex => !alteredSeeds.includes(seedIndex))) {
  throw new Error("legal-first ordinal trial must change at least one originally invalid 第N行 seed");
}
const summary = {
  schemaVersion: "ordinal-line-scoped-prevalidated-weighted-draw-v3",
  status: "the current lexical slot only: local reviewed reading and weighted legal redraw; not a user-accuracy estimate",
  samples: before.sampleCount,
  wrongOrdinalLineHitsBefore: beforeWrong.length,
  wrongOrdinalLineHitsAfter: trialWrong.length,
  affectedSeeds: affected.size,
  alteredSeeds,
  changedSeedsOutsideOrdinalLexicalSlot: alteredPositionsOutsideOrdinal,
  changedSeedsWithoutPreviouslySelectedRow: alteredSeeds.filter(i => !affected.has(i)).length,
  observedChanges: observedChanges.slice(0, 30),
  generatedSentencesAfter: trial.successfulSentences,
  scope: "a prevalidated 第N context excludes invalid 行 pronunciations from the weighted current lexical frontier; only that lexical slot may change",
};
writeFileSync(outputPath, JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));
