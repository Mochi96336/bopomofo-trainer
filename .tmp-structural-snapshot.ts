import { createHash } from "node:crypto";
import {
  EVALUATION_CATALOG,
  PRACTICE_CATALOG,
  SYNTAX_PROFILES,
} from "./src/app/generated/catalog.js";
import {
  createFreshProgressForEnvironment,
  createProductEnvironment,
  createProductState,
} from "./src/product/session.js";

const environment = createProductEnvironment({
  practice: PRACTICE_CATALOG,
  evaluation: EVALUATION_CATALOG,
  syntaxProfiles: SYNTAX_PROFILES,
});
const baseProgress = createFreshProgressForEnvironment(
  environment,
  "structural-canonical-stage",
  "guided",
  "standard",
);
const hash = createHash("sha256");
let attemptTotal = 0;
for (let round = 0; round < 128; round += 1) {
  const state = createProductState(
    environment,
    { ...baseProgress, practiceRoundsCompleted: round },
    0,
  );
  attemptTotal += state.round.selection.generationAttempts;
  hash.update(JSON.stringify(state.round));
  hash.update("\n");
}
console.log(JSON.stringify({ attemptTotal, digest: hash.digest("hex") }));
