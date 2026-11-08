import type { CatalogEntry } from "../core/model.js";
import type { RuntimeSyntaxProfile } from "../syntax/types.js";
import type { UdOccurrenceToken } from "../../scripts/ud-occurrence-source.js";
import { catalogIdentityIndex, catalogUposIndex } from "./attested-sentence-candidates.js";

/**
 * An ungraded source context with exactly one graded catalog entry.
 * This does not declare a sentence-level correct reading: a single currently
 * catalogued identity may still be wrong for the intended source sense.
 */
export interface AttestedTargetContext {
  readonly sourceSentenceIndex: number;
  readonly sourceTokenId: number;
  readonly tokenIndex: number;
  readonly focusText: string;
  readonly focusEntryId: string;
  /** Source UD lexical/PUNCT token forms, not a licensed standalone text asset. */
  readonly sourceTokenForms: readonly string[];
}

export interface AttestedTargetContextCoverage {
  readonly sentenceCount: number;
  readonly consideredShortVerbalContexts: number;
  readonly eligibleContextCount: number;
  readonly focusOccurrences: number;
  readonly uniqueFocusEntryCount: number;
  readonly skippedTargetTokens: {
    readonly absentFromCatalog: number;
    readonly ambiguousCatalogIdentity: number;
    readonly unsupportedUpos: number;
  };
}

export interface AttestedContextLength {
  readonly minLexicalTokens: number;
  readonly maxLexicalTokens: number;
}

export function auditAttestedTargetContextCoverage(
  sentences: readonly (readonly UdOccurrenceToken[])[],
  entries: readonly CatalogEntry[],
  syntaxProfiles: readonly RuntimeSyntaxProfile[],
  range: AttestedContextLength,
): AttestedTargetContextCoverage {
  if (!Number.isInteger(range.minLexicalTokens)
      || !Number.isInteger(range.maxLexicalTokens)
      || range.minLexicalTokens < 1
      || range.maxLexicalTokens < range.minLexicalTokens) {
    throw new RangeError("invalid context token window");
  }
  const byText = catalogIdentityIndex(entries);
  const byUpos = catalogUposIndex(syntaxProfiles);
  let consideredShortVerbalContexts = 0;
  let eligibleContextCount = 0;
  let focusOccurrences = 0;
  let absentFromCatalog = 0;
  let ambiguousCatalogIdentity = 0;
  let unsupportedUpos = 0;
  const focusEntryIds = new Set<string>();
  for (let sentenceIndex = 0; sentenceIndex < sentences.length; sentenceIndex++) {
    const tokens = sentences[sentenceIndex]!;
    const lexical = tokens.filter(t => t.upos !== "PUNCT");
    if (lexical.length < range.minLexicalTokens
        || lexical.length > range.maxLexicalTokens
        || !lexical.some(t => t.upos === "VERB")) continue;
    consideredShortVerbalContexts++;
    let supportedFocusCount = 0;
    for (const t of lexical) {
      const variants = byText.get(t.form);
      if (variants === undefined || variants.length === 0) {
        absentFromCatalog++;
        continue;
      }
      if (variants.length !== 1) {
        // Crucial: UPOS does not adjudicate competing pronunciation identities.
        ambiguousCatalogIdentity++;
        continue;
      }
      const only = variants[0]!;
      if (!byUpos.get(only.id)?.has(t.upos)) {
        unsupportedUpos++;
        continue;
      }
      focusEntryIds.add(only.id);
      supportedFocusCount++;
    }
    if (supportedFocusCount > 0) {
      eligibleContextCount++;
      focusOccurrences += supportedFocusCount;
    }
  }
  return {
    sentenceCount: sentences.length,
    consideredShortVerbalContexts,
    eligibleContextCount,
    focusOccurrences,
    uniqueFocusEntryCount: focusEntryIds.size,
    skippedTargetTokens: { absentFromCatalog, ambiguousCatalogIdentity, unsupportedUpos },
  };
}
