import { readFileSync, writeFileSync } from "node:fs";
import { catalogEntryId } from "../src/core/catalog-entry-id.js";

interface Sentence { seedIndex: number; text: string | null; root: string | null; entryIds: string[] }
interface Hit { seedIndex: number; text: string; selectedUpos: string | null; selectedEntryId: string }
interface Report {
  readingEligibilityPolicy: string;
  sampleCount: number;
  catalogEntryCount: number;
  seedNamespace: string;
  successfulSentences: number;
  failedSentences: number;
  sentences: Sentence[];
  hits: Hit[];
}
const [basePath, trialPath, outputPath] = process.argv.slice(2);
if (!basePath || !trialPath || !outputPath) {
  throw new Error("usage: tsx scripts/compare-zhong-role-trial.ts <reviewed-roles.json> <zhong-trial.json> <output.json>");
}
const read = (path: string) => JSON.parse(readFileSync(path, "utf8")) as Report;
const base = read(basePath);
const trial = read(trialPath);
if (base.readingEligibilityPolicy !== "reviewed-roles"
  || trial.readingEligibilityPolicy !== "zhong-role-trial"
  || base.sampleCount !== trial.sampleCount
  || base.catalogEntryCount !== trial.catalogEntryCount
  || base.seedNamespace !== trial.seedNamespace
  || base.sentences.length !== base.sampleCount
  || trial.sentences.length !== trial.sampleCount) {
  throw new Error("non-comparable audit populations or missing per-seed records");
}
if (base.failedSentences !== 0 || trial.failedSentences !== 0
  || base.successfulSentences !== base.sampleCount
  || trial.successfulSentences !== trial.sampleCount) {
  throw new Error("reading-role trial changed or preserved an unacceptable sentence-generation failure");
}
const authorized = new Map([
  ["NOUN", catalogEntryId("種", "ㄓㄨㄥ3")],
  ["VERB", catalogEntryId("種", "ㄓㄨㄥ4")],
]);
const disallowed = (hit: Hit) =>
  hit.text === "種" && authorized.has(hit.selectedUpos ?? "")
  && hit.selectedEntryId !== authorized.get(hit.selectedUpos ?? "");
const priorHits = base.hits.filter(disallowed);
const trialHits = trial.hits.filter(disallowed);
if (trialHits.length !== 0) {
  throw new Error("opt-in 種 policy failed to exclude a review-scoped mismatch");
}
const affected = new Set(priorHits.map(hit => hit.seedIndex));
const altered: number[] = [];
for (let index = 0; index < base.sampleCount; index += 1) {
  const before = base.sentences[index];
  const after = trial.sentences[index];
  if (before?.seedIndex !== index || after?.seedIndex !== index) {
    throw new Error("non-canonical per-seed comparison data");
  }
  if (before.text !== after.text || before.root !== after.root
    || before.entryIds.join("|") !== after.entryIds.join("|")) {
    altered.push(index);
  }
}
const unrelated = altered.filter(seed => !affected.has(seed));
if (unrelated.length > 0) {
  throw new Error("pilot changed an originally licensed/unrelated seed: " + unrelated.slice(0, 12).join(", "));
}
if (priorHits.length === 0) {
  throw new Error("the chosen audit corpus did not actually exercise a targeted 種 reading mismatch");
}
const out = {
  schemaVersion: "zhong-lexical-role-trial-v1",
  status: "opt-in audit only: UPOS is aggregate surface-derived evidence, not proof of contextual sense",
  samples: base.sampleCount,
  priorDisallowedOccurrences: priorHits.length,
  priorAffectedSeeds: affected.size,
  trialDisallowedOccurrences: trialHits.length,
  alteredSeeds: altered.length,
  unrelatedAlteredSeeds: unrelated.length,
  targetScope: ["種/NOUN", "種/VERB"],
  noProductActivation: true,
};
writeFileSync(outputPath, JSON.stringify(out, null, 2) + "\n");
console.log(JSON.stringify(out, null, 2));
