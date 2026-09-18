import { appendFileSync } from "node:fs";
import { EVALUATION_CATALOG, PRACTICE_CATALOG, SYNTAX_PROFILES } from "./src/app/generated/catalog.js";
import {
  createFreshProgressForEnvironment,
  createProductEnvironment,
  createProductState,
} from "./src/product/session.js";

const rounds = 2048;
const environment = createProductEnvironment({
  practice: PRACTICE_CATALOG,
  evaluation: EVALUATION_CATALOG,
  syntaxProfiles: SYNTAX_PROFILES,
});
const baseProgress = createFreshProgressForEnvironment(
  environment,
  "static-exclusion-weight-reuse-parity",
  "guided",
  "standard",
);
for (let round = 0; round < rounds; round += 1) {
  const state = createProductState(
    environment,
    { ...baseProgress, practiceRoundsCompleted: round },
    0,
  );
  const selection = state.round.selection;
  appendFileSync(process.env.OUTPUT_PATH!, JSON.stringify({
    round,
    generationAttempts: selection.generationAttempts,
    grammarFallbackReasons: selection.grammarFallbackReasons,
    utterance: {
      id: selection.utterance.id,
      text: selection.utterance.text,
      syntaxRootRuleId: selection.utterance.syntaxRootRuleId ?? null,
      syntaxProfileIds: selection.utterance.syntaxProfileIds ?? [],
      syllables: selection.utterance.syllables,
    },
  }) + "\n");
}
