import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { PRACTICE_CATALOG, SYNTAX_PROFILES } from "../src/app/generated/catalog.js";
import { auditAttestedSentenceEligibility } from "../src/curriculum/attested-sentence-candidates.js";
import { extractAttestedClauseSpans } from "../src/curriculum/attested-clause-spans.js";
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
  attestedSubordinateClauses: {
    candidateType: "contiguous ccomp/advcl subtrees with explicit lexical nsubj; not standalone sentence gold",
    spanCount: clauseTokens.length,
    strict: { ...clauseStrict, candidateIndices: undefined },
    broad: { ...clauseBroad, candidateIndices: undefined },
  },
  usage: "No text or sentence-level token/reading material redistributed; no product activation",
};
await mkdir("data/generated", { recursive: true });
await writeFile("data/generated/attested-sentence-identity-coverage.json",
  JSON.stringify(summary, null, 2) + "\n", "utf8");
console.log(JSON.stringify(summary, null, 2));
