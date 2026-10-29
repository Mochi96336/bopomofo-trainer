import { escapeHtml } from "./html.js";
import type { Exercise } from "../core/model.js";
import type { AttestedFocusPresentation } from "../curriculum/attested-context-source-alignment.js";

/**
 * Experimental display-only row. Context words are ungraded plain text;
 * the highlighted focus is the only word that may be linked to an Exercise.
 * Use only after source rights and contextual pronunciation review.
 */
export function renderAttestedFocusContext(
  presentation: AttestedFocusPresentation,
  gradedExercise: Exercise,
): string {
  // A highlighted word must be the very same catalog reading identity that
  // the existing input/measurement engine will grade, never just same text.
  if (gradedExercise.entries.length !== 1
    || gradedExercise.entries[0]!.id !== presentation.focusEntryId
    || gradedExercise.entries[0]!.prompt.text !== presentation.focus) {
    throw new Error("source focus and graded catalog identity disagree");
  }
  if (presentation.prefix + presentation.focus + presentation.suffix !== presentation.originalText
    || presentation.originalText.slice(presentation.start, presentation.end) !== presentation.focus
    || presentation.focus.length === 0) {
    throw new Error("focus display no longer matches pinned source text");
  }
  return `<span class="attested-context" aria-label="原句語境">${escapeHtml(presentation.prefix)}<mark class="attested-context-focus" aria-label="本題練習詞">${escapeHtml(presentation.focus)}</mark>${escapeHtml(presentation.suffix)}</span>`;
}
