import { performance } from "node:perf_hooks";
import { EVALUATION_CATALOG, PRACTICE_CATALOG, SYNTAX_PROFILES } from "../src/app/generated/catalog.js";
import {
  readRuntimeHashAttribution,
  resetRuntimeHashAttribution,
  setRuntimeHashAttributionEnabled,
  stableRuntimeDigest,
} from "../src/core/stable-id.js";
import {
  createFreshProgressForEnvironment,
  createProductEnvironment,
  createProductState,
} from "../src/product/session.js";

const sampleCount = Number(process.env.SAMPLE_COUNT ?? "256");
const environment = createProductEnvironment({
  practice: PRACTICE_CATALOG,
  evaluation: EVALUATION_CATALOG,
  syntaxProfiles: SYNTAX_PROFILES,
});
// Deliberately keep the post-299 seed so the pre/post-#300 attribution follows
// the same deterministic product trajectory.
const baseProgress = createFreshProgressForEnvironment(
  environment,
  "post299-hash-runtime-source-attribution",
  "guided",
  "standard",
);
const outputs: object[] = [];
let attemptTotal = 0;
resetRuntimeHashAttribution();
setRuntimeHashAttributionEnabled(true);
const startedAt = performance.now();
for (let round = 0; round < sampleCount; round += 1) {
  const state = createProductState(
    environment,
    { ...baseProgress, practiceRoundsCompleted: round },
    0,
  );
  const selection = state.round.selection;
  if (selection.generationAttempts !== 1) {
    throw new Error(`normal product round unexpectedly retried: ${selection.generationAttempts}`);
  }
  attemptTotal += selection.generationAttempts;
  outputs.push({
    id: selection.utterance.id,
    text: selection.utterance.text,
    root: selection.utterance.syntaxRootRuleId ?? null,
    profileIds: selection.utterance.syntaxProfileIds ?? [],
    generationAttempts: selection.generationAttempts,
    fallbackReasons: selection.grammarFallbackReasons,
  });
}
const elapsedMs = Math.round(performance.now() - startedAt);
setRuntimeHashAttributionEnabled(false);
const buckets = readRuntimeHashAttribution();
const totalLaneCharWork = buckets.reduce((sum, bucket) => sum + bucket.laneCharWork, 0);
const totalCalls = buckets.reduce((sum, bucket) => sum + bucket.calls, 0);
console.log(JSON.stringify({
  productionRef: process.env.PRODUCTION_REF,
  sampleCount,
  attemptTotal,
  elapsedMs,
  outputDigest: stableRuntimeDigest(outputs),
  totalCalls,
  totalLaneCharWork,
  buckets: buckets.map((bucket) => ({
    ...bucket,
    laneWorkPct: Number((bucket.laneCharWork / totalLaneCharWork * 100).toFixed(2)),
    callPct: Number((bucket.calls / totalCalls * 100).toFixed(2)),
    repeatRatePct: Number((bucket.repeatedCalls / bucket.calls * 100).toFixed(2)),
  })),
}, null, 2));
