import type { TokenId } from "../core/model.js";
import { tokenLabel } from "../diagnostics/labels.js";
import { DIAGNOSTIC_POLICY } from "../diagnostics/policy.js";
import {
  selectConfusionDiagnostics,
  selectKeyDiagnostics,
  selectTransitionDiagnostics,
} from "../diagnostics/selectors.js";
import type {
  ConfusionDiagnostic,
  DiagnosticModel,
  KeyDiagnostic,
  TransitionDiagnostic,
} from "../diagnostics/types.js";
import type { DiagnosticAnalysisSelection } from "./diagnostic-analysis-state.js";
import {
  milliseconds,
  percent,
  stateBadgeMarkup,
} from "./diagnostic-format.js";
import type { DiagnosticPreferences } from "./diagnostic-preferences.js";
import { escapeHtml } from "./html.js";

/**
 * Which rows a tab shows, and how one row reads in the list. Selection and row
 * markup stay together because the empty-state copy has to describe the same
 * gate the selection applies -- a transition is withheld until it reaches the
 * policy's preliminary sample count, and the copy must say so rather than claim
 * there is no data.
 */
export function keyRows(
  model: DiagnosticModel,
  preferences: DiagnosticPreferences,
): readonly KeyDiagnostic[] {
  return selectKeyDiagnostics(
    model.keys.filter((row) => row.attempts > 0),
    preferences.keySort,
    true,
  );
}

// Direction and list-length filters proved to be noise nobody used and were
// removed; there is no scope control left for copy to refer to. One gate does
// remain: a transition still needs the policy's preliminary sample count before
// it is listed at all, so empty-state copy has to say so rather than claim
// there is no data.
export function transitionRows(
  model: DiagnosticModel,
  state: DiagnosticAnalysisSelection,
): readonly TransitionDiagnostic[] {
  return selectTransitionDiagnostics(model.transitions, {
    selectedKey: state.selectedKey,
    direction: "both",
    minimumSamples: DIAGNOSTIC_POLICY.relationshipSamples.preliminary,
    includeTone: true,
    complete: true,
  });
}

export function transitionEmptyMessage(
  model: Pick<DiagnosticModel, "transitions">,
  selectedKey: TokenId | null,
): string {
  if (selectedKey !== null) return `${tokenLabel(selectedKey)} 相關的轉換尚無足夠資料。`;
  if (model.transitions.length === 0) return "尚無轉換資料。";
  return `同一組轉換累積 ${DIAGNOSTIC_POLICY.relationshipSamples.preliminary} 次有效輸入後才會顯示；目前資料仍不足。`;
}

export function confusionEmptyMessage(selectedKey: TokenId | null): string {
  return selectedKey === null
    ? "尚無誤按資料。"
    : `${tokenLabel(selectedKey)} 目前沒有誤按紀錄。`;
}

export function confusionRows(
  model: DiagnosticModel,
  state: DiagnosticAnalysisSelection,
): readonly ConfusionDiagnostic[] {
  return selectConfusionDiagnostics(model.confusions, {
    selectedKey: state.selectedKey,
    direction: "both",
    complete: true,
  });
}

export function visibleRowsForTab(
  model: DiagnosticModel,
  preferences: DiagnosticPreferences,
  state: DiagnosticAnalysisSelection,
): readonly (KeyDiagnostic | TransitionDiagnostic | ConfusionDiagnostic)[] {
  if (preferences.activeTab === "transition") return transitionRows(model, state);
  if (preferences.activeTab === "confusion") return confusionRows(model, state);
  return keyRows(model, preferences);
}

export function keyListRowMarkup(row: KeyDiagnostic, selected: boolean): string {
  const primary = row.displayedErrorRatio === null ? "—" : percent(row.displayedErrorRatio);
  // A null timing always means zero accepted samples, so the old
  // `${timingSamples} 時間樣本` could only ever render "0 時間樣本".
  const timing = row.timingAvailability === "not-applicable"
    ? "時間不適用"
    : row.timingMs === null
      ? "尚無時間樣本"
      : `${milliseconds(row.timingMs)} · ${row.timingSamples} 樣本`;
  return `<button type="button" class="diagnostic-inspector-row${selected ? " selected" : ""}" data-action="select-key" data-token="${escapeHtml(row.tokenId)}" aria-pressed="${selected}">
    <span class="diagnostic-inspector-identity"><strong>${escapeHtml(row.symbol)}</strong><small>${escapeHtml(row.physicalKey)}</small></span>
    <span class="diagnostic-inspector-main"><strong>${escapeHtml(primary)}</strong><small>${escapeHtml(timing)}</small></span>
    ${stateBadgeMarkup(row.overallDataState)}
  </button>`;
}

export function transitionListRowMarkup(row: TransitionDiagnostic, selected: boolean): string {
  return `<button type="button" class="diagnostic-inspector-row relation${selected ? " selected" : ""}" data-action="select-relation" data-id="${escapeHtml(row.id)}" aria-pressed="${selected}">
    <span class="diagnostic-relation-pair"><strong>${escapeHtml(row.fromSymbol)}</strong><small>${escapeHtml(row.fromPhysicalKey)}</small><i>→</i><strong>${escapeHtml(row.toSymbol)}</strong><small>${escapeHtml(row.toPhysicalKey)}</small></span>
    <span class="diagnostic-inspector-main"><strong>${milliseconds(row.timingMs)}</strong><small>${row.timingSamples} 樣本</small></span>
    ${stateBadgeMarkup(row.dataState)}
  </button>`;
}

export function confusionListRowMarkup(row: ConfusionDiagnostic, selected: boolean): string {
  return `<button type="button" class="diagnostic-inspector-row relation${selected ? " selected" : ""}" data-action="select-relation" data-id="${escapeHtml(row.id)}" aria-pressed="${selected}">
    <span class="diagnostic-relation-pair"><strong>${escapeHtml(row.expectedSymbol)}</strong><small>${escapeHtml(row.expectedPhysicalKey)}</small><i>→</i><strong>${escapeHtml(row.actualSymbol)}</strong><small>${escapeHtml(row.actualPhysicalKey)}</small></span>
    <span class="diagnostic-inspector-main"><strong>${row.occurrences} 次</strong><small>此應按鍵中占 ${percent(row.expectedErrorShare)}</small></span>
    ${stateBadgeMarkup(row.dataState)}
  </button>`;
}
