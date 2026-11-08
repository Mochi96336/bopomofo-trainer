import type { CatalogEntry } from "../core/model.js";
import type { RuntimeSyntaxProfile } from "../syntax/types.js";
import type { UdOccurrenceToken } from "../../scripts/ud-occurrence-source.js";

/** Research-only, exact-identity candidate from a source-attested utterance.
 * No source sentence is a new pronunciation label; polyphonic surfaces whose
 * reading is not unique are excluded, not disambiguated from UD UPOS.
 */
export interface AttestedSentenceCandidate {
  readonly sourceSentenceIndex: number;
  readonly text: string;
  readonly entryIds: readonly string[];
  readonly lexicalTokens: readonly string[];
}

export const ATTESTED_SENTENCE_FILTER_REASONS = [
  "too-short-or-long", "internal-punctuation", "nonterminal-punctuation", "not-verbal-clause",
  "unknown-surface", "ambiguous-reading", "incompatible-upos",
] as const;
export type AttestedSentenceFilterReason = (typeof ATTESTED_SENTENCE_FILTER_REASONS)[number];
export type AttestedSentenceDecision =
  | { readonly kind: "candidate"; readonly candidate: AttestedSentenceCandidate }
  | { readonly kind: "excluded"; readonly reason: AttestedSentenceFilterReason };

export interface AttestedSentenceSelectionOptions {
  readonly minLexicalTokens?: number;
  readonly maxLexicalTokens?: number;
}

function permittedLength(min: number, max: number): void {
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max < min) {
    throw new RangeError("invalid attested sentence lexical token limits");
  }
}

/** Fully source-token-aligned: never retokenize or split compound characters. */
export function classifyAttestedSentence(
  tokens: readonly UdOccurrenceToken[],
  sourceSentenceIndex: number,
  catalogByText: ReadonlyMap<string, readonly CatalogEntry[]>,
  allowedUposByEntry: ReadonlyMap<string, ReadonlySet<string>>,
  options: AttestedSentenceSelectionOptions = {},
): AttestedSentenceDecision {
  const min = options.minLexicalTokens ?? 3;
  const max = options.maxLexicalTokens ?? 16;
  permittedLength(min, max);
  const lexical = tokens.filter(token => token.upos !== "PUNCT");
  if (lexical.length < min || lexical.length > max) {
    return { kind: "excluded", reason: "too-short-or-long" };
  }
  // Conservative single-clause pilot: do not discard punctuation in the middle
  // and accidentally join two originally separate clauses as one exercise.
  const first = tokens.findIndex(token => token.upos !== "PUNCT");
  let last = tokens.length - 1;
  while (last >= 0 && tokens[last]!.upos === "PUNCT") last--;
  // Do not promote a quoted/comma-prefixed fragment or a clause ending in
  // a comma into an independent practice sentence. Full-stop endings remain
  // possible, but are still subject to later human acceptability review.
  const trailing = tokens.slice(last + 1);
  if (first > 0 || trailing.length > 1
    || trailing.some(token => !["。", "！", "？", ".", "!", "?"].includes(token.form))) {
    return { kind: "excluded", reason: "nonterminal-punctuation" };
  }
  if (tokens.some((token, i) => token.upos === "PUNCT" && i > first && i < last)) {
    return { kind: "excluded", reason: "internal-punctuation" };
  }
  if (!lexical.some(token => token.upos === "VERB")) {
    return { kind: "excluded", reason: "not-verbal-clause" };
  }
  const ids: string[] = [];
  for (const token of lexical) {
    const entries = catalogByText.get(token.form);
    if (entries === undefined || entries.length === 0) {
      return { kind: "excluded", reason: "unknown-surface" };
    }
    // Distinct catalog identities, even if one role looks implausible, are an
    // unresolved reading ambiguity. The UD source does not contain Bopomofo.
    if (entries.length !== 1) {
      return { kind: "excluded", reason: "ambiguous-reading" };
    }
    const entry = entries[0]!;
    if (!allowedUposByEntry.get(entry.id)?.has(token.upos)) {
      return { kind: "excluded", reason: "incompatible-upos" };
    }
    ids.push(entry.id);
  }
  return {
    kind: "candidate",
    candidate: {
      sourceSentenceIndex,
      text: tokens.map(token => token.form).join(""),
      entryIds: ids,
      lexicalTokens: lexical.map(token => token.form),
    },
  };
}

export function catalogIdentityIndex(entries: readonly CatalogEntry[]): ReadonlyMap<string, readonly CatalogEntry[]> {
  const byText = new Map<string, CatalogEntry[]>();
  for (const entry of entries) {
    const matches = byText.get(entry.prompt.text) ?? [];
    matches.push(entry);
    byText.set(entry.prompt.text, matches);
  }
  return byText;
}

export function catalogUposIndex(profiles: readonly RuntimeSyntaxProfile[]): ReadonlyMap<string, ReadonlySet<string>> {
  const byEntry = new Map<string, Set<string>>();
  for (const profile of profiles) {
    const types = byEntry.get(profile.entryId) ?? new Set<string>();
    types.add(profile.upos);
    byEntry.set(profile.entryId, types);
  }
  return byEntry;
}

export function auditAttestedSentenceEligibility(
  sentences: readonly (readonly UdOccurrenceToken[])[],
  entries: readonly CatalogEntry[],
  profiles: readonly RuntimeSyntaxProfile[],
  options: AttestedSentenceSelectionOptions = {},
): {
  readonly sentenceCount: number;
  readonly eligibleCount: number;
  readonly excluded: Readonly<Record<AttestedSentenceFilterReason, number>>;
  readonly candidateIndices: readonly number[];
} {
  const catalog = catalogIdentityIndex(entries);
  const upos = catalogUposIndex(profiles);
  const excluded = Object.fromEntries(
    ATTESTED_SENTENCE_FILTER_REASONS.map(reason => [reason, 0]),
  ) as Record<AttestedSentenceFilterReason, number>;
  const candidateIndices: number[] = [];
  for (let i = 0; i < sentences.length; i++) {
    const classification = classifyAttestedSentence(sentences[i]!, i, catalog, upos, options);
    if (classification.kind === "candidate") candidateIndices.push(i);
    else excluded[classification.reason]++;
  }
  return {
    sentenceCount: sentences.length,
    eligibleCount: candidateIndices.length,
    excluded,
    candidateIndices,
  };
}
