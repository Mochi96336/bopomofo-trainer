import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "../../src/core/model.js";
import type { RuntimeSyntaxProfile } from "../../src/syntax/types.js";
import type { UdOccurrenceToken } from "../../scripts/ud-occurrence-source.js";
import type { AttestedTargetContext } from "../../src/curriculum/attested-target-contexts.js";
import {
  buildReviewedAttestedFocusPrototype,
  type AttestedContextDecision,
} from "../../src/app/attested-reviewed-focus.js";
import { compileExerciseInputPlan } from "../../src/practice/input-plan.js";

function entry(text: string, reading: string): CatalogEntry {
  return {
    id: "word:" + text + ":" + reading,
    prompt: { text, locale: "zh-TW" },
    syllables: [{ tokens: ["zhuyin:ㄔ", "tone:1"] }],
    tags: [], provenanceIds: [],
  };
}
const targetEntry = entry("吃", "ㄔ1");
const entries = [targetEntry];
const profiles: RuntimeSyntaxProfile[] = [{
  id: targetEntry.id + ":VERB", entryId: targetEntry.id, upos: "VERB",
  functions: [], valencyFrames: [],
  dependencyEvidence: { dependencyRelationCounts: {}, surfacePositionCounts: {} },
  provenanceIds: [],
}];
const tokens: UdOccurrenceToken[] = [
  { id: 1, form: "他", upos: "PRON", head: 2, relation: "nsubj", feats: "_" },
  { id: 2, form: "吃", upos: "VERB", head: 0, relation: "root", feats: "_" },
  { id: 3, form: "飯", upos: "NOUN", head: 2, relation: "obj", feats: "_" },
  { id: 4, form: "。", upos: "PUNCT", head: 2, relation: "punct", feats: "_" },
];
const target: AttestedTargetContext = {
  sourceSentenceIndex: 9, sourceTokenId: 2, tokenIndex: 1,
  focusText: "吃", focusEntryId: targetEntry.id,
  sourceTokenForms: tokens.map(x => x.form),
};
// Synthetic, newly authored regression fixture; not a claim that this is UD's
// actual sentence 9 or that anyone has performed real independent review.
const hypotheticalApproved: AttestedContextDecision = {
  schemaVersion: "attested-context-review-v1",
  source: {
    corpus: "UD_Chinese-GSD", split: "train",
    commit: "22f73e87f7ddc530bb131a6b7587971a03e1a712",
    sentenceIndex: 9, tokenId: 2, originalText: "他吃飯。",
    focusEntryId: targetEntry.id,
  },
  lexicalBoundary: { verdict: "approved", evidenceId: "test-boundary" },
  contextualReading: {
    verdict: "approved", evidenceId: "test-reading",
    reviewerId: "reviewer-fixture-A", adjudicatorId: "reviewer-fixture-B",
  },
  taiwanMandarinSuitability: { verdict: "approved", evidenceId: "test-naturalness" },
  reusePermission: {
    verdict: "cleared", clearanceId: "test-rights",
    attribution: "test attribution", license: "CC BY-SA 4.0",
  },
};
const run = (decision: AttestedContextDecision | null, sourceText = "他吃飯。",
  candidate: AttestedTargetContext = target,
  catalog: readonly CatalogEntry[] = entries,
) => buildReviewedAttestedFocusPrototype(
  candidate, tokens, sourceText, catalog, profiles, decision,
);

describe("attested context product promotion stays blocked without independent review", () => {
  it("produces one target-only exercise and original-context display with hypothetical complete review", () => {
    const out = run(hypotheticalApproved);
    expect(out).not.toBeNull();
    expect(out?.presentation.originalText).toBe("他吃飯。");
    expect(out?.html).toContain("他<mark");
    expect(out?.html).toContain(">吃</mark>飯。");
    expect(out?.exercise.entries.map(x => x.id)).toEqual([targetEntry.id]);
    expect(compileExerciseInputPlan(out!.exercise).syllables).toHaveLength(1);
    expect(out?.sourceReviewId).toBe("test-reading");
  });

  it("no review record or pending/rejected dimensions cannot enable any exercise", () => {
    expect(run(null)).toBeNull();
    expect(run({ ...hypotheticalApproved,
      contextualReading: { ...hypotheticalApproved.contextualReading, verdict: "pending" },
    })).toBeNull();
    expect(run({ ...hypotheticalApproved,
      lexicalBoundary: { ...hypotheticalApproved.lexicalBoundary, verdict: "rejected" },
    })).toBeNull();
    expect(run({ ...hypotheticalApproved,
      taiwanMandarinSuitability: { ...hypotheticalApproved.taiwanMandarinSuitability, verdict: "pending" },
    })).toBeNull();
    expect(run({ ...hypotheticalApproved,
      reusePermission: { ...hypotheticalApproved.reusePermission, verdict: "pending" },
    })).toBeNull();
  });

  it("does not accept blank evidence, no independent adjudication or absent rights attribution", () => {
    expect(run({ ...hypotheticalApproved, contextualReading: {
      ...hypotheticalApproved.contextualReading, reviewerId: "same", adjudicatorId: "same",
    } })).toBeNull();
    expect(run({ ...hypotheticalApproved, contextualReading: {
      ...hypotheticalApproved.contextualReading, evidenceId: " ",
    } })).toBeNull();
    expect(run({ ...hypotheticalApproved, reusePermission: {
      ...hypotheticalApproved.reusePermission, attribution: "",
    } })).toBeNull();
  });

  it("refuses stale source text, mismatched token, and any changed pronunciation identity", () => {
    expect(run(hypotheticalApproved, "他想吃飯。")).toBeNull();
    expect(run({ ...hypotheticalApproved, source: {
      ...hypotheticalApproved.source, sentenceIndex: 10,
    } })).toBeNull();
    expect(run({ ...hypotheticalApproved, source: {
      ...hypotheticalApproved.source, tokenId: 3,
    } })).toBeNull();
    expect(run({ ...hypotheticalApproved, source: {
      ...hypotheticalApproved.source, focusEntryId: "word:吃:ㄔ2",
    } })).toBeNull();
    expect(run(hypotheticalApproved, "他吃飯。",
      { ...target, sourceTokenId: 3 })).toBeNull();
    expect(run(hypotheticalApproved, "他吃飯.", target)).toBeNull();
    expect(run(hypotheticalApproved, "他吃飯。", target,
      [...entries, entry("吃", "ㄔ2")])).toBeNull();
  });
});
