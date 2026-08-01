import { escapeHtml } from "./html.js";

/**
 * The two kinds of thing the information panel says, kept apart.
 *
 * A panel section carries lasting information -- how many keys are practised,
 * where a slider sits, what the buttons do -- and it also reports what just
 * happened when one of those buttons was pressed. The level section had both in
 * one element, so "下一題生效" took the place of the unlock count and the count
 * only came back because opening the panel blanked the message first. A learner
 * who changed a level and then looked for their progress found the reply to
 * their own action sitting where the progress had been.
 *
 * These are separate elements now. Nothing here decides when a status is set or
 * dropped; it only makes the distinction expressible, so the two can no longer
 * be written to the same place.
 */

/** `danger` is for a failure, and never for a completed action. */
export type PanelStatusTone = "normal" | "danger";

export interface PanelActionStatus {
  readonly message: string;
  readonly tone: PanelStatusTone;
}

export const NO_ACTION_STATUS: PanelActionStatus = { message: "", tone: "normal" };

export function actionApplied(message: string): PanelActionStatus {
  return { message, tone: "normal" };
}

export function actionFailed(message: string): PanelActionStatus {
  return { message, tone: "danger" };
}

/**
 * Rendered whether or not there is anything to say.
 *
 * A live region that is added when a message arrives is announced unreliably --
 * the region has to be there before the text changes for the change to be a
 * change. Keeping the element and swapping its text is also what holds the row
 * still: a status that appears cannot push the controls that produced it.
 */
export function panelActionStatusMarkup(
  id: string,
  status: PanelActionStatus,
): string {
  const failed = status.tone === "danger" ? " failed" : "";
  return `<output id="${id}" class="panel-action-status${failed}" role="status" aria-atomic="true">${escapeHtml(status.message)}</output>`;
}

/**
 * Progress towards the next locked level, as practised keys over the keys it
 * asks for. A count, not a sentence: the level names are already on the marks
 * beside it, and the pair of numbers is what changes round to round.
 */
export function rarityProgressText(
  next: { readonly practisedKeys: number; readonly requiredKeys: number } | null,
  inspectionUnlockAll: boolean,
): string {
  if (next === null) return "全部已解鎖";
  // Under the review override the count is still the honest one; saying so keeps
  // the open marks from reading as earned.
  const count = `${next.practisedKeys}/${next.requiredKeys}`;
  return inspectionUnlockAll ? `檢視用開放 · ${count}` : count;
}
