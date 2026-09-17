import {
  EVALUATION_CATALOG,
  PRACTICE_CATALOG,
  SYNTAX_PROFILES,
} from "../src/app/generated/catalog.js";
import {
  createFreshProgressForEnvironment,
  createProductEnvironment,
  createProductState,
} from "../src/product/session.js";

const rounds = Number(process.env.PROFILE_ROUNDS ?? "256");
const environment = createProductEnvironment({
  practice: PRACTICE_CATALOG,
  evaluation: EVALUATION_CATALOG,
  syntaxProfiles: SYNTAX_PROFILES,
});
const baseProgress = createFreshProgressForEnvironment(
  environment,
  "post-298-hotspot-attribution",
  "guided",
  "standard",
);
let attemptTotal = 0;
for (let round = 0; round < rounds; round += 1) {
  const state = createProductState(
    environment,
    { ...baseProgress, practiceRoundsCompleted: round },
    0,
  );
  attemptTotal += state.round.selection.generationAttempts;
}
const root = globalThis as any;
console.log(JSON.stringify({
  rounds,
  attemptTotal,
  runtimeDigest: root.__runtimeDigestAttribution ?? null,
  formalSelection: root.__formalSelectionAttribution ?? null,
}, null, 2));
