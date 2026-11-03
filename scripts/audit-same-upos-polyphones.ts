import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { PolyphonicContextHit } from "../src/readings/polyphonic-audit.js";
import { buildSameUposReviewQueue } from "../src/readings/same-upos-review.js";

/**
 * Run after the existing deterministic seed audit:
 *   npm run app:catalog
 *   npm run readings:audit -- --policy standard-role-third-trial --output data/generated/polyphonic-context-standard-role-third-trial.json
 *   npx tsx scripts/audit-same-upos-polyphones.ts
 *
 * Always derive the review queue from the *latest delivered* candidate stage,\n * not the historical reviewed-roles baseline that predates confirmed fixes.\n * No sentence is marked wrong by this tool. The reviewed-role variants are
 * separated from truly unreviewed text/UPOS groups. Zero occurrences of a
 * lexical reading is missing coverage, not evidence of correctness.
 */
interface Input {
  readonly schemaVersion: string;
  readonly readingEligibilityPolicy: string;
  readonly sampleCount: number;\n  readonly successfulSentences: number;\n  readonly failedSentences: number;
  readonly unsampledAmbiguousTexts: readonly string[];
  readonly hits: readonly PolyphonicContextHit[];
}
const args = process.argv.slice(2);
let inputPath = "data/generated/polyphonic-context-standard-role-third-trial.json";
let outputPath = "data/generated/same-upos-polyphone-review.json";
for (let i = 0; i < args.length; i += 2) {
  const name = args[i];
  const value = args[i + 1];
  if (value === undefined) throw new Error("missing value for " + name);
  if (name === "--input") inputPath = value;
  else if (name === "--output") outputPath = value;
  else throw new Error("unknown option: " + name);
}
const source = JSON.parse(await readFile(inputPath, "utf8")) as Input;
if (source.schemaVersion !== "polyphonic-context-exposure-v1"
  || source.readingEligibilityPolicy !== "standard-role-third-trial"\n  || source.sampleCount !== 2048\n  || source.successfulSentences !== 2048\n  || source.failedSentences !== 0
  || !Array.isArray(source.hits)
  || !Array.isArray(source.unsampledAmbiguousTexts)) {
  throw new Error("same-UPOS review requires successful final standard-role-third-trial 2048-seed exposure");
}
const review = buildSameUposReviewQueue(source.hits);
const output = {
  ...review,
  sampleCount: source.sampleCount,
  sourcePolicy: source.readingEligibilityPolicy,
  coverageWarning: "Final delivered multi-reading/UPOS groups are review leads, not verified wrong pronunciations. Noncoverage is not evidence of error.",
  unsampledAmbiguousTexts: source.unsampledAmbiguousTexts,
};
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, JSON.stringify(output, null, 2) + "\n", "utf8");
console.log(JSON.stringify({
  outputPath,
  sampleCount: output.sampleCount,\n  sourcePolicy: output.sourcePolicy,
  ambiguousGroupsInSample: output.ambiguousGroupsInSample,
  occurrencesInAmbiguousGroups: output.occurrencesInAmbiguousGroups,
  unreviewedGroups: output.unreviewedGroups,
  unreviewedOccurrences: output.unreviewedOccurrences,
  topUnreviewed: output.groups.filter(g => g.kind === "unreviewed-role-variation")
    .slice(0, 15).map(g => ({ key: g.text + "/" + g.upos, occurrences: g.occurrences,
      readings: g.selectedReadingEntryIds })),
}, null, 2));
