import type { TokenId } from "../core/model.js";
import type { CurriculumBindingRecord } from "../curriculum/types.js";
import { physicalKeyLabel, tokenLabel } from "../diagnostics/labels.js";
import { escapeHtml } from "./html.js";

/**
 * The practice panel's short list of the keys a learner is currently getting
 * wrong most often. This is a display ranking, not a curriculum input: nothing
 * here feeds selection weight, which the curriculum decides on its own from the
 * expected token.
 */

/** Below this, one unlucky round would dominate the ranking. */
export const WEAK_BINDING_MIN_ATTEMPTS = 5;
export const WEAK_BINDING_LIMIT = 5;

export interface WeakBinding {
  readonly tokenId: TokenId;
  readonly errorRate: number;
  readonly attempts: number;
}

/**
 * Ranked worst first. A binding with no errors is left out entirely rather than
 * shown at zero: the list exists to name what to work on, and a clean key is
 * not that.
 */
export function weakestBindings(
  bindings: Readonly<Record<string, CurriculumBindingRecord>>,
): readonly WeakBinding[] {
  const rows: WeakBinding[] = [];
  for (const record of Object.values(bindings)) {
    const aggregate = record.aggregate;
    if (aggregate === null || aggregate.attempts < WEAK_BINDING_MIN_ATTEMPTS) continue;
    const errorRate = aggregate.errors / aggregate.attempts;
    if (errorRate <= 0) continue;
    rows.push({ tokenId: record.scope.tokenId, errorRate, attempts: aggregate.attempts });
  }
  return rows
    .sort((left, right) => right.errorRate - left.errorRate || right.attempts - left.attempts)
    .slice(0, WEAK_BINDING_LIMIT);
}

export function weakBindingsMarkup(
  rows: readonly WeakBinding[],
  physicalKeyForToken: ReadonlyMap<TokenId, string>,
): string {
  if (rows.length === 0) {
    // 錯誤觀察比例, not 錯誤率: recovery input counts as another mapped
    // observation, so this is not a first-attempt error rate.
    return '<div class="history-empty">累積更多練習後，這裡會列出目前錯誤觀察比例較高的按鍵。</div>';
  }
  // The bar is scaled against the worst row rather than against 100%, so the
  // shape stays readable once every remaining weakness is a small percentage.
  const maxRate = Math.max(...rows.map((row) => row.errorRate));
  return `<div class="weak-bindings">${rows.map((row) => {
    const code = physicalKeyForToken.get(row.tokenId);
    const keyLabel = code === undefined ? "—" : physicalKeyLabel(code);
    const widthPercent = Math.max(6, Math.round((row.errorRate / maxRate) * 100));
    return `<div class="weak-binding-row">
      <span class="weak-binding-symbol">${escapeHtml(tokenLabel(row.tokenId))}</span>
      <span class="weak-binding-key">${escapeHtml(keyLabel)}</span>
      <span class="weak-binding-bar-track"><span class="weak-binding-bar" style="width:${widthPercent}%"></span></span>
      <span class="weak-binding-rate">${Math.round(row.errorRate * 100)}%</span>
    </div>`;
  }).join("")}</div>`;
}
