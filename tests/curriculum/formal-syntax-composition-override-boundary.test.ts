import { describe, expect, it } from "vitest";
import {
  FREQUENCY_FIRST_UTTERANCE_POLICY,
  selectFormalSyntaxUtterance,
  type FormalSyntaxCompositionOverride,
} from "../../src/curriculum/frequency-first-utterance.js";

const HISTORY = {
  recentEntryIds: [],
  recentUtteranceIds: [],
  recentTemplateIds: [],
} as const;

type ExposesClauseNesting = "minimumClauseNesting" extends keyof FormalSyntaxCompositionOverride
  ? true
  : false;
const EXPOSES_CLAUSE_NESTING: ExposesClauseNesting = false;

describe("formal syntax composition override boundary", () => {
  it("does not expose clause nesting as a composition input", () => {
    expect(EXPOSES_CLAUSE_NESTING).toBe(false);
  });

  it("requires explicit raw sampling for structural targeting", () => {
    expect(() => selectFormalSyntaxUtterance({
      entries: [],
      bindingEvidence: [],
      mode: "guided",
      layoutId: "standard",
      history: HISTORY,
      policy: FREQUENCY_FIRST_UTTERANCE_POLICY,
      profiles: [],
      random: { next: () => 0 },
      formalSyntaxComposition: {
        samplingMode: "product-family",
        structuralTarget: { rootProductionRuleId: "sentence.declarative" },
      },
    })).toThrow(/structuralTarget requires raw samplingMode/u);
  });
});
