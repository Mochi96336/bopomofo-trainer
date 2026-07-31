import type { TokenId } from "../core/model.js";
import { physicalKeyLabel, tokenLabel } from "../diagnostics/labels.js";
import type { DiagnosticModel } from "../diagnostics/types.js";
import { STANDARD_BOPOMOFO_LAYOUT } from "../scheme/standard-layout.js";
import {
  diagnosticNetworkVisible,
  type DiagnosticAnalysisSelection,
} from "./diagnostic-analysis-state.js";
import type { DiagnosticPreferences } from "./diagnostic-preferences.js";
import { keyRows, visibleRowsForTab } from "./diagnostic-rows.js";
import {
  KEYBOARD_GEOMETRY_ROWS,
  keyboardColumnSpan,
} from "./keyboard-geometry.js";
import { escapeHtml } from "./html.js";

const NETWORK_ICON_SVG = `<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
  <path d="M3.4 3.4 L12.6 3.4 M3.4 3.4 L8 13 M12.6 3.4 L8 13"></path>
  <circle cx="3.4" cy="3.4" r="1.7" fill="currentColor" stroke="none"></circle>
  <circle cx="12.6" cy="3.4" r="1.7" fill="currentColor" stroke="none"></circle>
  <circle cx="8" cy="13" r="1.7" fill="currentColor" stroke="none"></circle>
</svg>`;

/**
 * The keyboard view. Signal strength is a rank within what the active tab is
 * already showing, not an independent score: the board and the list must never
 * disagree about which keys matter right now.
 */
interface KeyboardSignal {
  readonly strength: number;
  readonly connected: boolean;
  readonly selected: boolean;
}

function keyboardSignals(
  model: DiagnosticModel,
  preferences: DiagnosticPreferences,
  state: DiagnosticAnalysisSelection,
): ReadonlyMap<TokenId, KeyboardSignal> {
  const result = new Map<TokenId, KeyboardSignal>();
  if (preferences.activeTab === "key") {
    const rows = keyRows(model, preferences);
    rows.forEach((row, index) => {
      result.set(row.tokenId, {
        strength: Math.max(0.18, 1 - index / Math.max(1, rows.length)),
        connected: true,
        selected: state.selectedKey === row.tokenId,
      });
    });
    return result;
  }

  const rows = visibleRowsForTab(model, preferences, state);
  const relationCounts = new Map<TokenId, number>();
  for (const row of rows) {
    const tokens = "fromTokenId" in row
      ? [row.fromTokenId, row.toTokenId]
      : "expectedTokenId" in row
        ? [row.expectedTokenId, row.actualTokenId]
        : [row.tokenId];
    for (const tokenId of tokens) {
      relationCounts.set(tokenId, (relationCounts.get(tokenId) ?? 0) + 1);
    }
  }
  const maximum = Math.max(1, ...relationCounts.values());
  for (const [tokenId, count] of relationCounts) {
    result.set(tokenId, {
      strength: Math.max(0.24, count / maximum),
      connected: true,
      selected: state.selectedKey === tokenId,
    });
  }
  if (state.selectedKey !== null && !result.has(state.selectedKey)) {
    result.set(state.selectedKey, {
      strength: 1,
      connected: false,
      selected: true,
    });
  }
  return result;
}

export function diagnosticKeyboardTokenLabel(code: string): string | null {
  const tokenId = STANDARD_BOPOMOFO_LAYOUT.bindings[code];
  return tokenId === undefined ? null : tokenLabel(tokenId);
}

function networkVisible(
  preferences: DiagnosticPreferences,
  state: DiagnosticAnalysisSelection,
): boolean {
  return diagnosticNetworkVisible({ preferences, selection: state });
}

export function keyboardMarkup(
  model: DiagnosticModel,
  preferences: DiagnosticPreferences,
  state: DiagnosticAnalysisSelection,
): string {
  const signals = keyboardSignals(model, preferences, state);
  return `<section class="diagnostic-analysis-canvas" aria-label="鍵盤診斷視圖">
    <div class="diagnostic-analysis-title-block">
      <h2 id="diagnostic-analysis-title" aria-label="弱點診斷分析">分析</h2>
    </div>
    <div class="diagnostic-network-icon-slot">
      <button type="button" class="diagnostic-network-icon" data-action="toggle-network" aria-pressed="${networkVisible(preferences, state)}" aria-label="轉換總覽：顯示已記錄與可能的按鍵轉換；輸入越慢，顏色越接近紅色。" title="轉換總覽">${NETWORK_ICON_SVG}</button>
    </div>
    <div class="diagnostic-keyboard-stage">
      <div class="diagnostic-keyboard-board">
        ${KEYBOARD_GEOMETRY_ROWS.map((row) => `<div class="diagnostic-keyboard-row">
          ${row.map((key) => {
            const tokenId = STANDARD_BOPOMOFO_LAYOUT.bindings[key.code];
            const columns = keyboardColumnSpan(key);
            const wide = key.units !== undefined ? " wide" : "";
            if (tokenId === undefined) {
              return `<span class="diagnostic-keyboard-key unmapped${wide}" style="--key-columns:${columns}" data-code="${escapeHtml(key.code)}" aria-hidden="true"></span>`;
            }
            const signal = signals.get(tokenId);
            const classes = [
              "diagnostic-keyboard-key",
              wide.trim(),
              signal?.connected ? "connected" : "",
              signal?.selected ? "selected" : "",
            ].filter(Boolean).join(" ");
            const style = `--key-columns:${columns};--signal-strength:${signal?.strength ?? 0}`;
            return `<button type="button" class="${classes}" style="${style}" data-action="select-key" data-token="${escapeHtml(tokenId)}" data-code="${escapeHtml(key.code)}" aria-pressed="${signal?.selected ?? false}" aria-label="${escapeHtml(tokenLabel(tokenId))}，實體鍵 ${escapeHtml(physicalKeyLabel(key.code))}">
              <strong>${escapeHtml(tokenLabel(tokenId))}</strong>
            </button>`;
          }).join("")}
        </div>`).join("")}
      </div>
    </div>
  </section>`;
}
