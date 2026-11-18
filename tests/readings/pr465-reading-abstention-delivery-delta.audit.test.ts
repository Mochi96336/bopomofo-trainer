import { describe, expect, it } from "vitest";
import { PRACTICE_CATALOG, SYNTAX_PROFILES, COMMONNESS_TIER_THRESHOLDS } from "../../src/app/generated/catalog.js";
import { COMMONNESS_TIERS } from "../../src/commonness/tiers.js";
import { catalogsForCommonnessTiers } from "../../src/product/commonness-access.js";
import { createProductEnvironment, createFreshProgressForEnvironment, createProductState } from "../../src/product/session.js";
import { PRODUCT_READING_POLICY } from "../../src/readings/product-reading-policy.js";
import type { CatalogEntry } from "../../src/core/model.js";
import type { RuntimeSyntaxProfile } from "../../src/syntax/types.js";

type Filter = (
  frontier: readonly RuntimeSyntaxProfile[],
  entriesById: ReadonlyMap<string, CatalogEntry>,
) => readonly RuntimeSyntaxProfile[];

/**
 * PR #465 audit only. Measures final selected lexical identities, not removed
 * candidate profiles. The no-abstention arm is an UNSAFE counterfactual that
 * MUST NEVER be shipped. All other product grammar, reading gates, weights,
 * tiers, settings, and generation paths remain unchanged.
 *
 * Each seed is a separate fresh first-round state: unlike sequential A/B
 * replays, a difference on seed N cannot modify seed N+1 through recency.
 * This is a first-round paired sample, NOT a long-run exercise rate and NOT
 * independent evidence that any selected pronunciation is correct.
 *
 * No semantic, sense, naturalness, or sentence-quality gate is introduced.
 */
describe("PR465 read-only final-delivery reading abstention delta", () => {
  it("compares actual selected lexical entry IDs for paired fresh product rounds", () => {
    const mutable = PRODUCT_READING_POLICY as unknown as { readingFrontierFilter: Filter };
    const original = mutable.readingFrontierFilter;
    const passThrough: Filter = frontier => frontier;
    const scopeReports = [];
    const WHOLE = { practice: PRACTICE_CATALOG, syntaxProfiles: SYNTAX_PROFILES };
    const profileById = new Map(SYNTAX_PROFILES.map(profile => [profile.id, profile]));
    const cases = 128;

    try {
      for (const tier of [null, ...COMMONNESS_TIERS]) {
        const scope = tier === null ? "all" : String(tier);
        const catalogs = tier === null ? WHOLE : catalogsForCommonnessTiers(
          WHOLE, COMMONNESS_TIER_THRESHOLDS, [tier],
        );
        const environment = createProductEnvironment(catalogs);
        const exposed = {
          guarded: new Map<string, number>(),
          unguarded: new Map<string, number>(),
        };
        const signatures = {
          guarded: new Set<string>(),
          unguarded: new Set<string>(),
        };
        const forms = {
          guarded: new Set<string>(),
          unguarded: new Set<string>(),
        };
        const fallback = { guarded: 0, unguarded: 0 };
        const lexicalOccurrences = { guarded: 0, unguarded: 0 };
        let changedSelections = 0;
        let changedLexicalIdentities = 0;
        let sameFormReadingChangeRounds = 0;
        let sameFormReadingChangePositions = 0;
        const changedExamples: Array<{
          seed: number;
          guarded: string[];
          unguarded: string[];
        }> = [];

        for (let seed = 0; seed < cases; seed++) {
          const trial = (arm: "guarded" | "unguarded") => {
            mutable.readingFrontierFilter = arm === "guarded" ? original : passThrough;
            const progress = createFreshProgressForEnvironment(
              environment, "pr465:paired-reading-delivery:" + scope + ":" + seed,
              "guided", "standard",
            );
            const state = createProductState(environment, progress, 0);
            const utterance = state.round.selection.utterance;
            const ids = utterance.entries.map(e => e.id);
            const profileIds = utterance.syntaxProfileIds ?? [];
            if (profileIds.length !== ids.length) fallback[arm]++;
            for (let i = 0; i < ids.length; i++) {
              const entry = utterance.entries[i]!;
              forms[arm].add(entry.prompt.text);
              lexicalOccurrences[arm]++;
              const profile = profileById.get(profileIds[i] ?? "");
              const key = JSON.stringify([entry.id, profile?.upos ?? "none"]);
              exposed[arm].set(key, (exposed[arm].get(key) ?? 0) + 1);
            }
            const signature = JSON.stringify([ids, profileIds]);
            signatures[arm].add(signature);
            return { signature, ids, profileIds, forms: utterance.entries.map(e => e.prompt.text),
              upos: profileIds.map(id => profileById.get(id)?.upos ?? "none") };
          };
          const guarded = trial("guarded");
          const unguarded = trial("unguarded");
          if (guarded.signature !== unguarded.signature) {
            changedSelections++;
            if (JSON.stringify(guarded.ids) !== JSON.stringify(unguarded.ids)) {
              changedLexicalIdentities++;
            }
            let readingChangesThisRound = 0;
            for (let i = 0; i < Math.min(guarded.ids.length, unguarded.ids.length); i++) {
              if (guarded.forms[i] === unguarded.forms[i]
                && guarded.upos[i] === unguarded.upos[i]
                && guarded.ids[i] !== unguarded.ids[i]) {
                readingChangesThisRound++;
              }
            }
            if (readingChangesThisRound > 0) sameFormReadingChangeRounds++;
            sameFormReadingChangePositions += readingChangesThisRound;
            if (changedExamples.length < 5) {
              changedExamples.push({ seed, guarded: guarded.ids, unguarded: unguarded.ids });
            }
          }
        }
        const summary = (arm: "guarded" | "unguarded") => ({
          uniqueDeliveredForms: forms[arm].size,
          distinctDeliveredSentencesByLexicalIds: signatures[arm].size,
          lexicalOccurrences: lexicalOccurrences[arm],
          fallbackNonAlignedProfiles: fallback[arm],
          selectedIdentities: [...exposed[arm].entries()]
            .sort(([a], [b]) => a.localeCompare(b, "zh-Hant"))
            .map(([key, count]) => ({ key: JSON.parse(key), count })),
        });
        scopeReports.push({
          scope, pairedFreshFirstRounds: cases, changedSelections,
          changedLexicalIdentities, sameFormReadingChangeRounds, sameFormReadingChangePositions,
          guarded: summary("guarded"),
          unguarded: summary("unguarded"), changedExamples,
        });
      }

      expect(scopeReports).toHaveLength(5);
      expect(scopeReports.every(s => s.pairedFreshFirstRounds === cases)).toBe(true);
      console.log("PR465_DELIVERY_ABSTENTION_DELTA_BEGIN");
      console.log(JSON.stringify({
        version: "pr465-paired-first-round-reading-abstention-v1",
        baselineCommit: "2bd6e024ee9f58ed6266ddf6dbeae1dde88659e1",
        scopes: scopeReports,
        caveats: [
          "UNGUARDED is an unsafe audit counterfactual, not a deployable policy.",
          "Counts are FINAL selected lexical identities, not removed candidate frontiers.",
          "128 paired fresh first rounds per scope; no multi-round recency or long-run exposure inference.",
          "A same-form reading change counts aligned positions with identical written form and UPOS but different catalog entry IDs; it is not a correctness judgement.",
          "No semantic or sentence naturalness evaluation, and no new pronunciation truth labels.",
        ],
      }));
      console.log("PR465_DELIVERY_ABSTENTION_DELTA_END");
    } finally {
      mutable.readingFrontierFilter = original;
    }
  }, 240_000);
});
