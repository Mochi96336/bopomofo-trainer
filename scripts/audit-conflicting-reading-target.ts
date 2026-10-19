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
const cohorts = ["raw-no-weakness", "raw-weak-tone4", "legal-no-weakness", "legal-weak-tone4"] as const;
type Cohort = (typeof cohorts)[number];
interface Stats {
  sentenceCount: number;
  wrongHaoAdjectiveCount: number;
  goodHaoCount: number;
  validFourthToneCount: number;
  invalidDrawsCorrected: number;
  nonConflictingDrawsChanged: number;
}
const counts = Object.fromEntries(cohorts.map(c => [c, {
  sentenceCount: 0,
  wrongHaoAdjectiveCount: 0,
  goodHaoCount: 0,
  validFourthToneCount: 0,
  invalidDrawsCorrected: 0,
  nonConflictingDrawsChanged: 0,
}])) as Record<Cohort, Stats>;

const conflictExamples: Array<{
  seedIndex: number; initial: string; corrected: string; withTone4Weakness: boolean;
}> = [];

function sample(cohort: Cohort, seedIndex: number): CatalogEntry {
  const weak = cohort.endsWith("weak-tone4");
  const guarded = cohort.startsWith("legal");
  const selection = selectFormalSyntaxUtterance({
    entries,
    profiles,
    mode,
    layoutId,
    history,
    policy: FREQUENCY_FIRST_UTTERANCE_POLICY,
    random: createSeededRandom("targeted-fourth-tone-conflict:" + seedIndex),
    formalSyntaxComposition: { rules: [rule], samplingMode: "raw" },
    bindingEvidence: weak ? [{
      scope: { mode, layoutId, tokenId: "tone:4" },
      attempts: 16, errors: 12, timingSamples: 0,
      currentTimeToTypeMs: null, bestTimeToTypeMs: null,
    }] : [],
    ...(guarded ? { readingEligibility: reviewedRoleReadingEligible } : {}),
  });
  if (selection.utterance.entries.length !== 2
    || selection.utterance.entries[0]?.id !== he.id) {
    throw new Error("controlled conflict produced unexpected sentence structure");
  }
  const adjective = selection.utterance.entries[1]!;
  if (guarded) {
    const selectedProfile = profiles.find(profile => profile.entryId === adjective.id);
    if (selectedProfile === undefined
      || !reviewedRoleReadingEligible(adjective, selectedProfile)) {
      throw new Error("protected selector emitted invalid 好/ADJ reading");
    }
  }
  const stats = counts[cohort];
  stats.sentenceCount++;
  stats.wrongHaoAdjectiveCount += Number(adjective.id === fond.id);
  stats.goodHaoCount += Number(adjective.id === good.id);
  stats.validFourthToneCount += Number(adjective.id === bad.id);
  return adjective;
}

for (let seedIndex = 0; seedIndex < sampleCount; seedIndex++) {
  for (const weak of [false, true]) {
    const originalGroup: Cohort = weak ? "raw-weak-tone4" : "raw-no-weakness";
    const licensedGroup: Cohort = weak ? "legal-weak-tone4" : "legal-no-weakness";
    const originallySelected = sample(originalGroup, seedIndex);
    const legallySelected = sample(licensedGroup, seedIndex);
    const legal = counts[licensedGroup];
    if (originallySelected.id === fond.id) {
      legal.invalidDrawsCorrected++;
      if (legallySelected.id !== good.id && legallySelected.id !== bad.id) {
        throw new Error("invalid reading failed to redraw a legal adjective");
      }
      if (conflictExamples.length < 16) conflictExamples.push({
        seedIndex,
        initial: originallySelected.id,
        corrected: legallySelected.id,
        withTone4Weakness: weak,
      });
    } else if (legallySelected.id !== originallySelected.id) {
      legal.nonConflictingDrawsChanged++;
      throw new Error("valid initial word/readings changed without a legal conflict");
    }
  }
}

for (const name of ["legal-no-weakness", "legal-weak-tone4"] as const) {
  if (counts[name].wrongHaoAdjectiveCount !== 0 || counts[name].invalidDrawsCorrected === 0
    || counts[name].nonConflictingDrawsChanged !== 0) {
    throw new Error("reviewed reading was not contextually stable");
  }
}
if (!(counts["legal-weak-tone4"].validFourthToneCount
  > counts["legal-no-weakness"].validFourthToneCount)) {
  throw new Error("error boost did not increase *legitimate* fourth-tone practice exposure");
}

const summary = {
  schemaVersion: "legally-weighted-lexical-redraw-v3",
  purpose: "reading validity is independent of learner weakness; lexical-slot legal redraw uses legal target weights",
  sampleCount,
  entries: [good.id, fond.id, bad.id],
  syntheticLearnerWeakness: { tokenId: "tone:4", attempts: 16, errors: 12 },
  counts,
  conflictExamples,
  limitations: [
    "Restricted three-adjective fixture, not representative of full catalog",
    "The original word may change upon an invalid reading; that is lexical selection, not reinterpretation of its pronunciation",
    "There is no gold label for naturalness or real user learning effectiveness",
  ],
};
const output = "data/generated/conflicting-target-exposure.json";
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(summary, null, 2) + "\n", "utf8");
console.log(JSON.stringify(summary, null, 2));
