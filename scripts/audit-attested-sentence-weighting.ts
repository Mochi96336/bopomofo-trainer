import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { createSeededRandom } from "../src/curriculum/random.js";
import type { LearnerBindingEvidence } from "../src/curriculum/types.js";
import {
  selectAttestedSentence,
  type AttestedPolyphoneBank,
} from "../src/research/attested-sentence-selector.js";

const inputPath = "data/research/attested-polyphones-v1.json";
let samples = 2048;
let output = "data/generated/attested-sentence-weighting-v1.json";
for (let i = 2; i < process.argv.length; i += 2) {
  const key = process.argv[i], value = process.argv[i + 1];
  if (value === undefined) throw new Error("missing CLI value for " + key);
  if (key === "--samples") samples = Number(value);
  else if (key === "--output") output = value;
  else throw new Error("unknown argument " + key);
}
if (!Number.isSafeInteger(samples) || samples < 16 || samples > 10000) {
  throw new Error("--samples must be an integer between 16 and 10000");
}
const bank = JSON.parse(await readFile(inputPath, "utf8")) as AttestedPolyphoneBank;
const targets = ["tone:4", "tone:3", "zhuyin:ㄏ"] as const;
type Target = typeof targets[number];
const cohorts = ["baseline", ...targets] as const;
type Cohort = typeof cohorts[number];
function evidence(cohort: Cohort): readonly LearnerBindingEvidence[] {
  if (cohort === "baseline") return [];
  return [{
    scope: { mode: "guided", layoutId: "standard", tokenId: cohort },
    attempts: 16, errors: 12, timingSamples: 0,
    currentTimeToTypeMs: null, bestTimeToTypeMs: null,
  }];
}
const records: Record<Cohort, string[]> = {
  baseline: [], "tone:4": [], "tone:3": [], "zhuyin:ㄏ": [],
};
const caseIndex = new Map(bank.cases.map(item => [item.id, item]));
for (let seed = 0; seed < samples; seed++) {
  for (const cohort of cohorts) {
    // Same seed across cohorts: the learner evidence is the *only* treatment.
    const selection = selectAttestedSentence(
      bank, evidence(cohort), createSeededRandom("attested-polyphone-v1:" + seed),
    );
    records[cohort].push(selection.selected.id);
    if (selection.selected.expectedZhuyin !== caseIndex.get(selection.selected.id)?.expectedZhuyin) {
      throw new Error("a weakness cohort changed a dictionary-approved pronunciation");
    }
  }
}
function summarize(cohort: Cohort) {
  const ids = records[cohort];
  return {
    selected: ids.length,
    targetReadingCounts: Object.fromEntries([...new Set(bank.cases.map(item => item.expectedZhuyin))]
      .sort().map(reading => [reading, ids.filter(id => caseIndex.get(id)?.expectedZhuyin === reading).length])),
    targetTokenCounts: Object.fromEntries(targets.map(t => [
      t, ids.filter(id => caseIndex.get(id)?.expectedTokens.includes(t)).length,
    ])),
    caseCounts: Object.fromEntries(bank.cases.map(item => [
      item.id, ids.filter(id => id === item.id).length,
    ])),
  };
}
function contrast(target: Target) {
  let gained = 0, lost = 0, changed = 0;
  const changedSamples: Array<{
    seed: number; before: string; after: string;
    beforeReading: string; afterReading: string;
  }> = [];
  for (let i = 0; i < samples; i++) {
    const a = records.baseline[i]!, b = records[target][i]!;
    const had = caseIndex.get(a)!.expectedTokens.includes(target);
    const now = caseIndex.get(b)!.expectedTokens.includes(target);
    if (!had && now) gained++;
    if (had && !now) lost++;
    if (a !== b) {
      changed++;
      if (changedSamples.length < 20) {
        changedSamples.push({
          seed: i, before: a, after: b,
          beforeReading: caseIndex.get(a)!.expectedZhuyin,
          afterReading: caseIndex.get(b)!.expectedZhuyin,
        });
      }
    }
  }
  return {
    target, gained, lost, netTargetExposure: gained - lost,
    baselineExposure: summarize("baseline").targetTokenCounts[target],
    weightedExposure: summarize(target).targetTokenCounts[target],
    changedSeedCount: changed, changedSamples,
  };
}
const result = {
  schemaVersion: "attested-target-only-learner-weighting-v1",
  sampleCountPerCohort: samples,
  bankCaseCount: bank.cases.length,
  contrastCharacterCount: new Set(bank.cases.map(c => c.character)).size,
  method: "real production scoreFrequencyFirstEntry + weightedPick; equal research-only frequency priors",
  readingSource: "dictionary-confirmed marked lexemes only; rest of source sentence has no verified readings",
  sourceSentenceQuality: "UD GSD attested; naturalness not independently reviewed",
  syntheticWeakness: "16 attempts, 12 errors, timing disabled, history empty, same RNG seeds",
  cohorts: Object.fromEntries(cohorts.map(cohort => [cohort, summarize(cohort)])),
  contrasts: targets.map(contrast),
};
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(result, null, 2) + "\n", "utf8");
console.log(JSON.stringify({
  cases: result.bankCaseCount,
  characters: result.contrastCharacterCount,
  samples,
  comparisons: result.contrasts.map(({target,baselineExposure,weightedExposure,netTargetExposure,changedSeedCount}) =>
    ({target,baselineExposure,weightedExposure,netTargetExposure,changedSeedCount})),
}, null, 2));
