import type { CatalogEntry, PracticeMode, Exercise } from "../core/model.js";
import type { RuntimeSyntaxProfile } from "../syntax/types.js";
import type { UdOccurrenceToken } from "../../scripts/ud-occurrence-source.js";
import {
  targetCandidatesForAttestedContext,
  buildAttestedFocusExercisePrototype,
  type AttestedTargetContext,
} from "../curriculum/attested-target-contexts.js";
import {
  buildAlignedAttestedFocusPresentation,
  type AttestedFocusPresentation,
} from "../curriculum/attested-context-source-alignment.js";
import { renderAttestedFocusContext } from "./attested-focus-context.js";

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
    || decision.taiwanMandarinSuitability.verdict !== "approved"
    || !nonblank(decision.taiwanMandarinSuitability.evidenceId)
    || decision.reusePermission.verdict !== "cleared"
    || decision.reusePermission.license !== "CC BY-SA 4.0"
    || !nonblank(decision.reusePermission.clearanceId)
    || !nonblank(decision.reusePermission.attribution)) return null;

  // Even a reviewed record must not silently point at the wrong UD token
  // occurrence, or at a new catalog entry added after review.
  const available = targetCandidatesForAttestedContext(
    sourceTokens, target.sourceSentenceIndex, entries, syntaxProfiles,
  );
  if (!available.some(candidate =>
    candidate.sourceTokenId === target.sourceTokenId
    && candidate.tokenIndex === target.tokenIndex
    && candidate.focusText === target.focusText
    && candidate.focusEntryId === target.focusEntryId)) return null;

  const presentation = buildAlignedAttestedFocusPresentation(
    target, sourceTokens, sourceText, target.sourceSentenceIndex,
  );
  if (presentation === null) return null;
  const { exercise } = buildAttestedFocusExercisePrototype(target, entries, mode, layoutId);
  return {
    exercise,
    presentation,
    html: renderAttestedFocusContext(presentation, exercise),
    sourceReviewId: decision.contextualReading.evidenceId,
  };
}
