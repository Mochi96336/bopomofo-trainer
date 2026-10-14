import type { ProductProgress } from "../../src/product/types.js";

export function legacyProgressDraft(
  progress: ProductProgress,
  schemaVersion: 6 | 7,
): Record<string, any> {
  const draft = JSON.parse(JSON.stringify(progress)) as Record<string, any>;
  draft.schemaVersion = schemaVersion;
  draft.curriculumPolicyVersion = "phase-4-v1";
  draft.curriculum = {
    round: progress.practiceRoundsCompleted,
    lastFocusedRounds: {},
    recentEntryIds: [...progress.selection.recentEntryIds],
    recentTokenIds: [],
  };
  delete draft.selection.recentEntryIds;
  if (schemaVersion === 6) delete draft.measurementEpoch;
  return draft;
}
