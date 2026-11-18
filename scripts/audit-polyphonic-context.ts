import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { readingAuditCatalog } from "./reading-audit-catalog.js";
import { composeFormalSyntaxUtterances, prepareFormalSyntaxLexicon } from "../src/curriculum/formal-syntax-utterance.js";
import { FORMAL_SYNTAX_RULES } from "../src/syntax/grammar.js";
import { prepareStructuralSamplingContext } from "../src/syntax/sample.js";
import { createSeededRandom } from "../src/curriculum/random.js";
import { reviewedClosedClassReadingEligible } from "../src/readings/closed-class-license.js";
import { PRODUCT_READING_POLICY, PRODUCT_READING_POLICY_ID } from "../src/readings/product-reading-policy.js";
import { reviewedRoleReadingEligible } from "../src/readings/pronominal-role-license.js";
import { reviewedRoleAndOrdinalLineReadingEligible, reviewedOrdinalLineReadingEligible } from "../src/readings/ordinal-line-context.js";
import {
  reviewedAdjacentPreDrawReadingEligible,
  reviewedDuoshaoZhongReadingEligible,
} from "../src/readings/reviewed-adjacent-context.js";
import { reviewedMoeStandardLeReadingEligible } from "../src/readings/moe-standard-le.js";
import { reviewedMoeStandardBiReadingEligible } from "../src/readings/moe-standard-bi.js";
import { reviewedMoeStandardDeReadingEligible } from "../src/readings/moe-standard-de.js";
import { reviewedMoeStandardYuReadingEligible } from "../src/readings/moe-standard-yu.js";
import { reviewedMoeStandardNanReadingEligible } from "../src/readings/moe-standard-nan.js";
import { reviewedMoeStandardXingReadingEligible } from "../src/readings/moe-standard-xing.js";
import { reviewedMoeOrdinalRoomReadingEligible } from "../src/readings/moe-ordinal-room.js";
import { reviewedMoeNumericFenReadingEligible } from "../src/readings/moe-numeric-fen.js";
import { reviewedMoeSupplementalRoleEligible, reviewedMoeSupplementFollowupRoleEligible, reviewedMoeExtendedRoleEligible, reviewedMoeQianRoleEligible } from "../src/readings/moe-supplemental-role-license.js";
import { reviewedMoeStandardGuoReadingEligible } from "../src/readings/moe-standard-guo.js";
import { reviewedMoeNaSurnameRoleEligible } from "../src/readings/moe-na-surname-role.js";
import { reviewedMoeAttestedRoleEligible, reviewedMoeFollowupRoleEligible, reviewedMoeThirdRoleEligible, reviewedMoeFourthRoleEligible, reviewedMoeFifthRoleEligible, reviewedMoeSixthRoleEligible, reviewedMoeSeventhRoleEligible, reviewedMoeEighthRoleEligible, reviewedMoeTenthRoleEligible } from "../src/readings/moe-attested-role-compatibility.js";
import { reviewedZhongRolePilotEligible } from "../src/readings/zhong-role-pilot.js";
import {
  auditPolyphonicCandidate,
  buildPolyphonicReadingIndex,
  type PolyphonicContextHit,
} from "../src/readings/polyphonic-audit.js";

/**
 * Runs the same deterministic grammar inputs as the pinned phase-one product
 * baseline, without changing composer logic or production selection weights.
 *
 * npm run app:catalog
 * npx tsx scripts/audit-polyphonic-context.ts
 * npx tsx scripts/audit-polyphonic-context.ts --samples 100
 */
const SEED_NAMESPACE = "formal-syntax-v2-phase1-product-baseline-v1";
const { PRACTICE_CATALOG, SYNTAX_PROFILES } = readingAuditCatalog();

// Freeze the prior #436 shipping boundary for a true before/after comparison.
// It deliberately must NOT call reviewedAdjacentReadingEligible, which now
// contains the added MOE 了 standard gate in the trial branch.
const beforeMoeLeReadingEligible = (
  entry: (typeof PRACTICE_CATALOG)[number],
  profile: (typeof SYNTAX_PROFILES)[number],
  slot: unknown,
  previous: (typeof PRACTICE_CATALOG)[number] | null,
): boolean => reviewedRoleAndOrdinalLineReadingEligible(entry, profile, slot, previous)
  && reviewedDuoshaoZhongReadingEligible(entry, profile, previous);
const beforeMoeLePreDrawEligible = (
  entry: (typeof PRACTICE_CATALOG)[number],
  profile: (typeof SYNTAX_PROFILES)[number],
  _slot: unknown,
  previous: (typeof PRACTICE_CATALOG)[number] | null,
): boolean => reviewedOrdinalLineReadingEligible(entry, profile, previous)
  && reviewedDuoshaoZhongReadingEligible(entry, profile, previous);

// The currently shipping #437 rule, deliberately frozen before the new
// standalone 比 identity restriction. Prevent comparing the new gate to itself.
const beforeMoeBiReadingEligible = (
  entry: (typeof PRACTICE_CATALOG)[number],
  profile: (typeof SYNTAX_PROFILES)[number],
  slot: unknown,
  previous: (typeof PRACTICE_CATALOG)[number] | null,
): boolean => reviewedMoeStandardLeReadingEligible(entry, profile)
  && reviewedRoleAndOrdinalLineReadingEligible(entry, profile, slot, previous)
  && reviewedDuoshaoZhongReadingEligible(entry, profile, previous);

const PRODUCT_BOUNDS = {
  maximumPhraseDepth: 3,
  maximumClauseNesting: 1,
  maximumClausesPerSentence: 2,
  maximumCoordinationItems: 2,
  maximumConsecutiveModifiers: 2,
  maximumComplementsPerPredicate: 1,
  maximumLexicalEntriesPerUtterance: 6,
} as const;

type ReadingAuditPolicy = "none" | "reviewed-closed" | "reviewed-roles" | "zhong-role-trial" | "ordinal-line-trial" | "duoshao-zhong-trial" | "standard-le-trial" | "standard-bi-trial" | "standard-de-trial" | "standard-yu-trial" | "standard-nan-trial" | "standard-xing-trial" | "standard-guo-trial" | "standard-na-surname-trial" | "standard-role-evidence-trial" | "standard-role-followup-trial" | "standard-role-third-trial" | "standard-role-fourth-trial" | "standard-role-fifth-trial" | "standard-role-sixth-trial" | "standard-role-seventh-trial" | "standard-role-eighth-trial" | "standard-ordinal-room-trial" | "standard-role-tenth-trial" | "standard-numeric-fen-trial" | "standard-role-supplement-trial" | "standard-role-supplement-followup-trial" | "standard-role-extended-trial" | "standard-qian-role-trial" | "standard-han-coordination-trial";

function argumentsFromCli(): { samples: number; output: string; policy: ReadingAuditPolicy } {
  let samples = 2048;
  let output = "data/generated/polyphonic-context-exposure.json";
  let policy: ReadingAuditPolicy = "none";
  for (let i = 2; i < process.argv.length; i += 1) {
    const name = process.argv[i];
    const value = process.argv[++i];
    if (value === undefined) throw new Error("missing value for " + name);
    if (name === "--samples") {
      samples = Number(value);
      if (!Number.isSafeInteger(samples) || samples < 1 || samples > 100_000) {
        throw new Error("--samples must be an integer from 1 to 100000");
      }
    } else if (name === "--output") {
      output = value;
    } else if (name === "--policy") {
      if (value !== "none" && value !== "reviewed-closed" && value !== "reviewed-roles" && value !== "zhong-role-trial" && value !== "ordinal-line-trial" && value !== "duoshao-zhong-trial" && value !== "standard-le-trial" && value !== "standard-bi-trial" && value !== "standard-de-trial" && value !== "standard-yu-trial" && value !== "standard-nan-trial" && value !== "standard-xing-trial" && value !== "standard-guo-trial" && value !== "standard-na-surname-trial" && value !== "standard-role-evidence-trial" && value !== "standard-role-followup-trial" && value !== "standard-role-third-trial" && value !== "standard-role-fourth-trial" && value !== "standard-role-fifth-trial" && value !== "standard-role-sixth-trial" && value !== "standard-role-seventh-trial" && value !== "standard-role-eighth-trial" && value !== "standard-ordinal-room-trial" && value !== "standard-role-tenth-trial" && value !== "standard-numeric-fen-trial" && value !== "standard-role-supplement-trial" && value !== "standard-role-supplement-followup-trial" && value !== "standard-role-extended-trial" && value !== "standard-qian-role-trial" && value !== "standard-han-coordination-trial") {
        throw new Error("--policy accepts none, reviewed-closed, reviewed-roles, zhong-role-trial, ordinal-line-trial, duoshao-zhong-trial, standard-le-trial, standard-bi-trial, standard-de-trial standard-yu-trial standard-nan-trial standard-xing-trial standard-guo-trial standard-na-surname-trial standard-role-evidence-trial or standard-role-followup-trial or standard-role-third-trial or standard-role-fourth-trial or standard-role-fifth-trial or standard-role-sixth-trial or standard-role-seventh-trial or standard-role-eighth-trial or standard-ordinal-room-trial or standard-role-tenth-trial or standard-numeric-fen-trial or standard-role-supplement-trial or standard-role-supplement-followup-trial or standard-role-extended-trial or standard-qian-role-trial or standard-han-coordination-trial");
      }
      policy = value;
    } else {
      throw new Error("unknown option: " + name);
    }
  }
  return { samples, output, policy };
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function sortedCounts(map: ReadonlyMap<string, number>): Readonly<Record<string, number>> {
  return Object.fromEntries(
    [...map].sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0),
  );
}

const { samples, output, policy: requestedPolicy } = argumentsFromCli();
// Reuse the frozen pre-supplement chain without editing historical stages.
const usesSupplement = requestedPolicy === "standard-role-supplement-trial"
  || requestedPolicy === "standard-role-supplement-followup-trial" || requestedPolicy === "standard-role-extended-trial" || requestedPolicy === "standard-qian-role-trial" || requestedPolicy === "standard-han-coordination-trial";
const usesSupplementFollowup = requestedPolicy === "standard-role-supplement-followup-trial" || requestedPolicy === "standard-role-extended-trial" || requestedPolicy === "standard-qian-role-trial" || requestedPolicy === "standard-han-coordination-trial";
const policy = usesSupplement
  ? "standard-numeric-fen-trial" : requestedPolicy;
const preparedLexicon = prepareFormalSyntaxLexicon(PRACTICE_CATALOG, SYNTAX_PROFILES);
const preparedStructure = prepareStructuralSamplingContext(FORMAL_SYNTAX_RULES, PRODUCT_BOUNDS);
const ambiguous = buildPolyphonicReadingIndex(PRACTICE_CATALOG);
const profilesById = new Map(SYNTAX_PROFILES.map((profile) => [profile.id, profile]));
const hits: PolyphonicContextHit[] = [];
const sentences: Array<{
  readonly seedIndex: number;
  readonly text: string | null;
  readonly entryIds: readonly string[];
  readonly root: string | null;
}> = [];
const perText = new Map<string, number>();
const perEntryId = new Map<string, number>();
const perTextAndUpos = new Map<string, number>();
const fallbacks = new Map<string, number>();
let successfulSentences = 0;
let sentencesWithAmbiguousReadings = 0;

for (let seedIndex = 0; seedIndex < samples; seedIndex += 1) {
  const composition = composeFormalSyntaxUtterances({
    eligibleEntries: PRACTICE_CATALOG,
    profiles: SYNTAX_PROFILES,
    random: createSeededRandom(SEED_NAMESPACE + ":" + seedIndex),
    samplingMode: "product-family",
    minimumLexicalEntries: 2,
    maximumCandidates: 1,
    maximumAttempts: 64,
    bounds: PRODUCT_BOUNDS,
    ...(policy === "reviewed-closed"
      ? { readingEligibility: reviewedClosedClassReadingEligible }
      : policy === "reviewed-roles"
        ? { readingEligibility: reviewedRoleReadingEligible }
        : policy === "ordinal-line-trial"
          ? { readingEligibility: reviewedRoleAndOrdinalLineReadingEligible }
        : policy === "duoshao-zhong-trial"
          ? { readingEligibility: beforeMoeLeReadingEligible }
        : policy === "standard-le-trial"
          ? { readingEligibility: beforeMoeBiReadingEligible }
        : policy === "standard-bi-trial" || policy === "standard-de-trial" || policy === "standard-yu-trial" || policy === "standard-nan-trial" || policy === "standard-xing-trial" || policy === "standard-guo-trial" || policy === "standard-na-surname-trial" || policy === "standard-role-evidence-trial" || (policy === "standard-role-followup-trial" || (policy === "standard-role-third-trial" || (policy === "standard-role-fourth-trial" || (policy === "standard-role-fifth-trial" || (policy === "standard-role-sixth-trial" || (policy === "standard-role-seventh-trial" || (policy === "standard-role-eighth-trial" || (policy === "standard-ordinal-room-trial" || (policy === "standard-role-tenth-trial" || policy === "standard-numeric-fen-trial")))))))))
          ? { readingEligibility: beforeMoeBiReadingEligible }
        : policy === "zhong-role-trial"
          ? { readingEligibility: reviewedZhongRolePilotEligible }
          : {}),
    ...(policy === "standard-bi-trial" || policy === "standard-de-trial" || policy === "standard-yu-trial" || policy === "standard-nan-trial" || policy === "standard-xing-trial" || policy === "standard-guo-trial" || policy === "standard-na-surname-trial" || policy === "standard-role-evidence-trial" || (policy === "standard-role-followup-trial" || (policy === "standard-role-third-trial" || (policy === "standard-role-fourth-trial" || (policy === "standard-role-fifth-trial" || (policy === "standard-role-sixth-trial" || (policy === "standard-role-seventh-trial" || (policy === "standard-role-eighth-trial" || (policy === "standard-ordinal-room-trial" || (policy === "standard-role-tenth-trial" || policy === "standard-numeric-fen-trial")))))))))
      ? { finalCandidateReadingEligibility: reviewedMoeStandardBiReadingEligible } : {}),
    ...(policy === "standard-de-trial" || policy === "standard-yu-trial" || policy === "standard-nan-trial" || policy === "standard-xing-trial" || policy === "standard-guo-trial" || policy === "standard-na-surname-trial" || policy === "standard-role-evidence-trial" || (policy === "standard-role-followup-trial" || (policy === "standard-role-third-trial" || (policy === "standard-role-fourth-trial" || (policy === "standard-role-fifth-trial" || (policy === "standard-role-sixth-trial" || (policy === "standard-role-seventh-trial" || (policy === "standard-role-eighth-trial" || (policy === "standard-ordinal-room-trial" || (policy === "standard-role-tenth-trial" || policy === "standard-numeric-fen-trial")))))))))
      ? { subsequentFinalCandidateReadingEligibility: reviewedMoeStandardDeReadingEligible } : {}),
    ...(policy === "standard-yu-trial" || policy === "standard-nan-trial" || policy === "standard-xing-trial" || policy === "standard-guo-trial" || policy === "standard-na-surname-trial" || policy === "standard-role-evidence-trial" || (policy === "standard-role-followup-trial" || (policy === "standard-role-third-trial" || (policy === "standard-role-fourth-trial" || (policy === "standard-role-fifth-trial" || (policy === "standard-role-sixth-trial" || (policy === "standard-role-seventh-trial" || (policy === "standard-role-eighth-trial" || (policy === "standard-ordinal-room-trial" || (policy === "standard-role-tenth-trial" || policy === "standard-numeric-fen-trial")))))))))
      ? { additionalFinalCandidateReadingEligibilities: [
          reviewedMoeStandardYuReadingEligible,
          ...(policy === "standard-nan-trial" || policy === "standard-xing-trial" || policy === "standard-guo-trial" || policy === "standard-na-surname-trial" || policy === "standard-role-evidence-trial" || (policy === "standard-role-followup-trial" || (policy === "standard-role-third-trial" || (policy === "standard-role-fourth-trial" || (policy === "standard-role-fifth-trial" || (policy === "standard-role-sixth-trial" || (policy === "standard-role-seventh-trial" || (policy === "standard-role-eighth-trial" || (policy === "standard-ordinal-room-trial" || (policy === "standard-role-tenth-trial" || policy === "standard-numeric-fen-trial"))))))))) ? [reviewedMoeStandardNanReadingEligible] : []),
          ...(policy === "standard-xing-trial" || policy === "standard-guo-trial" || policy === "standard-na-surname-trial" || policy === "standard-role-evidence-trial" || (policy === "standard-role-followup-trial" || (policy === "standard-role-third-trial" || (policy === "standard-role-fourth-trial" || (policy === "standard-role-fifth-trial" || (policy === "standard-role-sixth-trial" || (policy === "standard-role-seventh-trial" || (policy === "standard-role-eighth-trial" || (policy === "standard-ordinal-room-trial" || (policy === "standard-role-tenth-trial" || policy === "standard-numeric-fen-trial"))))))))) ? [reviewedMoeStandardXingReadingEligible] : []),
          ...(policy === "standard-guo-trial" || policy === "standard-na-surname-trial" || policy === "standard-role-evidence-trial" || (policy === "standard-role-followup-trial" || (policy === "standard-role-third-trial" || (policy === "standard-role-fourth-trial" || (policy === "standard-role-fifth-trial" || (policy === "standard-role-sixth-trial" || (policy === "standard-role-seventh-trial" || (policy === "standard-role-eighth-trial" || (policy === "standard-ordinal-room-trial" || (policy === "standard-role-tenth-trial" || policy === "standard-numeric-fen-trial"))))))))) ? [reviewedMoeStandardGuoReadingEligible] : []),
          ...(policy === "standard-na-surname-trial" || policy === "standard-role-evidence-trial" || (policy === "standard-role-followup-trial" || (policy === "standard-role-third-trial" || (policy === "standard-role-fourth-trial" || (policy === "standard-role-fifth-trial" || (policy === "standard-role-sixth-trial" || (policy === "standard-role-seventh-trial" || (policy === "standard-role-eighth-trial" || (policy === "standard-ordinal-room-trial" || (policy === "standard-role-tenth-trial" || policy === "standard-numeric-fen-trial"))))))))) ? [reviewedMoeNaSurnameRoleEligible] : []),
          ...(policy === "standard-role-evidence-trial" || (policy === "standard-role-followup-trial" || (policy === "standard-role-third-trial" || (policy === "standard-role-fourth-trial" || (policy === "standard-role-fifth-trial" || (policy === "standard-role-sixth-trial" || (policy === "standard-role-seventh-trial" || (policy === "standard-role-eighth-trial" || (policy === "standard-ordinal-room-trial" || (policy === "standard-role-tenth-trial" || policy === "standard-numeric-fen-trial"))))))))) ? [reviewedMoeAttestedRoleEligible] : []),
          ...((policy === "standard-role-followup-trial" || (policy === "standard-role-third-trial" || (policy === "standard-role-fourth-trial" || (policy === "standard-role-fifth-trial" || (policy === "standard-role-sixth-trial" || (policy === "standard-role-seventh-trial" || (policy === "standard-role-eighth-trial" || (policy === "standard-ordinal-room-trial" || (policy === "standard-role-tenth-trial" || policy === "standard-numeric-fen-trial"))))))))) ? [reviewedMoeFollowupRoleEligible] : []),
          ...((policy === "standard-role-third-trial" || (policy === "standard-role-fourth-trial" || (policy === "standard-role-fifth-trial" || (policy === "standard-role-sixth-trial" || (policy === "standard-role-seventh-trial" || (policy === "standard-role-eighth-trial" || (policy === "standard-ordinal-room-trial" || (policy === "standard-role-tenth-trial" || policy === "standard-numeric-fen-trial")))))))) ? [reviewedMoeThirdRoleEligible] : []),
          ...((policy === "standard-role-fourth-trial" || (policy === "standard-role-fifth-trial" || (policy === "standard-role-sixth-trial" || (policy === "standard-role-seventh-trial" || (policy === "standard-role-eighth-trial" || (policy === "standard-ordinal-room-trial" || (policy === "standard-role-tenth-trial" || policy === "standard-numeric-fen-trial"))))))) ? [reviewedMoeFourthRoleEligible] : []),
          ...((policy === "standard-role-fifth-trial" || (policy === "standard-role-sixth-trial" || (policy === "standard-role-seventh-trial" || (policy === "standard-role-eighth-trial" || (policy === "standard-ordinal-room-trial" || (policy === "standard-role-tenth-trial" || policy === "standard-numeric-fen-trial")))))) ? [reviewedMoeFifthRoleEligible] : []),
          ...((policy === "standard-role-sixth-trial" || (policy === "standard-role-seventh-trial" || (policy === "standard-role-eighth-trial" || (policy === "standard-ordinal-room-trial" || (policy === "standard-role-tenth-trial" || policy === "standard-numeric-fen-trial"))))) ? [reviewedMoeSixthRoleEligible] : []),
          ...((policy === "standard-role-seventh-trial" || (policy === "standard-role-eighth-trial" || (policy === "standard-ordinal-room-trial" || (policy === "standard-role-tenth-trial" || policy === "standard-numeric-fen-trial")))) ? [reviewedMoeSeventhRoleEligible] : []),
          ...((policy === "standard-role-eighth-trial" || (policy === "standard-ordinal-room-trial" || (policy === "standard-role-tenth-trial" || policy === "standard-numeric-fen-trial"))) ? [reviewedMoeEighthRoleEligible] : []),
          ...((policy === "standard-ordinal-room-trial" || (policy === "standard-role-tenth-trial" || policy === "standard-numeric-fen-trial")) ? [reviewedMoeOrdinalRoomReadingEligible] : []),
          ...((policy === "standard-role-tenth-trial" || policy === "standard-numeric-fen-trial") ? [reviewedMoeTenthRoleEligible] : []),
          ...(policy === "standard-numeric-fen-trial" ? [reviewedMoeNumericFenReadingEligible] : []),
          ...(usesSupplement ? [reviewedMoeSupplementalRoleEligible] : []),
          ...(usesSupplementFollowup ? [reviewedMoeSupplementFollowupRoleEligible] : []),
          ...(requestedPolicy === "standard-role-extended-trial" || requestedPolicy === "standard-qian-role-trial" || requestedPolicy === "standard-han-coordination-trial" ? [reviewedMoeExtendedRoleEligible] : []),
          ...(requestedPolicy === "standard-qian-role-trial" || requestedPolicy === "standard-han-coordination-trial" ? [reviewedMoeQianRoleEligible] : []),
        ] } : {}),
    ...(policy === "duoshao-zhong-trial"
      ? { preDrawReadingEligibility: beforeMoeLePreDrawEligible }
      : policy === "standard-le-trial" || policy === "standard-bi-trial" || policy === "standard-de-trial" || policy === "standard-yu-trial" || policy === "standard-nan-trial" || policy === "standard-xing-trial" || policy === "standard-guo-trial" || policy === "standard-na-surname-trial" || policy === "standard-role-evidence-trial" || (policy === "standard-role-followup-trial" || (policy === "standard-role-third-trial" || (policy === "standard-role-fourth-trial" || (policy === "standard-role-fifth-trial" || (policy === "standard-role-sixth-trial" || (policy === "standard-role-seventh-trial" || (policy === "standard-role-eighth-trial" || (policy === "standard-ordinal-room-trial" || (policy === "standard-role-tenth-trial" || policy === "standard-numeric-fen-trial")))))))))
      ? { preDrawReadingEligibility: reviewedAdjacentPreDrawReadingEligible }
      : policy === "ordinal-line-trial"
      ? { preDrawReadingEligibility: (
          entry: (typeof PRACTICE_CATALOG)[number],
          profile: (typeof SYNTAX_PROFILES)[number],
          _slot: unknown,
          previousEntry: (typeof PRACTICE_CATALOG)[number] | null,
        ) => reviewedOrdinalLineReadingEligible(entry, profile, previousEntry) }
      : {}),
    // Use the product's ordered stages for its current mode; older modes above
    // retain their original frontiers for historical paired comparisons.
    ...(requestedPolicy === PRODUCT_READING_POLICY_ID ? PRODUCT_READING_POLICY : {}),
  }, preparedLexicon, preparedStructure);
  for (const reason of composition.fallbackReasons) increment(fallbacks, reason);
  const candidate = composition.candidates[0];
  sentences.push({
    seedIndex,
    text: candidate?.text ?? null,
    entryIds: candidate?.entries.map((entry) => entry.id) ?? [],
    root: candidate?.syntaxRootRuleId ?? null,
  });
  if (candidate === undefined) continue;
  successfulSentences += 1;
  const sentenceHits = auditPolyphonicCandidate(seedIndex, candidate, ambiguous, profilesById);
  if (sentenceHits.length > 0) sentencesWithAmbiguousReadings += 1;
  hits.push(...sentenceHits);
  for (const hit of sentenceHits) {
    increment(perText, hit.text);
    increment(perEntryId, hit.selectedEntryId);
    increment(perTextAndUpos, hit.text + "/" + (hit.selectedUpos ?? "unknown"));
  }
}

const unsampledTexts = [...ambiguous.keys()].filter((text) => !perText.has(text));
const report = {
  schemaVersion: "polyphonic-context-exposure-v1",
  purpose: "Read-only exposure audit; no judgement of reading correctness.",
  readingEligibilityPolicy: requestedPolicy,
  seedNamespace: SEED_NAMESPACE,
  productBounds: PRODUCT_BOUNDS,
  sampleCount: samples,
  catalogEntryCount: PRACTICE_CATALOG.length,
  ambiguousTextCount: ambiguous.size,
  ambiguousSingleCharacterTextCount: [...ambiguous.keys()].filter(
    (text) => [...text].length === 1,
  ).length,
  successfulSentences,
  failedSentences: samples - successfulSentences,
  sentencesWithAmbiguousReadings,
  polyphonicOccurrences: hits.length,
  observedAmbiguousTextCount: perText.size,
  unsampledAmbiguousTexts: unsampledTexts,
  occurrenceCountByText: sortedCounts(perText),
  occurrenceCountByEntryId: sortedCounts(perEntryId),
  occurrenceCountByTextAndUpos: sortedCounts(perTextAndUpos),
  fallbacks: sortedCounts(fallbacks),
  sentences,
  hits,
};
await mkdir(dirname(output), { recursive: true });
await writeFile(output, JSON.stringify(report, null, 2) + "\n", "utf8");
console.log(JSON.stringify({
  output,
  samples,
  policy: requestedPolicy,
  successfulSentences,
  ambiguousTextCount: ambiguous.size,
  observedAmbiguousTextCount: perText.size,
  polyphonicOccurrences: hits.length,
  sentencesWithAmbiguousReadings,
  warning: "Exposure is not evidence of an incorrect pronunciation.",
}, null, 2));
