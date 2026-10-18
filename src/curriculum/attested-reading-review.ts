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
  /** Organizer-only UD role observation, NOT semantic or reading gold. */
  readonly sourceUpos: string;
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
      sourceTokenIndex: i, text: token.form, sourceUpos: token.upos, originalText,
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

/** Two distinct authentic contexts for the same written form. A pair is a
 * *review question*, not proof of a reading alternation, and cannot be used
 * as ground truth before independent human review.
 */
export function preparePairedBlindedReadingReviewSample(
  candidates: readonly AttestedReadingReviewCandidate[],
  maxCases = 24,
): {
  readonly reviewerCases: readonly AttestedReadingReviewSample[];
  readonly organizerCases: readonly {
    readonly caseId: string;
    readonly pairId: string;
    readonly cohort: "same-source-upos" | "different-source-upos";
    readonly sourceSentenceIndex: number;
    readonly sourceTokenId: number;
    readonly sourceTokenIndex: number;
    readonly sourceUpos: string;
    readonly text: string;
    readonly possibleEntryIds: readonly string[];
  }[];
  readonly eligiblePairedForms: number;
  readonly sameUposPairCount: number;
  readonly differentUposPairCount: number;
} {
  if (!Number.isInteger(maxCases) || maxCases < 2 || maxCases > 100 || maxCases % 2 !== 0) {
    throw new RangeError("paired review count must be even, between 2 and 100");
  }
  const groups = new Map<string, AttestedReadingReviewCandidate[]>();
  for (const candidate of candidates) {
    const list = groups.get(candidate.text) ?? [];
    list.push(candidate);
    groups.set(candidate.text, list);
  }

  type Pair = readonly [AttestedReadingReviewCandidate, AttestedReadingReviewCandidate];
  function pairFor(
    rows: readonly AttestedReadingReviewCandidate[],
    cohort: "same-source-upos" | "different-source-upos" | "either",
  ): Pair | null {
    const ordered = [...rows].sort((a, b) =>
      a.sourceSentenceIndex - b.sourceSentenceIndex
      || a.sourceTokenId - b.sourceTokenId);
    let best: Pair | null = null;
    let maximumDistance = -1;
    for (let i = 0; i < ordered.length; i++) {
      for (let j = i + 1; j < ordered.length; j++) {
        const a = ordered[i]!, b = ordered[j]!;
        if (a.sourceSentenceIndex === b.sourceSentenceIndex || a.originalText === b.originalText) continue;
        if (cohort === "same-source-upos" && a.sourceUpos !== b.sourceUpos) continue;
        if (cohort === "different-source-upos" && a.sourceUpos === b.sourceUpos) continue;
        const distance = b.sourceSentenceIndex - a.sourceSentenceIndex;
        if (distance > maximumDistance) {
          best = [a, b];
          maximumDistance = distance;
        }
      }
    }
    return best;
  }
  // FNV-1a of the word form gives a fixed sample order independent of Unicode
  // lexicographic order and independent of the as-yet-unseen human answers.
  function formHash(form: string): number {
    let hash = 2166136261;
    for (let i = 0; i < form.length; i++) {
      hash = Math.imul(hash ^ form.charCodeAt(i), 16777619) >>> 0;
    }
    return hash;
  }
  const formOrder = [...groups.keys()].sort((a, b) =>
    formHash(a) - formHash(b) || (a < b ? -1 : a > b ? 1 : 0));
  const pool = formOrder.flatMap(text => {
    const rows = groups.get(text)!;
    const same = pairFor(rows, "same-source-upos");
    const different = pairFor(rows, "different-source-upos");
    if (same === null && different === null) return [];
    return [{ text, same, different }];
  });
  const desiredPairs = Math.min(maxCases / 2, pool.length);
  const selected: {
    readonly text: string;
    readonly cohort: "same-source-upos" | "different-source-upos";
    readonly pair: Pair;
  }[] = [];
  const used = new Set<string>();
  function collect(
    cohort: "same-source-upos" | "different-source-upos",
    maximum: number,
  ): void {
    for (const group of pool) {
      if (selected.length >= maximum || used.has(group.text)) continue;
      const pair = group[cohort === "same-source-upos" ? "same" : "different"];
      if (pair === null) continue;
      selected.push({ text: group.text, cohort, pair });
      used.add(group.text);
    }
  }
  // Target two-thirds same-POS contexts: POS cannot decide their readings.
  collect("same-source-upos", Math.ceil(desiredPairs * 2 / 3));
  collect("different-source-upos", desiredPairs);
  collect("same-source-upos", desiredPairs);
  // Fallback when no second role exists: a same-form pair is still useful.
  if (selected.length < desiredPairs) {
    for (const group of pool) {
      if (selected.length >= desiredPairs) break;
      if (used.has(group.text)) continue;
      const pair = group.same ?? group.different;
      if (pair === null) continue;
      selected.push({
        text: group.text, cohort: group.same ? "same-source-upos" : "different-source-upos", pair,
      });
      used.add(group.text);
    }
  }
  // Present all A cases before B cases, with opaque case IDs. The reviewer
  // sees neither a pair ID nor source UPOS or possible pronunciation IDs.
  const reordered = [
    ...selected.map((group, index) => ({ group, index, half: 0 as const })),
    ...selected.map((group, index) => ({ group, index, half: 1 as const })),
  ];
  const reviewerCases = reordered.map(({ group, half }, index) => {
    const row = group.pair[half];
    return {
      caseId: `R${String(index + 1).padStart(2, "0")}`,
      originalText: row.originalText,
      focusText: row.text,
      focusStart: row.start,
      focusEnd: row.end,
      rawAnswer: {
        wordBoundary: null, senseDescription: null,
        completeBopomofo: null, naturalness: null, uncertaintyNotes: null,
      },
    } satisfies AttestedReadingReviewSample;
  });
  const organizerCases = reordered.map(({ group, half, index }, offset) => {
    const row = group.pair[half];
    return {
      caseId: `R${String(offset + 1).padStart(2, "0")}`,
      pairId: `P${String(index + 1).padStart(2, "0")}`,
      cohort: group.cohort,
      sourceSentenceIndex: row.sourceSentenceIndex,
      sourceTokenId: row.sourceTokenId,
      sourceTokenIndex: row.sourceTokenIndex,
      sourceUpos: row.sourceUpos,
      text: row.text,
      possibleEntryIds: row.possibleEntryIds,
    };
  });
  return {
    reviewerCases, organizerCases, eligiblePairedForms: pool.length,
    sameUposPairCount: selected.filter(p => p.cohort === "same-source-upos").length,
    differentUposPairCount: selected.filter(p => p.cohort === "different-source-upos").length,
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
