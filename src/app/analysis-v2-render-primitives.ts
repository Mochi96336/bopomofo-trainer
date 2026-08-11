import type { TokenId } from "../core/model.js";
import { STANDARD_BOPOMOFO_LAYOUT } from "../scheme/standard-layout.js";
import { KEYBOARD_GEOMETRY_ROWS, keyboardColumnSpan } from "./keyboard-geometry.js";
import { escapeHtml } from "./html.js";

export function analysisV2Percent(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

export function analysisV2Milliseconds(value: number | null): string {
  return value === null ? "—" : `${Math.round(value)} ms`;
}

export function analysisV2MethodDetailsMarkup(label: string, body: string): string {
  return `<details class="analysis-v2-method"><summary>${escapeHtml(label)}</summary><p>${escapeHtml(body)}</p></details>`;
}

export function analysisV2PrimaryStageMarkup(
  object: string,
  readout: string,
  extraClass: string,
): string {
  return `<section class="analysis-v2-primary-stage analysis-v2-visual-stage ${extraClass}">
    <div class="analysis-v2-primary-object-slot">${object}</div>
    ${readout}
  </section>`;
}

export function analysisV2KeyboardRowsMarkup(
  keyMarkup: (
    tokenId: TokenId,
    key: (typeof KEYBOARD_GEOMETRY_ROWS)[number][number],
    columns: number,
  ) => string,
): string {
  return KEYBOARD_GEOMETRY_ROWS.map((row) => `<div class="analysis-v2-keyboard-row">${row.map((key) => {
    const columns = keyboardColumnSpan(key);
    const tokenId = STANDARD_BOPOMOFO_LAYOUT.bindings[key.code];
    if (tokenId === undefined) {
      return `<span class="analysis-v2-key unmapped" style="--key-columns:${columns}" aria-hidden="true"></span>`;
    }
    return keyMarkup(tokenId, key, columns);
  }).join("")}</div>`).join("");
}
