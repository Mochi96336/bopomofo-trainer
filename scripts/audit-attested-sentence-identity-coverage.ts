import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { PRACTICE_CATALOG, SYNTAX_PROFILES } from "../src/app/generated/catalog.js";
import { auditAttestedSentenceEligibility, catalogIdentityIndex, catalogUposIndex, classifyAttestedSentence } from "../src/curriculum/attested-sentence-candidates.js";
import { extractAttestedClauseSpans } from "../src/curriculum/attested-clause-spans.js";
import { auditAttestedTargetContextCoverage } from "../src/curriculum/attested-target-contexts.js";
import { alignUdTokensToSourceText, parseUdOriginalSentenceTexts } from "../src/curriculum/attested-context-source-alignment.js";
import { auditAttestedAmbiguousReadingCoverage, findAttestedAmbiguousReadingCandidates, preparePairedBlindedReadingReviewSample } from "../src/curriculum/attested-reading-review.js";
import { compareAttestedReadingPolicies } from "../src/curriculum/attested-reading-policy-comparison.js";
import { parseUdOccurrenceSentences } from "./ud-occurrence-source.js";

const SOURCE_COMMIT = "22f73e87f7ddc530bb131a6b7587971a03e1a712";
const TRAIN_SHA256 = "de36e605a4786edb00097165cfc0ee425ab668a2dfc1da7ce4652ba4d2585b1e";
const source = await readFile("data/external/ud/chinese-gsd/r2.18/zh_gsd-ud-train.conllu");
const digest = createHash("sha256").update(source).digest("hex");
if (digest !== TRAIN_SHA256) {
  throw new Error("attested sentence candidate source differs from pinned train file");
}

const sentences = parseUdOccurrenceSentences(source.toString("utf8"));
if (sentences.length === 0) throw new Error("pinned UD train source contained no sentences");
const strict = auditAttestedSentenceEligibility(sentences, PRACTICE_CATALOG, SYNTAX_PROFILES, {
  minLexicalTokens: 3, maxLexicalTokens: 8,
});
const broad = auditAttestedSentenceEligibility(sentences, PRACTICE_CATALOG, SYNTAX_PROFILES, {
  minLexicalTokens: 3, maxLexicalTokens: 16,
});
for (const report of [strict, broad]) {
  const excludedCount = Object.values(report.excluded).reduce((a, b) => a + b, 0);
  if (report.eligibleCount + excludedCount !== report.sentenceCount
    || report.sentenceCount !== sentences.length) {
    throw new Error("attested sentence eligibility partition is inconsistent");
  }
}
// Offline alternative: exact contiguous subordinate-clause subtrees from
// longer UD sentences. These are NOT independently approved standalone
// learner sentences; compare their coverage separately from full sentences.
const clauseTokens = sentences.flatMap(sentence =>
  extractAttestedClauseSpans(sentence).map(span => span.tokens));
const clauseStrict = auditAttestedSentenceEligibility(
  clauseTokens, PRACTICE_CATALOG, SYNTAX_PROFILES,
  { minLexicalTokens: 3, maxLexicalTokens: 8 },
);
const clauseBroad = auditAttestedSentenceEligibility(
  clauseTokens, PRACTICE_CATALOG, SYNTAX_PROFILES,
  { minLexicalTokens: 3, maxLexicalTokens: 16 },
);
// Alternative design: preserve the entire original sentence as an *ungraded*
// context and select only one lexical focus entry. This removes the incorrect
// requirement that all context words be in the active practice catalog.
// It is a coverage feasibility result, not evidence of reading correctness.
const targetOnlyShort = auditAttestedTargetContextCoverage(
  sentences, PRACTICE_CATALOG, SYNTAX_PROFILES,
  { minLexicalTokens: 3, maxLexicalTokens: 8 },
);
const targetOnlyBroad = auditAttestedTargetContextCoverage(
  sentences, PRACTICE_CATALOG, SYNTAX_PROFILES,
  { minLexicalTokens: 3, maxLexicalTokens: 16 },
);
// Preserve exact source text and token offsets before any visual highlighting.
// Unlike join(""), this explicitly abstains when UD tokens cannot reproduce the
// upstream # text field byte-for-byte apart from inter-token whitespace.
const originalTexts = parseUdOriginalSentenceTexts(source.toString("utf8"));
if (originalTexts.length !== sentences.length) {
  throw new Error("pinned UD source text count differs from tokenized sentence count");
}
let metadataMissing = 0;
let exactTokenAligned = 0;
let broadEligibleAligned = 0;
let shortEligibleAligned = 0;
let broadEligibleFocusOccurrencesAligned = 0;
const eligibleFocusCatalog = catalogIdentityIndex(PRACTICE_CATALOG);
const eligibleFocusUpos = catalogUposIndex(SYNTAX_PROFILES);
const eligibleFocusCount = (tokens: (typeof sentences)[number]): number => {
  let count = 0;
  const byText = eligibleFocusCatalog;
  const byUpos = eligibleFocusUpos;
  for (const token of tokens) {
    if (token.upos === "PUNCT") continue;
    const entries = byText.get(token.form);
    if (entries?.length === 1 && byUpos.get(entries[0]!.id)?.has(token.upos)) count++;
  }
  return count;
};
for (let i = 0; i < sentences.length; i++) {
  const text = originalTexts[i];
  if (text === null || text === undefined) {
    metadataMissing++;
    continue;
  }
  const tokens = sentences[i]!;
  if (alignUdTokensToSourceText(text, tokens) === null) continue;
  exactTokenAligned++;
  const lexical = tokens.filter(token => token.upos !== "PUNCT");
  if (!lexical.some(token => token.upos === "VERB")) continue;
  if (lexical.length >= 3 && lexical.length <= 16) {
    const focusCount = eligibleFocusCount(tokens);
    if (focusCount > 0) {
      broadEligibleAligned++;
      broadEligibleFocusOccurrencesAligned += focusCount;
      if (lexical.length <= 8) shortEligibleAligned++;
    }
  }
}
// A separate cohort that was excluded from the one-reading pool. These are
// unresolved polyphonic words in attested source contexts, never reading gold.
const ambiguousReviewCoverage = auditAttestedAmbiguousReadingCoverage(
  sentences, originalTexts, PRACTICE_CATALOG, 3, 16,
);
const ambiguousCatalog = catalogIdentityIndex(PRACTICE_CATALOG);
const ambiguousSourceCases = sentences.flatMap((tokens, sourceSentenceIndex) => {
  const lexical = tokens.filter(token => token.upos !== "PUNCT");
  if (lexical.length < 3 || lexical.length > 16
    || !lexical.some(token => token.upos === "VERB")) return [];
  return findAttestedAmbiguousReadingCandidates(
    tokens, originalTexts[sourceSentenceIndex] ?? null, sourceSentenceIndex,
    ambiguousCatalog,
  );
});
if (ambiguousSourceCases.length !== ambiguousReviewCoverage.ambiguousOccurrenceCount) {
  throw new Error("polyphonic comparison does not match exact source coverage");
}
const policyComparison = compareAttestedReadingPolicies(
  ambiguousSourceCases, sentences, PRACTICE_CATALOG, SYNTAX_PROFILES,
);
const summary = {
  schemaVersion: "attested-sentence-identity-coverage-v1",
  status: "train-only source feasibility audit; NOT independently approved sentences or pronunciation labels",
  source: {
    corpus: "UD Chinese GSD r2.18", commit: SOURCE_COMMIT,
    split: "train", sha256: digest, license: "CC BY-SA 4.0",
  },
  catalogEntryCount: PRACTICE_CATALOG.length,
  syntaxProfileCount: SYNTAX_PROFILES.length,
  strict: { ...strict, candidateIndices: undefined },
  broad: { ...broad, candidateIndices: undefined },
  exactOriginalSourceTextAlignment: {
    method: "match pinned # text exactly in UD token order, only whitespace permitted between forms",
    sourceSentenceCount: sentences.length,
    missingSourceTextMetadata: metadataMissing,
    exactlyAlignedSentences: exactTokenAligned,
    alignedShortContextsWithFocus: shortEligibleAligned,
    alignedBroadContextsWithFocus: broadEligibleAligned,
    alignedBroadFocusOccurrences: broadEligibleFocusOccurrencesAligned,
  },
  ambiguousReadingPolicyHypotheses: policyComparison,
  ambiguousInContextReadingReview: {
    status: "pending independent whole-lexeme, contextual sense and full-bopomofo review; no approved labels",
    ...ambiguousReviewCoverage,
  },
  oneGradedTargetInUngradedFullSourceContext: {
    caveat: "catalog uniqueness is NOT contextual pronunciation evidence; full context still requires naturalness/rightful reuse review",
    short: targetOnlyShort,
    broad: targetOnlyBroad,
  },
  attestedSubordinateClauses: {
    candidateType: "contiguous ccomp/advcl subtrees with explicit lexical nsubj; not standalone sentence gold",
    spanCount: clauseTokens.length,
    strict: { ...clauseStrict, candidateIndices: undefined },
    broad: { ...clauseBroad, candidateIndices: undefined },
  },
  usage: "No text or sentence-level token/reading material redistributed; no product activation",
};
// Opt-in organizer/reviewer artifacts from *real* corpus ambiguity cases.
// Unlike the prior approved-one-reading pilot, these do NOT guess readings.
// The blind reviewer file contains original sentences and target spans but NO
// competing reading options or UD UPOS; the organizer file keeps identities.
// Neither file is included in CI artifacts, logs, or the shipping catalog.
const ambiguousReviewArg = process.argv.find(arg => arg.startsWith("--local-polyphonic-review="));
if (ambiguousReviewArg !== undefined) {
  const prefix = ambiguousReviewArg.slice("--local-polyphonic-review=".length);
  if (!prefix.startsWith("data/generated/") || prefix.includes("..")
    || /[^a-zA-Z0-9._/-]/u.test(prefix)) {
    throw new Error("local polyphonic review prefix must be under data/generated/");
  }
  const all = ambiguousSourceCases;
  if (all.length !== ambiguousReviewCoverage.ambiguousOccurrenceCount) {
    throw new Error("polyphonic organizer/reviewer sample coverage disagrees with audit");
  }
  const sample = preparePairedBlindedReadingReviewSample(all, 24);
  const bySourceCoordinate = new Map(all.map(row => [
    JSON.stringify([row.sourceSentenceIndex, row.sourceTokenId, row.sourceTokenIndex]), row,
  ]));
  const selectedSourceCases = sample.organizerCases.map(row => {
    const sourceCase = bySourceCoordinate.get(JSON.stringify([
      row.sourceSentenceIndex, row.sourceTokenId, row.sourceTokenIndex,
    ]));
    if (sourceCase === undefined || sourceCase.text !== row.text) {
      throw new Error("blind reviewer source coordinate has no pinned corpus occurrence");
    }
    return sourceCase;
  });
  const sampledPolicy = compareAttestedReadingPolicies(
    selectedSourceCases, sentences, PRACTICE_CATALOG, SYNTAX_PROFILES,
  );
  // These are private organizer-level aggregate diagnostics, never reviewer
  // answer suggestions. Do not interpret any unique proposal as gold.
  const unresolvedSample = sampledPolicy.existingProductPolicy.unresolvedMultipleReadings;
  if (sampledPolicy.candidateCount !== sample.reviewerCases.length) {
    throw new Error("blind review selection/policy comparison count drift");
  }
  await mkdir("data/generated", { recursive: true });
  await writeFile(prefix + ".reviewer.json", JSON.stringify({
    schemaVersion: "attested-polyphonic-blind-review-v1",
    purpose: "Independent free response. Do not consult organizer mapping or previous sense hypotheses.",
    sourceUsage: "UD Chinese GSD train, CC BY-SA 4.0; local research only",
    cases: sample.reviewerCases,
  }, null, 2) + "\n", "utf8");
  await writeFile(prefix + ".organizer.json", JSON.stringify({
    schemaVersion: "attested-polyphonic-organizer-v1",
    sourceCommit: SOURCE_COMMIT, sourceSha256: digest,
    caution: "Contains unapproved reading alternatives; do NOT distribute to first-round reviewers",
    eligiblePairedForms: sample.eligiblePairedForms,
    sameUposPairCount: sample.sameUposPairCount,
    differentUposPairCount: sample.differentUposPairCount,
    cases: sample.organizerCases,
  }, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({
    localPolyphonicCasesPrepared: sample.reviewerCases.length,
    localPolyphonicDistinctFormsSampled: sample.sameUposPairCount + sample.differentUposPairCount,
    sameUposContrastPairs: sample.sameUposPairCount,
    differentUposContrastPairs: sample.differentUposPairCount,
    currentPolicyUniqueProposalsInBlindCases:
      sampledPolicy.existingProductPolicy.uniqueReadingProposal,
    currentPolicyUnresolvedInBlindCases: unresolvedSample,
    currentPolicyNoMatchingProfilesInBlindCases:
      sampledPolicy.existingProductPolicy.noMatchingProfile,
    proposedZhongAdditionalUniqueInBlindCases: sampledPolicy.newlyUniqueZhongOnly,
    separateBlindedAndOrganizerFiles: true,
    candidateReadingsPublishedToReviewer: false,
    sourceTextPrinted: false,
  }));
}
// Opt-in local-only handoff. It contains copyrighted source text and is
// NEVER uploaded by CI. Deterministic evenly spaced sampling prevents selecting
// only attractive examples after reading the generated candidates.
const reviewArg = process.argv.find(arg => arg.startsWith("--local-review="));
if (reviewArg !== undefined) {
  const path = reviewArg.slice("--local-review=".length);
  if (!path.startsWith("data/generated/") || !path.endsWith(".json")
    || /[^a-zA-Z0-9._/-]/u.test(path)
    || path.includes("..")) {
    throw new Error("local review must be a JSON path under data/generated/");
  }
  const catalog = catalogIdentityIndex(PRACTICE_CATALOG);
  const upos = catalogUposIndex(SYNTAX_PROFILES);
  const originals = sentences.flatMap((sentence, sourceSentenceIndex) =>
    extractAttestedClauseSpans(sentence).map(span => {
      const decision = classifyAttestedSentence(
        span.tokens, sourceSentenceIndex, catalog, upos,
        { minLexicalTokens: 3, maxLexicalTokens: 8 },
      );
      return decision.kind === "candidate"
        ? { ...decision.candidate, sourceHeadTokenId: span.sourceHeadTokenId, relation: span.sourceRelation }
        : null;
    }).filter((x): x is NonNullable<typeof x> => x !== null));
  const sampleCount = Math.min(24, originals.length);
  const reviewSamples = Array.from({ length: sampleCount }, (_, i) => {
    const original = originals[Math.floor(i * originals.length / sampleCount)]!;
    return {
      ...original,
      review: {
        standaloneAcceptability: null,
        TaiwanMandarinNaturalness: null,
        notes: null,
      },
    };
  });
  await mkdir("data/generated", { recursive: true });
  await writeFile(path, JSON.stringify({
    schemaVersion: "local-ud-clause-review-sample-v1",
    sourceCommit: SOURCE_COMMIT, sourceSplit: "train",
    attribution: "UD Chinese GSD contributors (Mo Shen, Ryan McDonald, Daniel Zeman, Peng Qi); CC BY-SA 4.0",
    caution: "Locally generated copyrighted source quotations; do not relabel as MIT, ship or treat as independent pronunciation gold",
    sampling: "fixed, evenly spaced over all eligible original-order train clause candidates",
    eligiblePopulation: originals.length,
    samples: reviewSamples,
  }, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({
    localReviewManifest: reviewSamples.map(({ sourceSentenceIndex, sourceHeadTokenId, relation }) =>
      ({ sourceSentenceIndex, sourceHeadTokenId, relation })),
    note: "Metadata-only references; no UD source text or pronunciation labels in CI logs",
  }));
  console.log(`wrote ${sampleCount} locally reviewable source excerpts; no excerpts printed`);
}
await mkdir("data/generated", { recursive: true });
await writeFile("data/generated/attested-sentence-identity-coverage.json",
  JSON.stringify(summary, null, 2) + "\n", "utf8");
console.log(JSON.stringify(summary, null, 2));
