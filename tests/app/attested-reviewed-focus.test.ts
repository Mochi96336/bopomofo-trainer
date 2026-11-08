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
import { applyInteractionInputV2, createInteractionSessionV2 } from "../../src/practice/interaction-session-v2.js";
import { catalogEntryId } from "../../src/core/catalog-entry-id.js";
import { parseReading } from "../../src/scheme/parse-reading.js";

function entry(text: string, reading: string): CatalogEntry {
  const parsed = parseReading(reading);
  if (!parsed.ok) throw new Error("fixture reading invalid: " + reading);
  return {
    id: catalogEntryId(text, reading),
    prompt: { text, locale: "zh-TW" },
    syllables: parsed.syllables,
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
    approvedEntryId: targetEntry.id,
    approvedReading: "ㄔ1",
    reviewedCandidateEntryIds: [targetEntry.id],
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

  it("promotes a truly polyphonic, same-UPOS focus ONLY with an explicit reviewed reading ID", () => {
    const directional = entry("東西", "ㄉㄨㄥ1 ㄒㄧ1");
    const objects = entry("東西", "ㄉㄨㄥ1 ㄒㄧ5");
    const ambiguousCatalog = [directional, objects];
    const nounProfiles: RuntimeSyntaxProfile[] = ambiguousCatalog.map(word => ({
      ...profiles[0]!, id: word.id + ":NOUN", entryId: word.id, upos: "NOUN",
    }));
    const actualTokens: UdOccurrenceToken[] = [
      { ...tokens[0]!, form: "我" },
      { ...tokens[1]!, form: "買" },
      { ...tokens[2]!, form: "東西", upos: "NOUN" },
      tokens[3]!,
    ];
    const sourceText = "我買東西。";
    const focus: AttestedTargetContext = {
      sourceSentenceIndex: 20, sourceTokenId: 3, tokenIndex: 2,
      focusText: "東西", focusEntryId: objects.id,
      sourceTokenForms: actualTokens.map(token => token.form),
    };
    const adjudicated: AttestedContextDecision = {
      ...hypotheticalApproved,
      source: {
        ...hypotheticalApproved.source,
        sentenceIndex: 20, tokenId: 3, originalText: sourceText,
        focusEntryId: objects.id,
      },
      contextualReading: {
        ...hypotheticalApproved.contextualReading,
        approvedEntryId: objects.id,
        approvedReading: "ㄉㄨㄥ1 ㄒㄧ5",
        reviewedCandidateEntryIds: [directional.id, objects.id],
      },
    };
    const checked = (review: AttestedContextDecision | null,
      candidate: AttestedTargetContext = focus,
      catalog: readonly CatalogEntry[] = ambiguousCatalog,
      grammar: readonly RuntimeSyntaxProfile[] = nounProfiles,
    ) => buildReviewedAttestedFocusPrototype(
      candidate, actualTokens, sourceText, catalog, grammar, review,
    );
    expect(checked(null)).toBeNull();
    const result = checked(adjudicated);
    expect(result?.exercise.entries.map(word => word.id)).toEqual([objects.id]);
    expect(result?.presentation.focus).toBe("東西");
    expect(result?.html).toContain(">東西</mark>");
    const realInput = compileExerciseInputPlan(result!.exercise);
    expect(realInput.syllables).toHaveLength(2);
    expect(realInput.syllables[0]!.bodySlots.map(slot => slot.tokenId))
      .toEqual(["zhuyin:ㄉ", "zhuyin:ㄨ", "zhuyin:ㄥ"]);
    expect(realInput.syllables.map(syllable => syllable.toneSlot.tokenId))
      .toEqual(["tone:1", "tone:5"]);
    expect(compileExerciseInputPlan({
      ...result!.exercise,
      entries: [directional],
    }).syllables.map(syllable => syllable.toneSlot.tokenId))
      .toEqual(["tone:1", "tone:1"]);
    // Full interaction-engine path: original context is not graded. A wrong
    // second-syllable direction tone must fail for the approved object sense,
    // then a correct light tone must finish the exact one-entry exercise.
    let interaction = createInteractionSessionV2(result!.exercise, 0);
    let time = 10;
    const press = (token: string): void => {
      interaction = applyInteractionInputV2(interaction, {
        timestampMs: time, physicalCode: "research-test-" + token, actualToken: token,
        repeat: false, composing: false, modifierOnly: false,
      });
      time += 10;
    };
    for (const slot of realInput.syllables[0]!.bodySlots) press(slot.tokenId);
    press("tone:1");
    expect(interaction.currentSyllableOrdinal).toBe(1);
    for (const slot of realInput.syllables[1]!.bodySlots) press(slot.tokenId);
    press("tone:1");
    expect(interaction.completed).toBe(false);
    expect(interaction.traces.at(-1)).toMatchObject({
      outcome: "unexpected-tone", attributedExpectedToken: "tone:5",
      entryId: objects.id, syllableIndex: 1,
    });
    press("tone:5");
    expect(interaction.completed).toBe(true);
    expect(interaction.traces.at(-1)).toMatchObject({
      outcome: "accepted-tone", entryId: objects.id, syllableIndex: 1,
      recovery: true,
    });
    expect(interaction.traces.filter(trace => trace.outcome === "accepted-tone"))
      .toHaveLength(2);
    expect(interaction.traces.every(trace => trace.entryId === objects.id)).toBe(true);

    // A reading decision may not silently follow the source-UPOS-only option.
    expect(checked({ ...adjudicated,
      contextualReading: { ...adjudicated.contextualReading, approvedEntryId: directional.id },
    })).toBeNull();
    // If the catalog acquires a third alternative, the earlier adjudication
    // has not considered that alternative, and becomes stale.
    expect(checked(adjudicated, focus, [...ambiguousCatalog, entry("東西", "ㄉㄨㄥ1 ㄒㄧ2")]))
      .toBeNull();
    expect(checked({ ...adjudicated, contextualReading: {
      ...adjudicated.contextualReading, reviewedCandidateEntryIds: [objects.id],
    } })).toBeNull();
    expect(checked({ ...adjudicated, contextualReading: {
      ...adjudicated.contextualReading,
      approvedReading: "ㄉㄨㄥ1 ㄒㄧ1",
    } })).toBeNull();
    expect(checked({ ...adjudicated, contextualReading: {
      ...adjudicated.contextualReading,
      approvedReading: "ㄉㄨㄥ1 ㄒㄧ",
    } })).toBeNull();
    // An entry ID left unchanged with a mutated grading token is not safe.
    const poisoned = { ...objects, syllables: directional.syllables };
    expect(checked(adjudicated, focus, [directional, poisoned])).toBeNull();
    expect(checked(adjudicated, focus, ambiguousCatalog, [])).toBeNull();
    expect(checked(adjudicated, { ...focus, tokenIndex: 1 })).toBeNull();
    // Merely editing the source entry ID must not bypass the explicit approval.
    expect(checked(adjudicated, { ...focus, focusEntryId: directional.id })).toBeNull();
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
    expect(run({ ...hypotheticalApproved, contextualReading: {
      ...hypotheticalApproved.contextualReading, approvedEntryId: "word:吃:ㄔ2",
    } })).toBeNull();
    expect(run({ ...hypotheticalApproved, contextualReading: {
      ...hypotheticalApproved.contextualReading, approvedReading: "ㄔ2",
    } })).toBeNull();
    expect(run({ ...hypotheticalApproved, contextualReading: {
      ...hypotheticalApproved.contextualReading, approvedReading: "",
    } })).toBeNull();
    expect(run({ ...hypotheticalApproved, contextualReading: {
      ...hypotheticalApproved.contextualReading, reviewedCandidateEntryIds: [],
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
