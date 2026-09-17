import { EVALUATION_CATALOG, PRACTICE_CATALOG, SYNTAX_PROFILES } from "../src/app/generated/catalog.js";
import { createFreshProgressForEnvironment, createProductEnvironment, createProductState } from "../src/product/session.js";
import { readCandidatePathUsage } from "../src/syntax/sample.js";

const sampleCount = Number(process.env.SAMPLE_COUNT ?? "256");
const environment = createProductEnvironment({ practice: PRACTICE_CATALOG, evaluation: EVALUATION_CATALOG, syntaxProfiles: SYNTAX_PROFILES });
const baseProgress = createFreshProgressForEnvironment(environment, "post302-candidate-path-usage", "guided", "standard");
for (let round = 0; round < sampleCount; round += 1) {
  createProductState(environment, { ...baseProgress, practiceRoundsCompleted: round }, 0);
}
const stats = readCandidatePathUsage();
const unused = stats.ruleChildrenCalls - stats.callsUsingSamplingPath;
console.log(JSON.stringify({
  sampleCount,
  ...stats,
  callsNeverUsingSamplingPath: unused,
  callsNeverUsingSamplingPathPct: Number((unused / stats.ruleChildrenCalls * 100).toFixed(2)),
  callsUsingSamplingPathPct: Number((stats.callsUsingSamplingPath / stats.ruleChildrenCalls * 100).toFixed(2)),
}, null, 2));
