import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { CatalogEntry } from "../src/core/model.js";
import { catalogEntryId } from "../src/core/catalog-entry-id.js";
import {
  FREQUENCY_FIRST_UTTERANCE_POLICY,
  selectFormalSyntaxUtterance,
} from "../src/curriculum/frequency-first-utterance.js";
import { createSeededRandom } from "../src/curriculum/random.js";
import { FORMAL_GRAMMAR_VERSION } from "../src/syntax/features.js";
import type { ProductionRule, RuntimeSyntaxProfile, Upos } from "../src/syntax/types.js";
import { reviewedRoleReadingEligible } from "../src/readings/pronominal-role-license.js";
import { preferReviewedHaoAdjectiveSurfaceRepair } from "../src/readings/adjective-role-license.js";

/**
 * Deliberately small conflict fixture. This is *not* a naturalness benchmark:
 * the point is to force a valid four-tone alternative to compete with the
 * wrongly selected 好:ㄏㄠ4 in an ADJ slot.
 *
 * The exact same production selector and user weakness scoring is exercised.
 * This reveals failure modes hidden by the sparse full-catalog A/B.
 */

const mode = "guided" as const;
const layoutId = "standard";
const history = { recentEntryIds: [], recentUtteranceIds: [], recentTemplateIds: [] };
const rule: ProductionRule = {
  id: "sentence.target-preservation",
  grammarVersion: FORMAL_GRAMMAR_VERSION,
  output: "Sentence",
  constituents: [
    {
      key: "subject", category: "Lexeme", minimum: 1, maximum: 1,
      recursive: false, allowedUpos: ["PRON"], requiredFunctions: ["subject"],
      requiredValencyFrames: [], requiredFeatures: {},
    },
    {
      key: "pred", category: "Lexeme", minimum: 1, maximum: 1,
      recursive: false, allowedUpos: ["ADJ"], requiredFunctions: ["predicate"],
      requiredValencyFrames: [], requiredFeatures: {},
    },
  ],
  surfaceOrders: [{ id: "canonical", constituentKeys: ["subject", "pred"] }],
  constraints: [],
  positiveFixtureIds: ["fixture:valid"],
  negativeFixtureIds: ["fixture:invalid"],
};
function entry(text: string, reading: string, tokens: readonly string[]): CatalogEntry {
  return {
    id: catalogEntryId(text, reading),
    prompt: { text, locale: "zh-TW" },
    syllables: [{ tokens }],
    tags: ["audit"], provenanceIds: ["audit"],
  };
}
function profile(entry: CatalogEntry, upos: Upos, fn: "subject" | "predicate"): RuntimeSyntaxProfile {
  return {
    id: entry.id + "/profile:" + upos,
    entryId: entry.id,
    upos,
    functions: [fn],
    valencyFrames: ["avalent"],
    dependencyEvidence: { dependencyRelationCounts: {}, surfacePositionCounts: {} },
    provenanceIds: ["audit"],
  };
}
const he = entry("他", "ㄊㄚ1", ["zhuyin:ㄊ", "zhuyin:ㄚ", "tone:1"]);
const good = entry("好", "ㄏㄠ3", ["zhuyin:ㄏ", "zhuyin:ㄠ", "tone:3"]);
const fond = entry("好", "ㄏㄠ4", ["zhuyin:ㄏ", "zhuyin:ㄠ", "tone:4"]);
const bad = entry("壞", "ㄏㄨㄞ4", ["zhuyin:ㄏ", "zhuyin:ㄨ", "zhuyin:ㄞ", "tone:4"]);
const entries: readonly CatalogEntry[] = [he, good, fond, bad];
const profiles: readonly RuntimeSyntaxProfile[] = [
  profile(he, "PRON", "subject"),
  profile(good, "ADJ", "predicate"),
  profile(fond, "ADJ", "predicate"),
  profile(bad, "ADJ", "predicate"),
];

const sampleCount = 1024;
const cohorts = [
  "unguarded", "old-legal-redraw", "same-word-correction",
  "no-weakness-unguarded", "no-weakness-legal-redraw", "no-weakness-correction",
] as const;
type Cohort = (typeof cohorts)[number];

const counts = Object.fromEntries(cohorts.map(x => [x, {
  sentences: 0, invalidGoodReading: 0,
  validTone4Target: 0, validTone3Target: 0,
  goodSelected: 0, badSelected: 0,
}])) as Record<Cohort, {
  sentences: number; invalidGoodReading: number; validTone4Target: number;
  validTone3Target: number; goodSelected: number; badSelected: number;
}>;
const conflictExamples: Array<{
  seed: number;
  initial: string;
  old: string;
  sameWord: string;
  oldTone4: boolean;
  sameWordTone4: boolean;
}> = [];
let conflicts = 0;
for (let seed = 0; seed < sampleCount; seed++) {
  const produced = new Map<Cohort, CatalogEntry>();
  for (const cohort of cohorts) {
    const selection = selectFormalSyntaxUtterance({
      entries,
      profiles,
      mode,
      layoutId,
      history,
      policy: FREQUENCY_FIRST_UTTERANCE_POLICY,
      random: createSeededRandom("targeted-fourth-tone-conflict:" + seed),
      formalSyntaxComposition: { rules: [rule], samplingMode: "raw" },
      bindingEvidence: cohort.startsWith("no-weakness") ? [] : [{
        scope: { mode, layoutId, tokenId: "tone:4" },
        attempts: 16, errors: 12, timingSamples: 0,
        currentTimeToTypeMs: null, bestTimeToTypeMs: null,
      }],
      ...((cohort === "unguarded" || cohort === "no-weakness-unguarded")
        ? {} : { readingEligibility: reviewedRoleReadingEligible }),
      ...(cohort === "same-word-correction" || cohort === "no-weakness-correction"
        ? { preferSameSurfaceOnReadingReject: preferReviewedHaoAdjectiveSurfaceRepair }
        : {}),
    });
    if (selection.utterance.entries.length !== 2
      || selection.utterance.entries[0]?.id !== he.id) {
      throw new Error("unexpected fixture structure");
    }
    const adjective = selection.utterance.entries[1]!;
    if (cohort !== "unguarded"
      && !reviewedRoleReadingEligible(adjective, profiles.find(p => p.entryId === adjective.id)!)) {
      throw new Error("guarded candidate produced illegal adjective reading");
    }
    produced.set(cohort, adjective);
    const stats = counts[cohort];
    stats.sentences++;
    stats.invalidGoodReading += Number(adjective.id === fond.id);
    stats.validTone4Target += Number(adjective.id === bad.id);
    stats.validTone3Target += Number(adjective.id === good.id);
    stats.goodSelected += Number(adjective.prompt.text === "好");
    stats.badSelected += Number(adjective.prompt.text === "壞");
  }
  const raw = produced.get("unguarded")!;
  const old = produced.get("old-legal-redraw")!;
  const fixed = produced.get("same-word-correction")!;
  const quietRaw = produced.get("no-weakness-unguarded")!;
  const quietOld = produced.get("no-weakness-legal-redraw")!;
  const quietFixed = produced.get("no-weakness-correction")!;
  if (raw.id === fond.id) {
    conflicts++;
    if (fixed.id !== good.id) {
      throw new Error("contextual reading must correct 好/ADJ to ㄏㄠ3 regardless of tone-4 weakness");
    }
    if (conflictExamples.length < 12) conflictExamples.push({
      seed, initial: raw.id, old: old.id, sameWord: fixed.id,
      oldTone4: old.id === bad.id,
      sameWordTone4: fixed.id === bad.id,
    });
  } else if (old.id !== fixed.id || raw.id !== fixed.id) {
    throw new Error("a valid lexical draw changed under reading policy");
  }
  if (quietRaw.id === fond.id) {
    if (quietFixed.id !== good.id) {
      throw new Error("the same 好/ADJ context must be corrected without weakness evidence");
    }
  } else if (quietOld.id !== quietFixed.id || quietRaw.id !== quietFixed.id) {
    throw new Error("a valid unweighted lexical draw changed under reading policy");
  }
}
if (conflicts === 0 || counts["old-legal-redraw"].invalidGoodReading !== 0
  || counts["same-word-correction"].invalidGoodReading !== 0) {
  throw new Error("conflict cohort did not exercise a safely resolved sample");
}
const summary = {
  schemaVersion: "contextual-reading-independent-of-weakness-v2",
  purpose: "prove a reviewed contextual reading is unaffected by learner weakness; quantify the separate exposure tradeoff",
  sampleCount,
  lexicalOptions: [good.id, fond.id, bad.id],
  syntheticLearnerWeakness: { tokenId: "tone:4", attempts: 16, errors: 12 },
  invalidInitialHaoAdjectiveDraws: conflicts,
  counts,
  tradeoff: {
    fourthTonePracticeLostToSameWordRepair:
      counts["old-legal-redraw"].validTone4Target - counts["same-word-correction"].validTone4Target,
    noWeaknessHaoLexemeRetainedByCorrection:
      counts["no-weakness-correction"].goodSelected - counts["no-weakness-legal-redraw"].goodSelected,
  },
  conflictExamples,
  limitations: [
    "Illustrative restricted lexicon, not a representative Chinese sentence distribution",
    "One deliberately conflicting adjective slot, synthetic learner record, and no recency",
    "Does not prove that whole-word preservation or tone exposure is always better for users",
  ],
};
const output = "data/generated/conflicting-target-exposure.json";
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(summary, null, 2) + "\n", "utf8");
console.log(JSON.stringify(summary, null, 2));
