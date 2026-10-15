import { describe, expect, it } from "vitest";
import { inspectionNextToken } from "../../src/app/practice-session-view.js";
import {
  COMMONNESS_TIER_THRESHOLDS,
  PRACTICE_CATALOG,
  SYNTAX_PROFILES,
} from "../../src/app/generated/catalog.js";
import { COMMONNESS_TIERS } from "../../src/commonness/tiers.js";
import {
  selectFormalSyntaxUtterance,
} from "../../src/curriculum/frequency-first-utterance.js";
import {
  argumentRealizationPracticeIntentForTicketUnit,
  comparativePracticeIntentForTicketUnit,
  createSentenceConstructionFamilyPlanSample,
  predicateMarkingPracticeIntentForTicketUnit,
} from "../../src/curriculum/formal-syntax-sampling-policy.js";
import { createSeededRandom } from "../../src/curriculum/random.js";
import { catalogsForCommonnessTiers } from "../../src/product/commonness-access.js";
import {
  applyProductInput,
  createFreshProgressForEnvironment,
  createProductEnvironment,
  createProductState,
} from "../../src/product/session.js";
import { FORMAL_SYNTAX_RULES } from "../../src/syntax/grammar.js";
import { PREVERBAL_AUXILIARY_SAME_OCCURRENCE_CAPABILITY } from "../../src/syntax/runtime-occurrence-capabilities.js";

const wholeCatalogs = { practice: PRACTICE_CATALOG, syntaxProfiles: SYNTAX_PROFILES };

describe("commonness-tier product generation", () => {
  it("measures 64 deterministic fresh rounds per tier without hiding exhaustion", () => {
    const failures: Record<number, { seed: string; error: string }[]> = {};
    const modalProfilesByTier: Record<number, { profiles: number; entries: number }> = {};
    for (const tier of COMMONNESS_TIERS) {
      const narrowed = catalogsForCommonnessTiers(
        wholeCatalogs,
        COMMONNESS_TIER_THRESHOLDS,
        [tier],
      );
      const environment = createProductEnvironment(narrowed);
      const modalProfiles = environment.catalogs.syntaxProfiles.filter((profile) =>
        profile.occurrenceCapabilities?.includes(
          PREVERBAL_AUXILIARY_SAME_OCCURRENCE_CAPABILITY,
        ) ?? false,
      );
      modalProfilesByTier[tier] = {
        profiles: modalProfiles.length,
        entries: new Set(modalProfiles.map((profile) => profile.entryId)).size,
      };
      failures[tier] = [];
      for (let index = 0; index < 64; index += 1) {
        const seed = `reading-tier-${tier}:${index}`;
        const progress = createFreshProgressForEnvironment(
          environment,
          seed,
          index % 2 === 0 ? "guided" : "recall",
          "standard",
        );
        try {
          selectFormalSyntaxUtterance({
            entries: environment.catalogs.practice,
            profiles: environment.catalogs.syntaxProfiles,
            bindingEvidence: [],
            mode: progress.mode,
            layoutId: progress.layoutId,
            history: {
              recentEntryIds: progress.selection.recentEntryIds,
              recentUtteranceIds: progress.selection.recentUtteranceIds,
              recentTemplateIds: progress.selection.recentTemplateIds,
            },
            policy: environment.utterancePolicy,
            preparedFormalSyntaxLexicon: environment.preparedPracticeLexicon,
            preparedFrequencyFirstEntries: environment.preparedPracticeEntries,
            preparedFormalSyntaxExecution: environment.preparedPracticeFormalSyntaxExecution,
            random: createSeededRandom(seed + ":practice:0"),
          });
        } catch (error) {
          failures[tier]!.push({ seed, error: String(error) });
        }
      }
    }

    const diagnosticRandom = createSeededRandom("reading-tier-4:11:practice:0");
    const planSample = createSentenceConstructionFamilyPlanSample(
      FORMAL_SYNTAX_RULES.filter((rule) => rule.output === "Sentence"),
      diagnosticRandom,
    );
    const diagnostic = {
      failures,
      modalProfilesByTier,
      tier4Seed11: {
        terminalUnit: planSample.predicateMarkingTicketUnit,
        predicate: predicateMarkingPracticeIntentForTicketUnit(
          planSample.predicateMarkingTicketUnit,
        ),
        argument: argumentRealizationPracticeIntentForTicketUnit(
          planSample.argumentRealizationTicketUnit,
        ),
        comparative: comparativePracticeIntentForTicketUnit(
          planSample.comparativePracticeTicketUnit,
        ),
        familyPlan: planSample.plan.map((item) => item.family),
      },
    };

    expect(failures, JSON.stringify(diagnostic, null, 2)).toEqual({
      1: [],
      2: [],
      3: [],
      4: [],
    });
  }, 90_000);

  it.each([
    { tier: 2 as const, index: 58 },
    { tier: 4 as const, index: 11 },
  ])("recovers the known exhausted seed in tier $tier", ({ tier, index }) => {
    const narrowed = catalogsForCommonnessTiers(
      wholeCatalogs,
      COMMONNESS_TIER_THRESHOLDS,
      [tier],
    );
    const environment = createProductEnvironment(narrowed);
    const seed = `reading-tier-${tier}:${index}`;
    const progress = createFreshProgressForEnvironment(
      environment,
      seed,
      index % 2 === 0 ? "guided" : "recall",
      "standard",
    );
    const selection = selectFormalSyntaxUtterance({
      entries: environment.catalogs.practice,
      profiles: environment.catalogs.syntaxProfiles,
      bindingEvidence: [],
      mode: progress.mode,
      layoutId: progress.layoutId,
      history: {
        recentEntryIds: progress.selection.recentEntryIds,
        recentUtteranceIds: progress.selection.recentUtteranceIds,
        recentTemplateIds: progress.selection.recentTemplateIds,
      },
      policy: environment.utterancePolicy,
      preparedFormalSyntaxLexicon: environment.preparedPracticeLexicon,
      preparedFrequencyFirstEntries: environment.preparedPracticeEntries,
      preparedFormalSyntaxExecution: environment.preparedPracticeFormalSyntaxExecution,
      random: createSeededRandom(seed + ":practice:0"),
    });
    expect(selection.grammarFallbackReasons).toContain(
      "formal-syntax-practice-availability-recovery",
    );
    expect(selection.utterance.entries.every((entry) =>
      environment.catalogs.practice.some((candidate) => candidate.id === entry.id),
    )).toBe(true);
  });

  it("completes the recovered tier-4 round and advances learner state normally", () => {
    const narrowed = catalogsForCommonnessTiers(
      wholeCatalogs,
      COMMONNESS_TIER_THRESHOLDS,
      [4],
    );
    const environment = createProductEnvironment(narrowed);
    const progress = createFreshProgressForEnvironment(
      environment,
      "reading-tier-4:11",
      "recall",
      "standard",
    );
    const initial = createProductState(environment, progress, 0);
    expect(initial.round.selection.grammarFallbackReasons).toContain(
      "formal-syntax-practice-availability-recovery",
    );

    let current = initial;
    let timestampMs = 0;
    while (current.summary === null) {
      const token = inspectionNextToken(current.session);
      if (token === null) throw new Error("recovered round has no acceptable next token");
      timestampMs += 50;
      current = applyProductInput(environment, current, {
        timestampMs,
        physicalCode: "Test",
        actualToken: token,
        repeat: false,
        composing: false,
        modifierOnly: false,
      }, "2026-10-15T00:00:00.000Z");
    }

    expect(current.progress.practiceRoundsCompleted).toBe(1);
    expect(current.progress.recentSummaries).toHaveLength(1);
    expect(current.progress.selection.recentUtteranceIds).toContain(
      initial.round.selection.utterance.id,
    );
    for (const entry of initial.round.exercise.entries) {
      expect(current.progress.selection.recentEntryIds).toContain(entry.id);
    }
  }, 30_000);

});
