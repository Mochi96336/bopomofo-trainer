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

const wholeCatalogs = { practice: PRACTICE_CATALOG, syntaxProfiles: SYNTAX_PROFILES };
const standardLayout = "standard";

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
  }
  expect(state.round.exercise.entries.map(entry => entry.id)).toEqual(
    candidate.entries.map(entry => entry.id),
  );
}

describe("production reviewed reading disambiguation", () => {
  it("only changes a fresh-user round if its unguarded reading was rejected", () => {
    const environment = createProductEnvironment(wholeCatalogs);
    const profilesById = new Map(environment.catalogs.syntaxProfiles.map(p => [p.id, p]));
    let observedRejects = 0;
    let unexpectedChanges = 0;
    for (let seedIndex = 0; seedIndex < 128; seedIndex += 1) {
      const seed = "reading-live-" + seedIndex;
      const progress = createFreshProgressForEnvironment(environment, seed, "guided", standardLayout);
      const original = selectFormalSyntaxUtterance({
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
      const originalCandidate = original.utterance;
      const originalRejected = originalCandidate.entries.some((entry, i) => {
        const profile = profilesById.get(originalCandidate.syntaxProfileIds?.[i] ?? "");
        if (profile === undefined) throw new Error("expected a profile for each selected entry");
        return !reviewedRoleReadingEligible(entry, profile);
      });
      const actual = createProductState(environment, progress, 0);
      assertRoundReadings(actual, profilesById);
      const changed = originalCandidate.id !== actual.round.selection.utterance.id;
      if (originalRejected) {
        observedRejects += 1;
        expect(changed).toBe(true);
      } else if (changed) {
        unexpectedChanges += 1;
      }
      expect(actual.progress).toBe(progress);
      expect(actual.round.selection.score.entryIds).toEqual(
        actual.round.exercise.entries.map(entry => entry.id),
      );
    }
    expect(unexpectedChanges).toBe(0);
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
      for (let i = 0; i < 24; i += 1) {
        const progress = createFreshProgressForEnvironment(
          environment,
          "reading-tier-" + tier + ":" + i,
          i % 2 === 0 ? "guided" : "recall",
          standardLayout,
        );
        assertRoundReadings(createProductState(environment, progress, 0), profilesById);
      }
    },
    20000,
  );
});