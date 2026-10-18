import type { CatalogEntry } from "../core/model.js";
import type { UdOccurrenceToken } from "../../scripts/ud-occurrence-source.js";
import { catalogIdentityIndex } from "./attested-sentence-candidates.js";
import { alignUdTokensToSourceText } from "./attested-context-source-alignment.js";

/**
 * Unresolved in-context heteronyms. Every candidate is a question, NOT an
 * answer or a permissible input exercise. UD UPOS/Translit cannot select among
 * the available reading-specific catalog identities.
 */
export interface AttestedReadingReviewCandidate {
  readonly sourceSentenceIndex: number;
  readonly sourceTokenId: number;
  readonly sourceTokenIndex: number;
  readonly text: string;
  readonly originalText: string;
  readonly start: number;
  readonly end: number;
  /** Organizer-only; NEVER include these in an independent reviewer packet. */
  readonly possibleEntryIds: readonly string[];
}

export function findAttestedAmbiguousReadingCandidates(
  tokens: readonly UdOccurrenceToken[],
  originalText: string | null,
  sourceSentenceIndex: number,
  catalogByText: ReadonlyMap<string, readonly CatalogEntry[]>,
): readonly AttestedReadingReviewCandidate[] {
  if (originalText === null) return [];
  const spans = alignUdTokensToSourceText(originalText, tokens);
  if (spans === null) return [];
  const found: AttestedReadingReviewCandidate[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]!;
    if (token.upos === "PUNCT") continue;
    const identities = [...new Set((catalogByText.get(token.form) ?? []).map(x => x.id))];
    if (identities.length < 2) continue;
    const span = spans[i]!;
    if (originalText.slice(span.start, span.end) !== token.form) continue;
    found.push({
      sourceSentenceIndex, sourceTokenId: token.id,
      sourceTokenIndex: i, text: token.form, originalText,
      start: span.start, end: span.end, possibleEntryIds: identities.sort(),
    });
  }
  return found;
}

export interface AttestedReadingReviewSample {
  readonly caseId: string;
  readonly originalText: string;
  readonly focusText: string;
  readonly focusStart: number;
  readonly focusEnd: number;
  readonly rawAnswer: {
    readonly wordBoundary: null;
    readonly senseDescription: null;
    readonly completeBopomofo: null;
    readonly naturalness: null;
    readonly uncertaintyNotes: null;
  };
}

/** Deterministic type-balanced sampling, not cherry-picked favorable sentences.
 * Sampling is spread over *distinct written forms*, then the middle source
 * occurrence of that form. No competing reading options reach reviewers.
 */
export function prepareBlindedReadingReviewSample(
  candidates: readonly AttestedReadingReviewCandidate[],
  maxCases = 24,
): {
  readonly reviewerCases: readonly AttestedReadingReviewSample[];
  readonly organizerCases: readonly {
    readonly caseId: string;
    readonly sourceSentenceIndex: number;
    readonly sourceTokenId: number;
    readonly sourceTokenIndex: number;
    readonly text: string;
    readonly possibleEntryIds: readonly string[];
  }[];
  readonly distinctTargetForms: number;
} {
  if (!Number.isInteger(maxCases) || maxCases < 1 || maxCases > 100) {
    throw new RangeError("invalid review sample count");
  }
  const groups = new Map<string, AttestedReadingReviewCandidate[]>();
  for (const candidate of candidates) {
    const group = groups.get(candidate.text) ?? [];
    group.push(candidate);
    groups.set(candidate.text, group);
  }
  const forms = [...groups.keys()].sort();
  const count = Math.min(maxCases, forms.length);
  const selected = Array.from({ length: count }, (_, i) => {
    const text = forms[Math.floor(i * forms.length / count)]!;
    const examples = groups.get(text)!;
    return examples[Math.floor((examples.length - 1) / 2)]!;
  });
  return {
    reviewerCases: selected.map((candidate, index) => ({
      caseId: `R${String(index + 1).padStart(2, "0")}`,
      originalText: candidate.originalText,
      focusText: candidate.text,
      focusStart: candidate.start,
      focusEnd: candidate.end,
      rawAnswer: {
        wordBoundary: null, senseDescription: null,
        completeBopomofo: null, naturalness: null, uncertaintyNotes: null,
      },
    })),
    organizerCases: selected.map((candidate, index) => ({
      caseId: `R${String(index + 1).padStart(2, "0")}`,
      sourceSentenceIndex: candidate.sourceSentenceIndex,
      sourceTokenId: candidate.sourceTokenId,
      sourceTokenIndex: candidate.sourceTokenIndex,
      text: candidate.text,
      possibleEntryIds: candidate.possibleEntryIds,
    })),
    distinctTargetForms: forms.length,
  };
}

/** Audit only. No sentence text or suggested answers in published CI output. */
export function auditAttestedAmbiguousReadingCoverage(
  sentences: readonly (readonly UdOccurrenceToken[])[],
  originalTexts: readonly (string | null)[],
  entries: readonly CatalogEntry[],
  minLexicalTokens = 3,
  maxLexicalTokens = 16,
): {
  readonly eligibleSourceSentenceCount: number;
  readonly ambiguousOccurrenceCount: number;
  readonly distinctAmbiguousForms: number;
  readonly contextSentenceCount: number;
} {
  if (sentences.length !== originalTexts.length) throw new RangeError("source text/token count mismatch");
  const catalog = catalogIdentityIndex(entries);
  const forms = new Set<string>();
  const contexts = new Set<number>();
  let eligibleSourceSentenceCount = 0, ambiguousOccurrenceCount = 0;
  for (let i = 0; i < sentences.length; i++) {
    const tokens = sentences[i]!;
    const lexical = tokens.filter(token => token.upos !== "PUNCT");
    if (lexical.length < minLexicalTokens || lexical.length > maxLexicalTokens
      || !lexical.some(token => token.upos === "VERB")) continue;
    eligibleSourceSentenceCount++;
    const found = findAttestedAmbiguousReadingCandidates(tokens, originalTexts[i] ?? null, i, catalog);
    if (found.length) contexts.add(i);
    ambiguousOccurrenceCount += found.length;
    for (const row of found) forms.add(row.text);
  }
  return {
    eligibleSourceSentenceCount, ambiguousOccurrenceCount,
    distinctAmbiguousForms: forms.size, contextSentenceCount: contexts.size,
  };
}
