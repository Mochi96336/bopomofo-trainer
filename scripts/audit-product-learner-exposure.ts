import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { PRACTICE_CATALOG, SYNTAX_PROFILES } from "../src/app/generated/catalog.js";
import { FREQUENCY_FIRST_UTTERANCE_POLICY } from "../src/curriculum/selection-policy.js";
import { bindingAggregateKey } from "../src/measurement-v2/aggregate.js";
import { createProductEnvironment, createFreshProgressForEnvironment, createProductState } from "../src/product/session.js";
import { PRODUCT_READING_POLICY } from "../src/readings/product-reading-policy.js";

/** Matched fresh-user deliveries, with synthetic evidence only at the adaptation seam. */
const samples = Number(process.argv[2] ?? 256);
if (!Number.isSafeInteger(samples) || samples < 64 || samples > 4096) throw new Error("sample count must be 64..4096");
const output = process.argv[3] ?? "data/generated/product-learner-exposure.json";
const targets = ["tone:3", "tone:4", "zhuyin:ㄗ"] as const;
const environment = createProductEnvironment({ practice: PRACTICE_CATALOG, syntaxProfiles: SYNTAX_PROFILES });
const profiles = new Map(SYNTAX_PROFILES.map(profile => [profile.id, profile]));
const gates = [PRODUCT_READING_POLICY.readingEligibility, PRODUCT_READING_POLICY.preDrawReadingEligibility,
  PRODUCT_READING_POLICY.finalCandidateReadingEligibility, PRODUCT_READING_POLICY.subsequentFinalCandidateReadingEligibility,
  ...PRODUCT_READING_POLICY.additionalFinalCandidateReadingEligibilities];
interface Exposure {
  readonly token: string;
  readonly occurrences: number;
  readonly per100Syllables: number;
  readonly sentences: number;
}
interface Cohort {
  readonly target: string;
  readonly samples: number;
  readonly syllables: number;
  readonly changedSeeds: number;
  readonly identities: readonly string[];
  readonly exposure: readonly Exposure[];
}
const cohorts: Cohort[] = [];
for (const target of [null, ...targets]) {
  let syllables = 0, changedSeeds = 0;
  const occurrences = new Map<string, number>(targets.map(token => [token, 0]));
  const sentences = new Map<string, number>(targets.map(token => [token, 0]));
  const identities: string[] = [];
  for (let index = 0; index < samples; index += 1) {
    let progress = createFreshProgressForEnvironment(environment, `selection-exposure-v2:${index}`, "guided", "standard");
    if (target !== null) {
      const scope = { mode: "guided" as const, layoutId: "standard", tokenId: target };
      progress = { ...progress, measurements: { ...progress.measurements,
        semantic: { ...progress.measurements.semantic, bindings: {
          [bindingAggregateKey(scope)]: {
            scope, attempts: 32, errors: 24, timingSamples: 0,
            currentTimeToTypeMs: null, bestTimeToTypeMs: null,
            selectionEvidence: { correctness: [...Array<boolean>(8).fill(true), ...Array<boolean>(24).fill(false)], timingMs: [] },
          },
        } },
      } };
    }
    const { utterance } = createProductState(environment, progress, 0).round.selection;
    identities.push(utterance.id);
    if (cohorts.length > 0 && utterance.id !== cohorts[0]!.identities[index]) changedSeeds += 1;
    const seen = new Set<string>();
    for (let at = 0; at < utterance.entries.length; at += 1) {
      const entry = utterance.entries[at]!;
      const profile = profiles.get(utterance.syntaxProfileIds![at]!)!;
      if (profile === undefined || gates.some(gate => !gate(entry, profile, null, utterance.entries[at - 1] ?? null))) {
        throw new Error(`learner evidence admitted an unlicensed reading: ${target}:${index}:${entry.id}`);
      }
      syllables += entry.syllables.length;
      for (const syllable of entry.syllables) for (const token of syllable.tokens) {
        if (occurrences.has(token)) {
          occurrences.set(token, occurrences.get(token)! + 1);
          seen.add(token);
        }
      }
    }
    for (const token of seen) sentences.set(token, sentences.get(token)! + 1);
  }
  cohorts.push({ target: target ?? "baseline", samples, syllables, changedSeeds, identities,
    exposure: targets.map(token => ({ token, occurrences: occurrences.get(token)!,
      per100Syllables: 100 * occurrences.get(token)! / syllables, sentences: sentences.get(token)! })),
  });
}
const comparisons = cohorts.slice(1).map(cohort => {
  const baseline = cohorts[0]!.exposure.find(row => row.token === cohort.target)!;
  const weak = cohort.exposure.find(row => row.token === cohort.target)!;
  return { target: cohort.target, baseline: baseline.per100Syllables, weak: weak.per100Syllables,
    deltaPer100Syllables: weak.per100Syllables - baseline.per100Syllables, changedSeeds: cohort.changedSeeds };
});
// This is a broad deterministic health guard, not a significance or learning claim.
if (comparisons.some(row => row.deltaPer100Syllables <= 0)) {
  throw new Error(`learner weighting did not increase actual target exposure: ${JSON.stringify(comparisons)}`);
}
const report = { schemaVersion: "product-learner-exposure-v2", policyVersion: FREQUENCY_FIRST_UTTERANCE_POLICY.version,
  cohorts: cohorts.map(({ identities: _identities, ...cohort }) => cohort), comparisons,
  boundary: "Synthetic recent correctness, identical seeds and legality rules; no human-effectiveness claim." };
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ output, samples, comparisons }));
