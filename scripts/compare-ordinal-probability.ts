import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

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
interface Report {
  readonly readingEligibilityPolicy: string;
  readonly seedNamespace: string;
  readonly sampleCount: number;
  readonly successfulSentences: number;
  readonly failedSentences: number;
  readonly sentences: readonly Sentence[];
  readonly hits: readonly Hit[];
}
const [existingPath, validFirstPath, outputPath] = process.argv.slice(2);
if (!existingPath || !validFirstPath || !outputPath) {
  throw new Error("usage: compare-ordinal-probability existing.json valid-first.json summary.json");
}
const existing = JSON.parse(readFileSync(existingPath, "utf8")) as Report;
const legalFirst = JSON.parse(readFileSync(validFirstPath, "utf8")) as Report;
if (existing.readingEligibilityPolicy !== "ordinal-line-trial"
  || legalFirst.readingEligibilityPolicy !== "ordinal-valid-first"
  || existing.seedNamespace !== legalFirst.seedNamespace
  || existing.sampleCount !== legalFirst.sampleCount
  || existing.sampleCount !== 2048
  || existing.successfulSentences !== 2048
  || legalFirst.successfulSentences !== 2048
  || existing.failedSentences !== 0
  || legalFirst.failedSentences !== 0
  || existing.sentences.length !== 2048
  || legalFirst.sentences.length !== 2048) {
  throw new Error("ordinal cohorts must share all 2048 input seeds with zero failed generations");
}

const ordinal = /^第[一二三四五六七八九十百千萬兩零〇0-9０-９]+$/u;
const isOrdinalRow = (hit: Hit) =>
  hit.text === "行" && hit.previousEntryText !== null && ordinal.test(hit.previousEntryText);
const prevRow = existing.hits.filter(isOrdinalRow);
const newRow = legalFirst.hits.filter(isOrdinalRow);
const bad = (h: Hit) => isOrdinalRow(h) && h.selectedEntryId !== "word:行:ㄏㄤ2";
if (existing.hits.some(bad) || legalFirst.hits.some(bad)) {
  throw new Error("either policy emits an invalid numbered-row pronunciation");
}
const changes: Array<{
  seedIndex: number;
  oldText: string | null;
  legalFirstText: string | null;
  oldEntryIds: readonly string[];
  newEntryIds: readonly string[];
}> = [];
for (let index = 0; index < 2048; index++) {
  const old = existing.sentences[index]!;
  const next = legalFirst.sentences[index]!;
  if (old.seedIndex !== index || next.seedIndex !== index) throw new Error("seed alignment failed");
  if (old.text !== next.text || old.root !== next.root
    || old.entryIds.join("|") !== next.entryIds.join("|")) {
    changes.push({
      seedIndex: index,
      oldText: old.text,
      legalFirstText: next.text,
      oldEntryIds: old.entryIds,
      newEntryIds: next.entryIds,
    });
  }
}
const prevRowSeeds = new Set(prevRow.map(h => h.seedIndex));
const changesWithoutExistingRow = changes.filter(x => !prevRowSeeds.has(x.seedIndex));
const seed931 = {
  sameWord: existing.sentences[931]?.text,
  legalFirst: legalFirst.sentences[931]?.text,
  sameWordEntryIds: existing.sentences[931]?.entryIds,
  legalFirstEntryIds: legalFirst.sentences[931]?.entryIds,
};
const result = {
  schemaVersion: "ordinal-legal-weight-vs-keep-word-v1",
  purpose: "compare narrowly prelicensed weighted sampling vs postdraw preserving existing written 行",
  samples: 2048,
  results: {
    existingRowPhraseHits: prevRow.length,
    legalFirstRowPhraseHits: newRow.length,
    wrongOrdinalRowReadingsExisting: existing.hits.filter(bad).length,
    wrongOrdinalRowReadingsLegalFirst: legalFirst.hits.filter(bad).length,
    changedSeeds: changes.length,
    changesWithoutPreviouslySelectedOrdinalRow: changesWithoutExistingRow.length,
    seed931,
  },
  changes: changes.slice(0, 40),
  limitations: [
    "Fixed-seed output drift does not itself show naturalness or higher-quality sampling.",
    "The flat 2048-seed audit uses default catalog weights, not synthetic learner weakness.",
    "Current same-word preservation fixes a selected context but can retain selection probability from an invalid reading.",
    "Scoped legal-first removes that invalid candidate from the weighted frontier, but can select a different written word.",
    "A selected-word preservation guarantee and a fully legal-only probability distribution are not generally simultaneously possible.",
  ],
};
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify({
  samples: result.samples,
  ...result.results,
  examples: result.changes.slice(0, 8).map(x => ({
    seedIndex: x.seedIndex, old: x.oldText, legalFirst: x.legalFirstText,
  })),
}, null, 2));
