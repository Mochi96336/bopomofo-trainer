import type { CatalogEntry, PracticeMode, Exercise } from "../core/model.js";
import type { RuntimeSyntaxProfile } from "../syntax/types.js";
import type { UdOccurrenceToken } from "../../scripts/ud-occurrence-source.js";
import type { AttestedTargetContext } from "../curriculum/attested-target-contexts.js";
import {
  buildAlignedAttestedFocusPresentation,
  type AttestedFocusPresentation,
} from "../curriculum/attested-context-source-alignment.js";
import { renderAttestedFocusContext } from "./attested-focus-context.js";
import { parseReading } from "../scheme/parse-reading.js";
import { catalogEntryId } from "../core/catalog-entry-id.js";

/**
 * Offline-only product activation boundary.
 *
 * A unique catalog (text, reading) is NOT sentence-level reading evidence.
 * A source-attested Wikipedia-derived sentence is NOT cleared Taiwan learner
 * content. Both assertions require explicit, separately traceable decisions.
 *
 * Do not package any approval records or source text in the shipped catalog.
 * The type shape is a contract, NOT proof that a claimed human review occurred.
 */
export interface AttestedContextDecision {
  readonly schemaVersion: "attested-context-review-v1";
  readonly source: {
    readonly corpus: "UD_Chinese-GSD";
    readonly split: "train";
    readonly commit: "22f73e87f7ddc530bb131a6b7587971a03e1a712";
    readonly sentenceIndex: number;
    readonly tokenId: number;
    readonly originalText: string;
    readonly focusEntryId: string;
  };
  readonly lexicalBoundary: {
    readonly verdict: "approved" | "pending" | "rejected";
    readonly evidenceId: string;
  };
  readonly contextualReading: {
    readonly verdict: "approved" | "pending" | "rejected";
    readonly evidenceId: string;
    readonly reviewerId: string;
    readonly adjudicatorId: string;
    /** Explicitly agreed reading identity; never infer from UD UPOS. */
    readonly approvedEntryId: string;
    /** Organizer-normalized free-response Bopomofo in trainer syllable/tone
     * notation (e.g. ㄉㄨㄥ1 ㄒㄧ5). Must match actual graded token contents;
     * an entry ID alone is not evidence of what was read or adjudicated. */
    readonly approvedReading: string;
    /** Snapshot of every alternative shown to the organizer at adjudication.
     * Not a reviewer-facing hint or independent evidence of correctness. */
    readonly reviewedCandidateEntryIds: readonly string[];
  };
  readonly taiwanMandarinSuitability: {
    readonly verdict: "approved" | "pending" | "rejected";
    readonly evidenceId: string;
  };
  readonly reusePermission: {
    readonly verdict: "cleared" | "pending" | "rejected";
    readonly clearanceId: string;
    readonly attribution: string;
    readonly license: "CC BY-SA 4.0";
  };
}

export interface ReviewedAttestedFocusPrototype {
  readonly exercise: Exercise;
  readonly presentation: AttestedFocusPresentation;
  readonly html: string;
  readonly sourceReviewId: string;
}

function nonblank(value: string): boolean {
  return value.trim().length > 0;
}

/**
 * Attempts to promote a *source-bound candidate* to a practice prototype.
 * Returns null on any missing, stale or incomplete decision. It never draws a
 * reading from UD UPOS, CoNLL-U Translit, the sample, or language-model output.
 */
export function buildReviewedAttestedFocusPrototype(
  target: AttestedTargetContext,
  sourceTokens: readonly UdOccurrenceToken[],
  sourceText: string | null,
  entries: readonly CatalogEntry[],
  syntaxProfiles: readonly RuntimeSyntaxProfile[],
  decision: AttestedContextDecision | null,
  mode: PracticeMode = "guided",
  layoutId = "standard",
): ReviewedAttestedFocusPrototype | null {
  if (decision === null
    || decision.schemaVersion !== "attested-context-review-v1"
    || decision.source.corpus !== "UD_Chinese-GSD"
    || decision.source.split !== "train"
    || decision.source.commit !== "22f73e87f7ddc530bb131a6b7587971a03e1a712"
    || decision.source.sentenceIndex !== target.sourceSentenceIndex
    || decision.source.tokenId !== target.sourceTokenId
    || decision.source.focusEntryId !== target.focusEntryId
    || decision.source.originalText !== sourceText
    || decision.lexicalBoundary.verdict !== "approved"
    || !nonblank(decision.lexicalBoundary.evidenceId)
    || decision.contextualReading.verdict !== "approved"
    || !nonblank(decision.contextualReading.evidenceId)
    || !nonblank(decision.contextualReading.reviewerId)
    || !nonblank(decision.contextualReading.adjudicatorId)
    || decision.contextualReading.reviewerId === decision.contextualReading.adjudicatorId
    || decision.contextualReading.approvedEntryId !== target.focusEntryId
    || !Array.isArray(decision.contextualReading.reviewedCandidateEntryIds)
    || decision.taiwanMandarinSuitability.verdict !== "approved"
    || !nonblank(decision.taiwanMandarinSuitability.evidenceId)
    || decision.reusePermission.verdict !== "cleared"
    || decision.reusePermission.license !== "CC BY-SA 4.0"
    || !nonblank(decision.reusePermission.clearanceId)
    || !nonblank(decision.reusePermission.attribution)) return null;

  // The previous helper for UNREVIEWED research candidates required the
  // surface to have only one pronunciation. Reusing it here accidentally made
  // it impossible to promote any reviewed polyphone. Instead, require a
  // review-backed *exact* entry ID plus a snapshot of ALL catalog alternatives.
  const sourceToken = sourceTokens[target.tokenIndex];
  if (sourceToken === undefined || sourceToken.id !== target.sourceTokenId
    || sourceToken.form !== target.focusText || sourceToken.upos === "PUNCT") return null;
  const variants = entries.filter(entry => entry.prompt.text === target.focusText);
  const variantIds = variants.map(entry => entry.id);
  const reviewedIds = decision.contextualReading.reviewedCandidateEntryIds;
  if (variants.length === 0 || new Set(variantIds).size !== variants.length
    || reviewedIds.length !== variants.length
    || new Set(reviewedIds).size !== reviewedIds.length
    || !reviewedIds.every(id => variantIds.includes(id))) return null;
  const approvedEntry = variants.find(entry => entry.id === target.focusEntryId);
  if (approvedEntry === undefined) return null;
  // The agreed Bopomofo is a separate review value, not just a claimed ID.
  // The compiled input tokens must match that Bopomofo exactly, syllable by
  // syllable, so ID drift or an accidental catalog token substitution rejects.
  const approvedReading = decision.contextualReading.approvedReading;
  if (typeof approvedReading !== "string" || !nonblank(approvedReading)) return null;
  const parsedReading = parseReading(approvedReading);
  if (!parsedReading.ok) return null;
  const normalizedReading = approvedReading.trim().split(/\s+/u).join(" ");
  if (catalogEntryId(target.focusText, normalizedReading) !== approvedEntry.id
    || JSON.stringify(parsedReading.syllables.map(syllable => syllable.tokens))
      !== JSON.stringify(approvedEntry.syllables.map(syllable => syllable.tokens))) return null;
  // A reading must still have a corresponding catalog syntax profile for the
  // ACTUAL source token role. UPOS does not select the reading; human review does.
  if (!syntaxProfiles.some(profile => profile.entryId === approvedEntry.id
    && profile.upos === sourceToken.upos)) return null;

  const presentation = buildAlignedAttestedFocusPresentation(
    target, sourceTokens, sourceText, target.sourceSentenceIndex,
  );
  if (presentation === null) return null;
  const exercise: Exercise = {
    id: `research-attested-focus:${target.sourceSentenceIndex}:${target.sourceTokenId}:${target.focusEntryId}`,
    mode, layoutId, entries: [approvedEntry],
  };
  return {
    exercise,
    presentation,
    html: renderAttestedFocusContext(presentation, exercise),
    sourceReviewId: decision.contextualReading.evidenceId,
  };
}
