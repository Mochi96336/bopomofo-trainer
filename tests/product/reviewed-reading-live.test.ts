import { reviewedMoeSupplementalRoleEligible, reviewedMoeSupplementFollowupRoleEligible, reviewedMoeExtendedRoleEligible, reviewedMoeQianRoleEligible } from "../../src/readings/moe-supplemental-role-license.js";
import { describe, expect, it } from "vitest";
import { COMMONNESS_TIER_THRESHOLDS, PRACTICE_CATALOG, SYNTAX_PROFILES } from "../../src/app/generated/catalog.js";
import { COMMONNESS_TIERS } from "../../src/commonness/tiers.js";
import {
  selectFormalSyntaxUtterance,
} from "../../src/curriculum/frequency-first-utterance.js";
import { createSeededRandom } from "../../src/curriculum/random.js";
import { catalogsForCommonnessTiers } from "../../src/product/commonness-access.js";
import {
  createFreshProgressForEnvironment,
  createProductEnvironment,
  createProductState,
} from "../../src/product/session.js";
import { reviewedRoleReadingEligible } from "../../src/readings/pronominal-role-license.js";
import { reviewedMoeStandardLeReadingEligible } from "../../src/readings/moe-standard-le.js";
import { reviewedMoeStandardBiReadingEligible } from "../../src/readings/moe-standard-bi.js";
import { reviewedMoeStandardDeReadingEligible } from "../../src/readings/moe-standard-de.js";
import { reviewedMoeStandardYuReadingEligible } from "../../src/readings/moe-standard-yu.js";
import { reviewedMoeStandardNanReadingEligible } from "../../src/readings/moe-standard-nan.js";
import { reviewedMoeStandardXingReadingEligible } from "../../src/readings/moe-standard-xing.js";
import { reviewedMoeStandardGuoReadingEligible } from "../../src/readings/moe-standard-guo.js";
import { reviewedMoeNaSurnameRoleEligible } from "../../src/readings/moe-na-surname-role.js";
import { reviewedMoeOrdinalRoomReadingEligible } from "../../src/readings/moe-ordinal-room.js";
import { reviewedMoeNumericFenReadingEligible } from "../../src/readings/moe-numeric-fen.js";
import { reviewedHanCoordinationReadingEligible } from "../../src/readings/han-coordination-license.js";
import { reviewedMoeAttestedRoleEligible, reviewedMoeFollowupRoleEligible, reviewedMoeThirdRoleEligible, reviewedMoeFourthRoleEligible, reviewedMoeFifthRoleEligible, reviewedMoeSixthRoleEligible, reviewedMoeSeventhRoleEligible, reviewedMoeEighthRoleEligible, reviewedMoeTenthRoleEligible } from "../../src/readings/moe-attested-role-compatibility.js";

const wholeCatalogs = { practice: PRACTICE_CATALOG, syntaxProfiles: SYNTAX_PROFILES };
const standardLayout = "standard";

function selectionInput(
  environment: ReturnType<typeof createProductEnvironment>,
  progress: ReturnType<typeof createFreshProgressForEnvironment>,
) {
  return {
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
    random: createSeededRandom(progress.seed + ":practice:0"),
  };
}

/**
 * Share the hàn pre-draw frontier before comparing the remaining reviewed
 * repairs. Removing unlicensed hàn profiles changes a weighted draw's landing
 * point even when the previously selected entry was legal. Other product
 * reading gates remain absent here and their limited repairs are checked below.
 */
function selectComparisonBaseline(
  environment: ReturnType<typeof createProductEnvironment>,
  progress: ReturnType<typeof createFreshProgressForEnvironment>,
) {
  return selectFormalSyntaxUtterance({
    ...selectionInput(environment, progress),
    preDrawReadingEligibility: reviewedHanCoordinationReadingEligible,
  });
}

function assertRoundReadings(
  state: ReturnType<typeof createProductState>,
  profilesById: ReadonlyMap<string, typeof SYNTAX_PROFILES[number]>,
): void {
  const candidate = state.round.selection.utterance;
  expect(candidate.syntaxProfileIds?.length).toBe(candidate.entries.length);
  for (let i = 0; i < candidate.entries.length; i += 1) {
    const profile = profilesById.get(candidate.syntaxProfileIds![i]!);
    expect(profile).toBeDefined();
    expect(reviewedRoleReadingEligible(candidate.entries[i]!, profile!)).toBe(true);
    expect(reviewedMoeStandardLeReadingEligible(candidate.entries[i]!, profile!)).toBe(true);
    expect(reviewedMoeStandardBiReadingEligible(candidate.entries[i]!, profile!)).toBe(true);
    expect(reviewedMoeStandardDeReadingEligible(candidate.entries[i]!, profile!)).toBe(true);
    expect(reviewedMoeStandardYuReadingEligible(candidate.entries[i]!, profile!)).toBe(true);
    expect(reviewedMoeStandardNanReadingEligible(candidate.entries[i]!, profile!)).toBe(true);
    expect(reviewedMoeStandardXingReadingEligible(candidate.entries[i]!, profile!)).toBe(true);
    expect(reviewedMoeStandardGuoReadingEligible(candidate.entries[i]!, profile!)).toBe(true);
    expect(reviewedMoeNaSurnameRoleEligible(candidate.entries[i]!, profile!)).toBe(true);
    expect(reviewedMoeAttestedRoleEligible(candidate.entries[i]!, profile!)).toBe(true);
    expect(reviewedMoeFollowupRoleEligible(candidate.entries[i]!, profile!)).toBe(true);
    expect(reviewedMoeThirdRoleEligible(candidate.entries[i]!, profile!)).toBe(true);
    expect(reviewedMoeFourthRoleEligible(candidate.entries[i]!, profile!)).toBe(true);
    expect(reviewedMoeFifthRoleEligible(candidate.entries[i]!, profile!)).toBe(true);
    expect(reviewedMoeSixthRoleEligible(candidate.entries[i]!, profile!)).toBe(true);
    expect(reviewedMoeSeventhRoleEligible(candidate.entries[i]!, profile!)).toBe(true);
    expect(reviewedMoeEighthRoleEligible(candidate.entries[i]!, profile!)).toBe(true);
    expect(reviewedMoeTenthRoleEligible(candidate.entries[i]!, profile!)).toBe(true);
    expect(reviewedMoeSupplementalRoleEligible(candidate.entries[i]!, profile!)).toBe(true);
    expect(reviewedMoeSupplementFollowupRoleEligible(candidate.entries[i]!, profile!)).toBe(true);
    expect(reviewedMoeExtendedRoleEligible(candidate.entries[i]!, profile!)).toBe(true);
    expect(reviewedMoeQianRoleEligible(candidate.entries[i]!, profile!)).toBe(true);
    expect(reviewedHanCoordinationReadingEligible(candidate.entries[i]!, profile!)).toBe(true);
    expect(reviewedMoeNumericFenReadingEligible(candidate.entries[i]!, profile!, null, i===0?null:candidate.entries[i-1]!)).toBe(true);
    expect(reviewedMoeOrdinalRoomReadingEligible(candidate.entries[i]!, profile!, null, i===0?null:candidate.entries[i-1]!)).toBe(true);
  }
  expect(state.round.exercise.entries.map(entry => entry.id)).toEqual(
    candidate.entries.map(entry => entry.id),
  );
}

/**
 * A strictly legal 第N frontier may legitimately draw a different adjacent
 * word without any change to the rest of the sentence/grammar.
 */
function assertOnlyOrdinalAdjacentSlotChanged(
  original: ReturnType<typeof selectFormalSyntaxUtterance>["utterance"],
  next: ReturnType<typeof selectFormalSyntaxUtterance>["utterance"],
  seed: string,
): void {
  expect(next.syntaxRootRuleId).toBe(original.syntaxRootRuleId);
  expect(next.entries.length).toBe(original.entries.length);
  const changed = original.entries.flatMap((item, i) =>
    item.id === next.entries[i]?.id ? [] : [i]);
  expect(changed).toHaveLength(1);
  const at = changed[0]!;
  expect(at, JSON.stringify({ seed, original: original.entries.map(entry => entry.id),
    next: next.entries.map(entry => entry.id) })).toBeGreaterThan(0);
  expect(original.entries[at - 1]?.id).toBe(next.entries[at - 1]?.id);
  expect(original.entries[at - 1]?.prompt.text)
    .toMatch(/^第[一二三四五六七八九十百千萬兩零〇0-9０-９]+$/u);
}

describe("production reviewed reading disambiguation", () => {
  it("only repairs a fresh-user round's rejected reading after sharing the hàn pre-draw frontier", () => {
    const environment = createProductEnvironment(wholeCatalogs);
    const profilesById = new Map(environment.catalogs.syntaxProfiles.map(p => [p.id, p]));
    let observedRejects = 0;
    for (let seedIndex = 0; seedIndex < 128; seedIndex += 1) {
      const seed = "reading-live-" + seedIndex;
      const progress = createFreshProgressForEnvironment(environment, seed, "guided", standardLayout);
      const original = selectComparisonBaseline(environment, progress);
      const originalCandidate = original.utterance;
      const originalRejected = originalCandidate.entries.some((entry, i) => {
        const profile = profilesById.get(originalCandidate.syntaxProfileIds?.[i] ?? "");
        if (profile === undefined) throw new Error("expected a profile for each selected entry");
        return !reviewedRoleReadingEligible(entry, profile)
          || !reviewedMoeStandardLeReadingEligible(entry, profile)
          || !reviewedMoeStandardBiReadingEligible(entry, profile)
          || !reviewedMoeStandardDeReadingEligible(entry, profile)
          || !reviewedMoeStandardYuReadingEligible(entry, profile)
          || !reviewedMoeStandardNanReadingEligible(entry, profile)
          || !reviewedMoeStandardXingReadingEligible(entry, profile)
          || !reviewedMoeStandardGuoReadingEligible(entry, profile)
          || !reviewedMoeNaSurnameRoleEligible(entry, profile)
          || !reviewedMoeAttestedRoleEligible(entry, profile)
          || !reviewedMoeFollowupRoleEligible(entry, profile)
          || !reviewedMoeThirdRoleEligible(entry, profile)
          || !reviewedMoeFourthRoleEligible(entry, profile)
          || !reviewedMoeFifthRoleEligible(entry, profile)
          || !reviewedMoeSixthRoleEligible(entry, profile)
          || !reviewedMoeSeventhRoleEligible(entry, profile)
          || !reviewedMoeEighthRoleEligible(entry, profile)
          || !reviewedMoeOrdinalRoomReadingEligible(entry, profile, null, i===0?null:originalCandidate.entries[i-1]!)
          || !reviewedMoeTenthRoleEligible(entry, profile)
          || !reviewedMoeSupplementalRoleEligible(entry, profile)
          || !reviewedMoeSupplementFollowupRoleEligible(entry, profile)
          || !reviewedMoeExtendedRoleEligible(entry, profile)
          || !reviewedMoeQianRoleEligible(entry, profile)
          || !reviewedHanCoordinationReadingEligible(entry, profile)
          || !reviewedMoeNumericFenReadingEligible(entry, profile, null, i===0?null:originalCandidate.entries[i-1]!);
      });
      const actual = createProductState(environment, progress, 0);
      assertRoundReadings(actual, profilesById);
      const changed = originalCandidate.id !== actual.round.selection.utterance.id;
      if (originalRejected) {
        observedRejects += 1;
        expect(changed).toBe(true);
      } else if (changed) {
        assertOnlyOrdinalAdjacentSlotChanged(originalCandidate, actual.round.selection.utterance, seed);
      }
      expect(actual.progress).toBe(progress);
      expect(actual.round.selection.score.entryIds).toEqual(
        actual.round.exercise.entries.map(entry => entry.id),
      );
    }
    // Demonstrate that this end-to-end test exercised the actual repair path,
    // rather than merely observing coincidentally valid draws.
    expect(observedRejects).toBeGreaterThan(0);
  }, 30000);

  it.each([...COMMONNESS_TIERS])(
    "keeps real filtered tier %i eligible without exhausting product generation",
    (tier) => {
      const narrowed = catalogsForCommonnessTiers(wholeCatalogs, COMMONNESS_TIER_THRESHOLDS, [tier]);
      const environment = createProductEnvironment(narrowed);
      const profilesById = new Map(environment.catalogs.syntaxProfiles.map(p => [p.id, p]));
      let baselineFailures = 0;
      let productFailures = 0;
      for (let i = 0; i < 24; i += 1) {
        const progress = createFreshProgressForEnvironment(
          environment,
          "reading-tier-" + tier + ":" + i,
          i % 2 === 0 ? "guided" : "recall",
          standardLayout,
        );
        let original: ReturnType<typeof selectFormalSyntaxUtterance> | null = null;
        try {
          original = selectComparisonBaseline(environment, progress);
        } catch {
          baselineFailures += 1;
        }
        let product: ReturnType<typeof createProductState> | null = null;
        try {
          product = createProductState(environment, progress, 0);
        } catch (error) {
          productFailures += 1;
          // The rarest tier's original syntax sampler has pre-existing failed
          // seeds. Do not obscure them, and never allow this reading gate to
          // introduce a new failed seed in any tier.
          if (original !== null) {
            throw new Error("new reading-gate product failure in tier " + tier
              + " seed " + i + ": " + String(error));
          }
        }
        if (product !== null) {
          assertRoundReadings(product, profilesById);
          if (original !== null) {
            const originalLicensed = original.utterance.entries.every((entry, index) => {
              const profileId = original!.utterance.syntaxProfileIds?.[index];
              const profile = profilesById.get(profileId ?? "");
              if (profile === undefined) throw new Error("missing original syntax profile");
              return reviewedRoleReadingEligible(entry, profile)
                && reviewedMoeStandardLeReadingEligible(entry, profile)
                && reviewedMoeStandardBiReadingEligible(entry, profile)
                && reviewedMoeStandardDeReadingEligible(entry, profile)
                && reviewedMoeStandardYuReadingEligible(entry, profile)
                && reviewedMoeStandardNanReadingEligible(entry, profile)
                && reviewedMoeStandardXingReadingEligible(entry, profile)
                && reviewedMoeStandardGuoReadingEligible(entry, profile)
                && reviewedMoeNaSurnameRoleEligible(entry, profile)
                && reviewedMoeAttestedRoleEligible(entry, profile)
                && reviewedMoeFollowupRoleEligible(entry, profile)
                && reviewedMoeThirdRoleEligible(entry, profile)
                && reviewedMoeFourthRoleEligible(entry, profile)
                && reviewedMoeFifthRoleEligible(entry, profile)
                && reviewedMoeSixthRoleEligible(entry, profile)
                && reviewedMoeSeventhRoleEligible(entry, profile)
                && reviewedMoeEighthRoleEligible(entry, profile)
                && reviewedMoeOrdinalRoomReadingEligible(entry, profile, null, index===0?null:original.utterance.entries[index-1]!)
                && reviewedMoeTenthRoleEligible(entry, profile)
                && reviewedMoeSupplementalRoleEligible(entry, profile)
                && reviewedMoeSupplementFollowupRoleEligible(entry, profile)
                && reviewedMoeExtendedRoleEligible(entry, profile)
                && reviewedMoeQianRoleEligible(entry, profile)
                && reviewedHanCoordinationReadingEligible(entry, profile)
                && reviewedMoeNumericFenReadingEligible(entry, profile, null, index===0?null:original.utterance.entries[index-1]!);
            });
            if (originalLicensed
              && product.round.selection.utterance.id !== original.utterance.id) {
              assertOnlyOrdinalAdjacentSlotChanged(original.utterance, product.round.selection.utterance, progress.seed);
            }
          }
        }
      }
      expect(productFailures).toBeLessThanOrEqual(baselineFailures);

    },
    20000,
  );

  it("replays the two observed hàn frontier changes in only slot zero through the real product", () => {
    const cases = [
      {
        seed: "reading-live-2", tier: null,
        original: ["word:香:ㄒㄧㄤ1", "word:沒:ㄇㄟ2", "word:不會:ㄅㄨ4-ㄏㄨㄟ4",
          "word:想:ㄒㄧㄤ3", "word:投入:ㄊㄡ2-ㄖㄨ4", "word:什麼:ㄕㄣ2-ㄇㄜ5"],
        replacement: "word:裴林:ㄆㄟ2-ㄌㄧㄣ2",
      },
      {
        seed: "reading-tier-1:4", tier: 1,
        original: ["word:元:ㄩㄢ2", "word:非:ㄈㄟ1", "word:必須:ㄅㄧ4-ㄒㄩ1",
          "word:把:ㄅㄚ3", "word:成:ㄔㄥ2", "word:結合:ㄐㄧㄝ2-ㄏㄜ2"],
        replacement: "word:法:ㄈㄚ3",
      },
    ] as const;
    for (const fixture of cases) {
      const catalogs = fixture.tier === null ? wholeCatalogs
        : catalogsForCommonnessTiers(wholeCatalogs, COMMONNESS_TIER_THRESHOLDS, [fixture.tier]);
      const environment = createProductEnvironment(catalogs);
      const profilesById = new Map(environment.catalogs.syntaxProfiles.map(profile => [profile.id, profile]));
      const progress = createFreshProgressForEnvironment(environment, fixture.seed, "guided", standardLayout);
      const unguarded = selectFormalSyntaxUtterance(selectionInput(environment, progress)).utterance;
      const frontier = selectComparisonBaseline(environment, progress).utterance;
      expect(unguarded.entries.map(entry => entry.id)).toEqual(fixture.original);
      for (let i = 0; i < unguarded.entries.length; i += 1) {
        const profile = profilesById.get(unguarded.syntaxProfileIds![i]!)!;
        expect(reviewedHanCoordinationReadingEligible(unguarded.entries[i]!, profile)).toBe(true);
      }
      expect(frontier.syntaxRootRuleId).toBe(unguarded.syntaxRootRuleId);
      expect(frontier.entries.map(entry => entry.id)).toEqual([
        fixture.replacement, ...fixture.original.slice(1),
      ]);
      expect(frontier.syntaxProfileIds?.slice(1)).toEqual(unguarded.syntaxProfileIds?.slice(1));
      const product = createProductState(environment, progress, 0);
      assertRoundReadings(product, profilesById);
      expect(product.round.selection.utterance.id).toBe(frontier.id);
    }
  });
});
