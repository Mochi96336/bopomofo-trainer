import { mkdir, writeFile } from "node:fs/promises";
import {
  PRACTICE_CATALOG, SYNTAX_PROFILES, LEXICAL_COMPATIBILITY, LEXICAL_COMPATIBILITY_DIGEST,
} from "../src/app/generated/catalog.js";
import { surfaceCompatibilityScore } from "../src/compatibility/lexical-pairs.js";
import { createFreshProgressForEnvironment, createProductEnvironment, createProductState } from "../src/product/session.js";

const catalogs = { practice: PRACTICE_CATALOG, syntaxProfiles: SYNTAX_PROFILES };
const baselineEnvironment = createProductEnvironment(catalogs);
const evidenceEnvironment = createProductEnvironment({
  ...catalogs, lexicalCompatibility: LEXICAL_COMPATIBILITY,
});
const sampleCount = Number(process.argv.find(arg => arg.startsWith("--samples="))?.split("=")[1] ?? 128);
if (!Number.isInteger(sampleCount) || sampleCount < 1 || sampleCount > 2048) {
  throw new Error("samples must be an integer in [1, 2048]");
}

type Sentence = { readonly id: string; readonly text: string; readonly words: readonly string[] };
function sentence(environment: typeof baselineEnvironment, seed: string): Sentence {
  const progress = createFreshProgressForEnvironment(environment, seed, "guided", "standard");
  const selected = createProductState(environment, progress, 0).round.selection.utterance;
  return { id: selected.id, text: selected.text, words: selected.entries.map(e => e.prompt.text) };
}
function score(words: readonly string[]): { supported: number; scoreSum: number } {
  let supported = 0, scoreSum = 0;
  for (let i = 1; i < words.length; i++) {
    const value = surfaceCompatibilityScore(LEXICAL_COMPATIBILITY, words[i - 1]!, words[i]!);
    if (value > 0) { supported += 1; scoreSum += value; }
  }
  return { supported, scoreSum };
}
const examples: Array<{
  seed: number; before: string; after: string; beforeSupported: number;
  afterSupported: number; beforeScore: number; afterScore: number;
}> = [];
let changed = 0, newFailures = 0, baselineFailures = 0, evidenceFailures = 0;
let beforeSupport = 0, afterSupport = 0, beforeScore = 0, afterScore = 0;
for (let i = 0; i < sampleCount; i++) {
  const seed = "compatibility-activation-" + i;
  let before: Sentence | null = null, after: Sentence | null = null;
  try { before = sentence(baselineEnvironment, seed); } catch { baselineFailures += 1; }
  try { after = sentence(evidenceEnvironment, seed); } catch { evidenceFailures += 1; }
  if (before !== null && after === null) newFailures++;
  if (before === null || after === null) continue;
  const b = score(before.words), a = score(after.words);
  beforeSupport += b.supported; afterSupport += a.supported;
  beforeScore += b.scoreSum; afterScore += a.scoreSum;
  if (before.id !== after.id) {
    changed++;
    if (examples.length < 24) examples.push({
      seed: i, before: before.text, after: after.text,
      beforeSupported: b.supported, afterSupported: a.supported,
      beforeScore: b.scoreSum, afterScore: a.scoreSum,
    });
  }
}
const report = {
  schemaVersion: "lexical-compatibility-activation-same-seed-v1",
  kind: "corpus-adjacency exposure and side-effect audit, not semantic correctness",
  evidenceDigest: LEXICAL_COMPATIBILITY_DIGEST,
  sampleCount, baselineFailures, evidenceFailures, newFailures, changed,
  beforeSupport, afterSupport, beforeScore, afterScore,
  examples,
};
await mkdir("data/generated", { recursive: true });
await writeFile("data/generated/lexical-compatibility-activation-audit.json",
  JSON.stringify(report, null, 2) + "\n", "utf8");
console.log(JSON.stringify(report, null, 2));
if (newFailures > 0) throw new Error("lexical compatibility introduced sentence generation failures");
