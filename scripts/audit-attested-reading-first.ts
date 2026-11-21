import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { createSeededRandom } from "../src/curriculum/random.js";
import type { LearnerBindingEvidence } from "../src/curriculum/types.js";
import {
  scoreAttestedReadingCandidates,
  selectAttestedReading,
  validateAttestedCases,
  type AttestedReadingCase,
} from "../src/research/attested-reading-selector.js";

const input = "research/attested-context-v1.json";
const output = process.argv[2] ?? "data/generated/attested-reading-first-audit.json";
const n = 512;
const data = JSON.parse(readFileSync(input, "utf8")) as {
  schemaVersion: string; rows: AttestedReadingCase[];
};
if (data.schemaVersion !== "attested-context-character-reading-v1") {
  throw new Error("unexpected corpus evidence schema");
}
validateAttestedCases(data.rows);

const cohorts = [
  { name: "unweighted", target: null },
  { name: "weak-tone4", target: "tone:4" },
  { name: "weak-tone2", target: "tone:2" },
  { name: "weak-zhuyin-ㄏ", target: "zhuyin:ㄏ" },
] as const;
const errorsFor = (token: string | null): readonly LearnerBindingEvidence[] =>
  token === null ? [] : [{
    scope: { mode: "guided", layoutId: "standard", tokenId: token },
    attempts: 16, errors: 12, timingSamples: 0,
    currentTimeToTypeMs: null, bestTimeToTypeMs: null,
  }];
const cohortSamples = new Map<string, readonly {
  id: string; reading: string; tokens: readonly string[];
}[]>();
const summaries: Record<string, object> = {};
for (const cohort of cohorts) {
  const scored = scoreAttestedReadingCandidates(data.rows, errorsFor(cohort.target));
  const selections = Array.from({ length: n }, (_, i) => {
    const pick = selectAttestedReading(scored, createSeededRandom("attested-reading-first-v1:" + i));
    return {
      id: pick.example.id,
      reading: pick.example.characterReading,
      tokens: pick.expectedTokens,
    };
  });
  cohortSamples.set(cohort.name, selections);
  const occurrences = (target: string): number =>
    selections.filter(s => s.tokens.includes(target)).length;
  summaries[cohort.name] = {
    samples: n,
    eligibleCases: scored.length,
    heldOutTestCases: data.rows.length - scored.length,
    tokenIncidence: {
      "tone:4": occurrences("tone:4"),
      "tone:2": occurrences("tone:2"),
      "zhuyin:ㄏ": occurrences("zhuyin:ㄏ"),
    },
    examples: selections.slice(0, 6).map(row => ({
      id: row.id, reading: row.reading,
    })),
  };
}
function count(cohort: string, token: string): number {
  return cohortSamples.get(cohort)!.filter(row => row.tokens.includes(token)).length;
}
const changes = {
  "tone:4": count("weak-tone4", "tone:4") - count("unweighted", "tone:4"),
  "tone:2": count("weak-tone2", "tone:2") - count("unweighted", "tone:2"),
  "zhuyin:ㄏ": count("weak-zhuyin-ㄏ", "zhuyin:ㄏ") - count("unweighted", "zhuyin:ㄏ"),
};
if (Object.values(changes).some(delta => delta <= 0)) {
  throw new Error("expected a positive increase in legitimate target exposure in this fixed-seed pilot");
}
const byCharacter = Object.fromEntries([...new Set(data.rows.map(r=>r.targetCharacter))].map(ch=>[
  ch, [...new Set(data.rows.filter(r=>r.targetCharacter===ch).map(r=>r.characterReading))].sort(),
]));
const result = {
  schemaVersion: "attested-reading-first-audit-v1",
  pilot: "target-character-only, fixed dictionary-anchored labels before learner weighting",
  sourceCases: data.rows.length,
  practiceCandidates: data.rows.filter(r=>r.source.split!=="test").length,
  heldOutForAuditOnly: data.rows.filter(r=>r.source.split==="test").length,
  contrastByCharacter: byCharacter,
  sampleCountPerCohort: n,
  cohorts: summaries,
  netAdditionalLegitimateTargetExposures: changes,
  limitations: [
    "This is NOT automatic polyphonic disambiguation; the source text and target reading were already paired and manually checked against dictionaries.",
    "Only the target character is pronounced; the other characters in the context sentence do NOT have verified labels.",
    "UD CoNLL-U transliteration and POS are not used as gold labels.",
    "A uniform baseline is used because this small corpus does not carry project-reviewed commonness projections.",
    "The test split is held out for later independent accuracy validation, not practice exposure.",
    "512 seeded samples estimate exposure mechanics only, not learning improvement, fluency, or naturalness of generated sentences.",
  ],
};
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, JSON.stringify(result, null, 2) + "\n", "utf8");
console.log(JSON.stringify({
  sourceCases: result.sourceCases,
  eligible: result.practiceCandidates,
  holdout: result.heldOutForAuditOnly,
  changes,
  cohorts: summaries,
}, null, 2));
