import type { UdOccurrenceToken } from "../../scripts/ud-occurrence-source.js";
import type { AttestedTargetContext } from "./attested-target-contexts.js";

/**
 * Source text metadata from the same pinned CoNLL-U blob as the UD tokens.
 * Do not regenerate source text from concatenated token forms: whitespace,
 * original punctuation and Latin words would silently drift.
 */
export function parseUdOriginalSentenceTexts(conllu: string): readonly (string | null)[] {
  const sentences: (string | null)[] = [];
  let text: string | null = null;
  let hasTokens = false;
  const flush = (): void => {
    if (hasTokens) sentences.push(text);
    text = null;
    hasTokens = false;
  };
  for (const line of conllu.split(/\r?\n/u)) {
    if (line === "") {
      flush();
    } else if (line.startsWith("# text = ")) {
      if (text !== null) throw new Error("duplicate CoNLL-U source text metadata");
      text = line.slice("# text = ".length);
    } else if (line.startsWith("#")) {
      continue;
    } else if (/^\d+\t/u.test(line)) {
      hasTokens = true;
    }
  }
  flush();
  return sentences;
}

export interface AlignedSourceToken {
  readonly tokenIndex: number;
  /** UTF-16 ranges, suitable for exact JavaScript string slicing. */
  readonly start: number;
  readonly end: number;
}

/** Fail closed unless every UD token occurs exactly in original order,
 * separated only by whitespace. Never fuzzy-match or skip source characters.
 */
export function alignUdTokensToSourceText(
  originalText: string,
  tokens: readonly UdOccurrenceToken[],
): readonly AlignedSourceToken[] | null {
  if (originalText.length === 0 || tokens.length === 0) return null;
  const aligned: AlignedSourceToken[] = [];
  let cursor = 0;
  for (let i = 0; i < tokens.length; i++) {
    const form = tokens[i]!.form;
    if (form.length === 0) return null;
    // Only whitespace may separate tokens; matching by text.indexOf alone can
    // jump over missing words or incorrectly target a later repeated token.
    while (cursor < originalText.length && /\s/u.test(originalText[cursor]!)) cursor++;
    if (!originalText.startsWith(form, cursor)) return null;
    const start = cursor;
    cursor += form.length;
    aligned.push({ tokenIndex: i, start, end: cursor });
  }
  if (originalText.slice(cursor).trim().length !== 0) return null;
  return aligned;
}

export interface AttestedFocusPresentation {
  readonly sourceSentenceIndex: number;
  readonly focusEntryId: string;
  readonly originalText: string;
  readonly prefix: string;
  readonly focus: string;
  readonly suffix: string;
  readonly start: number;
  readonly end: number;
}

/** Isolate a single graded focus for future user-facing presentation, without
 * altering the original sentence or introducing grading for context tokens.
 * Source license + independent contextual reading review remain separate gates.
 */
export function buildAlignedAttestedFocusPresentation(
  target: AttestedTargetContext,
  sourceTokens: readonly UdOccurrenceToken[],
  originalText: string | null,
): AttestedFocusPresentation | null {
  if (originalText === null || sourceTokens.length !== target.sourceTokenForms.length) return null;
  if (sourceTokens.some((token, i) => token.form !== target.sourceTokenForms[i])) return null;
  const token = sourceTokens[target.tokenIndex];
  if (token === undefined || token.id !== target.sourceTokenId
      || token.form !== target.focusText || token.upos === "PUNCT") return null;
  const aligned = alignUdTokensToSourceText(originalText, sourceTokens);
  if (aligned === null) return null;
  const span = aligned[target.tokenIndex]!;
  return {
    sourceSentenceIndex: target.sourceSentenceIndex,
    focusEntryId: target.focusEntryId,
    originalText,
    prefix: originalText.slice(0, span.start),
    focus: originalText.slice(span.start, span.end),
    suffix: originalText.slice(span.end),
    start: span.start,
    end: span.end,
  };
}
