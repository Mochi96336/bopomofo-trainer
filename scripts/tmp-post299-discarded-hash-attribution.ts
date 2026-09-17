import { EVALUATION_CATALOG, PRACTICE_CATALOG, SYNTAX_PROFILES } from "../src/app/generated/catalog.js";
import { createFreshProgressForEnvironment, createProductEnvironment, createProductState } from "../src/product/session.js";
import { readDiscardedHashAttribution } from "../src/syntax/sample.js";

const sampleCount = Number(process.env.SAMPLE_COUNT ?? "256");
const environment = createProductEnvironment({
  practice: PRACTICE_CATALOG,
  evaluation: EVALUATION_CATALOG,
  syntaxProfiles: SYNTAX_PROFILES,
});
const baseProgress = createFreshProgressForEnvironment(
  environment,
  "post299-discarded-hash-attribution",
  "guided",
  "standard",
);
let attemptTotal = 0;
for (let round = 0; round < sampleCount; round += 1) {
  const state = createProductState(
    environment,
    { ...baseProgress, practiceRoundsCompleted: round },
    0,
  );
  attemptTotal += state.round.selection.generationAttempts;
}
const stats = readDiscardedHashAttribution();
const discardedSlotHashes = stats.rootNullSlotHashes + stats.postRejectedSlotHashes;
const discardedNodeHashes = stats.rootNullNodeHashes + stats.postRejectedNodeHashes;
const acceptedSlotHashes = stats.acceptedSlotHashes;
const acceptedNodeHashes = stats.acceptedNodeHashes;
const discardedHashChars = stats.rootNullSlotHashChars + stats.rootNullNodeHashChars
  + stats.postRejectedSlotHashChars + stats.postRejectedNodeHashChars;
const acceptedHashChars = stats.acceptedSlotHashChars + stats.acceptedNodeHashChars;
const discardedCanonicalChars = stats.rootNullSlotCanonicalChars + stats.rootNullNodeCanonicalChars
  + stats.postRejectedSlotCanonicalChars + stats.postRejectedNodeCanonicalChars;
const acceptedCanonicalChars = stats.acceptedSlotCanonicalChars + stats.acceptedNodeCanonicalChars;
const pct = (a: number, b: number) => b === 0 ? 0 : Number((a / b * 100).toFixed(2));
console.log(JSON.stringify({
  sampleCount,
  attemptTotal,
  ...stats,
  discardedSlotHashes,
  discardedNodeHashes,
  acceptedSlotHashes,
  acceptedNodeHashes,
  discardedHashCalls: discardedSlotHashes + discardedNodeHashes,
  acceptedHashCalls: acceptedSlotHashes + acceptedNodeHashes,
  discardedHashCallPct: pct(discardedSlotHashes + discardedNodeHashes, discardedSlotHashes + discardedNodeHashes + acceptedSlotHashes + acceptedNodeHashes),
  discardedHashChars,
  acceptedHashChars,
  discardedHashCharPct: pct(discardedHashChars, discardedHashChars + acceptedHashChars),
  discardedCanonicalChars,
  acceptedCanonicalChars,
  discardedCanonicalCharPct: pct(discardedCanonicalChars, discardedCanonicalChars + acceptedCanonicalChars),
}, null, 2));
