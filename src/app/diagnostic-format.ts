import { diagnosticDataStateLabel } from "../diagnostics/labels.js";
import type { DiagnosticDataState } from "../diagnostics/types.js";
import { escapeHtml } from "./html.js";

/**
 * Value formatting shared by every diagnostic surface. These are kept together
 * so a number is written the same way wherever it appears: a ratio read in the
 * key list has to match the same ratio read on a progress chart.
 */

export function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function milliseconds(value: number): string {
  return `${Math.round(value)} ms`;
}

export function boost(value: number): string {
  return `${value.toFixed(2)}×`;
}

/** A sufficient state is not labelled: only a shortfall is worth the learner's attention. */
export function stateBadgeMarkup(state: DiagnosticDataState): string {
  if (state === "sufficient") return "";
  return `<span class="diagnostic-state ${state}">${escapeHtml(diagnosticDataStateLabel(state))}</span>`;
}

export function detailStateMarkup(state: DiagnosticDataState): string {
  if (state === "sufficient") return "";
  return `<strong class="diagnostic-detail-state ${state}">${escapeHtml(diagnosticDataStateLabel(state))}</strong>`;
}
