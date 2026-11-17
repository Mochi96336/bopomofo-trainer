import { describe, expect, it } from "vitest";
import { PRACTICE_CATALOG, SYNTAX_PROFILES, COMMONNESS_TIER_THRESHOLDS } from "../../src/app/generated/catalog.js";
import { COMMONNESS_TIERS } from "../../src/commonness/tiers.js";
import { updateFrequencyFirstSelectionState } from "../../src/curriculum/frequency-first-utterance.js";
import { catalogsForCommonnessTiers } from "../../src/product/commonness-access.js";
import { createProductEnvironment, createFreshProgressForEnvironment, createProductState } from "../../src/product/session.js";
import { PRODUCT_READING_POLICY } from "../../src/readings/product-reading-policy.js";
import type { CatalogEntry } from "../../src/core/model.js";
import type { RuntimeSyntaxProfile } from "../../src/syntax/types.js";

type Gate = (entry: CatalogEntry, profile: RuntimeSyntaxProfile, slot: unknown, previous: CatalogEntry | null) => boolean;
/** Strictly the five role-mismatched readings reviewed against Taiwan MOE Revised 2021.
 * Source links and evidence statuses: docs/audits/pr464-tier1-role-review.md
 * THIS IS NOT A PRODUCTION POLICY OR AUTHORIZATION TO MERGE.
 */
const PILOT_REJECTIONS = new Map([
  ["都/NOUN", "word:都:ㄉㄡ1"],
  ["說/NOUN", "word:說:ㄕㄨㄟ4"],
  ["號/NOUN", "word:號:ㄏㄠ2"],
  ["了/VERB", "word:了:ㄌㄜ5"],
  ["給/ADP", "word:給:ㄐㄧ3"],
]);

function rejected(entry: CatalogEntry, profile: RuntimeSyntaxProfile): boolean {
  return PILOT_REJECTIONS.get(entry.prompt.text + "/" + profile.upos) === entry.id;
}

describe("PR464 independent-evidence role-mismatch A/B preview (read-only)", () => {
  it("compares baseline and source-scoped rejections with the same product seeds", () => {
    const mutable = PRODUCT_READING_POLICY as unknown as { readingEligibility: Gate };
    const original = mutable.readingEligibility;
    const whole = { practice: PRACTICE_CATALOG, syntaxProfiles: SYNTAX_PROFILES };
    const scenarios = [];
    try {
      for (const tier of [null, 1] as const) {
        const catalogs = tier === null ? whole : catalogsForCommonnessTiers(whole, COMMONNESS_TIER_THRESHOLDS, [tier]);
        const environment = createProductEnvironment(catalogs);
        const outcomes = [];
        for (const mode of ["baseline", "pilot"] as const) {
          let pilotRejections = 0;
          mutable.readingEligibility = (entry, profile, slot, previous) => {
            const eligible = original(entry, profile, slot, previous);
            if (eligible && mode === "pilot" && rejected(entry, profile)) {
              pilotRejections++;
              return false;
            }
            return eligible;
          };
          let progress = createFreshProgressForEnvironment(
            environment, "selection-quality-v2:" + (tier ?? "all"), "guided", "standard",
          );
          const unique = new Set<string>();
          const exposures: Record<string, number> = {};
          const delivered: string[] = [];
          let lexicalOccurrences = 0;
          for (let round = 0; round < 128; round++) {
            const state = createProductState(environment, progress, 0);
            const result = state.round.selection;
            const words = [];
            for (let i = 0; i < result.utterance.entries.length; i++) {
              const entry = result.utterance.entries[i]!;
              const profile = environment.catalogs.syntaxProfiles.find(
                p=>p.id === result.utterance.syntaxProfileIds![i]
              );
              if (!profile) throw Error("selected profile not found");
              if (mode === "pilot") expect(rejected(entry, profile)).toBe(false);
              unique.add(entry.prompt.text);
              const key = entry.prompt.text + "/" + profile.upos + "/" + entry.id;
              if (PILOT_REJECTIONS.has(entry.prompt.text + "/" + profile.upos)) {
                exposures[key]=(exposures[key]||0)+1;
              }
              lexicalOccurrences++;
              words.push(entry.id);
            }
            delivered.push(words.join(","));
            progress = { ...progress, practiceRoundsCompleted: round + 1,
              selection: updateFrequencyFirstSelectionState(progress.selection, result, environment.utterancePolicy) };
          }
          outcomes.push({mode, deliveredUniqueWords: unique.size, lexicalOccurrences, pilotGateRejectCalls:pilotRejections, exposures, delivered});
        }
        const baseline=outcomes[0]!, pilot=outcomes[1]!;
        expect(baseline.deliveredUniqueWords).toBe(tier===null?373:304);
        scenarios.push({tier: tier??"all", samples:128,
          baseline:{deliveredUniqueWords:baseline.deliveredUniqueWords, lexicalOccurrences:baseline.lexicalOccurrences, exposures:baseline.exposures},
          pilot:{deliveredUniqueWords:pilot.deliveredUniqueWords, lexicalOccurrences:pilot.lexicalOccurrences, exposures:pilot.exposures, gateRejectCalls:pilot.pilotGateRejectCalls},
          changedRoundPositions:baseline.delivered.filter((x,i)=>x!==pilot.delivered[i]).length,
          interpretation:"Matched seed namespace; sequential recency diverges after first change. Observed delivery differences are not marginal probabilities or verified context-correct pronunciation.",
        });
      }
    } finally {
      mutable.readingEligibility=original;
    }
    console.log("PR464_ROLE_PILOT_JSON_BEGIN");
    console.log(JSON.stringify({version:"pr464-role-evidence-pilot-v1",sourceCommit:"2bd6e024ee9f58ed6266ddf6dbeae1dde88659e1",excluded:[...PILOT_REJECTIONS],scenarios}));
    console.log("PR464_ROLE_PILOT_JSON_END");
  }, 240_000);
});
