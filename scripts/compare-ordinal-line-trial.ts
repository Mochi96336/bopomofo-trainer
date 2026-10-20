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
// The goal is to fix the reading of 第三行, not generate 第三壺 and
// perturb later words via an extra random draw. Assert only this catalog
// entry identity changes in every affected deterministic sentence.
for (const seedIndex of affected) {
  const left = before.sentences[seedIndex]!;
  const right = trial.sentences[seedIndex]!;
  if (left.text !== right.text || left.root !== right.root
    || left.entryIds.length !== right.entryIds.length) {
    throw new Error("local reading repair changed the written sentence/grammar at seed " + seedIndex);
  }
  const changedPositions = left.entryIds.flatMap((id, index) =>
    right.entryIds[index] === id ? [] : [index]);
  if (changedPositions.length !== 1) {
    throw new Error("reading repair changed other lexical slots at seed " + seedIndex);
  }
  const index = changedPositions[0]!;
  const originalId = left.entryIds[index]!;
  if (!beforeWrong.some(hit => hit.seedIndex === seedIndex && hit.selectedEntryId === originalId)
    || right.entryIds[index] !== ROW_ID) {
    throw new Error("the only repaired entry must be the numbered-row 行:ㄏㄤ2 at seed " + seedIndex);
  }
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
const unrelated = alteredSeeds.filter(i => !affected.has(i));
if (unrelated.length > 0 || alteredSeeds.length === 0) {
  throw new Error("ordinal trial changed an unrelated seed or failed to change the targeted seed: " + unrelated.slice(0, 10).join(","));
}
const summary = {
  schemaVersion: "ordinal-line-local-legal-draw-v2",
  status: "the current lexical slot only: local reviewed reading and weighted legal redraw; not a user-accuracy estimate",
  samples: before.sampleCount,
  wrongOrdinalLineHitsBefore: beforeWrong.length,
  wrongOrdinalLineHitsAfter: trialWrong.length,
  affectedSeeds: affected.size,
  alteredSeeds,
  unrelatedAlteredSeeds: unrelated.length,
  generatedSentencesAfter: trial.successfulSentences,
  scope: "adjacent 第N + standalone 行 keeps the original sentence and all other catalog IDs while repairing only 行 to ㄏㄤ2",
};
writeFileSync(outputPath, JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));
