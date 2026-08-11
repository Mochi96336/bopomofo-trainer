import type { TokenId } from "../core/model.js";
import { physicalKeyLabel, tokenLabel } from "../diagnostics/labels.js";
import {
  dataStateForSamples,
  DIAGNOSTIC_POLICY,
} from "../diagnostics/policy.js";
import type {
  ConfusionDiagnostic,
  DiagnosticDataState,
  KeyDiagnostic,
  ProgressSeriesPoint,
} from "../diagnostics/types.js";
import { escapeHtml } from "./html.js";
import type { AnalysisV2Model } from "./analysis-v2-model.js";
import {
  analysisV2KeyboardRowsMarkup,
  analysisV2MethodDetailsMarkup,
  analysisV2Milliseconds,
  analysisV2Percent,
  analysisV2PrimaryStageMarkup,
} from "./analysis-v2-render-primitives.js";
import {
  ANALYSIS_V2_SPEED_VIEWBOX,
  analysisV2KeyboardCurvePath,
} from "./analysis-v2-speed-network.js";
import type {
  AnalysisV2Preferences,
  AnalysisV2SemanticView,
} from "./analysis-v2-state.js";
import { sparklinePoints } from "./practice-sparkline.js";

const SEMANTIC_LEAD_KEY_COUNT = 3;
const SEMANTIC_CONFUSION_MAX_VISIBLE_EDGES = 8;
const TREND_WIDTH = 168;
const TREND_HEIGHT = 40;
const TREND_PAD = 4;

function dataStateLabel(state: DiagnosticDataState): string {
  if (state === "sufficient") return "可比較";
  if (state === "preliminary") return "初步";
  return "樣本不足";
}

function semanticEvidenceWeight(state: DiagnosticDataState): number {
  if (state === "sufficient") return 1;
  if (state === "preliminary") return 0.7;
  return 0.38;
}

function semanticGradientStrength(
  value: number,
  maximum: number,
  state: DiagnosticDataState,
  hasData: boolean,
): number {
  if (!hasData) return 0;
  const relative = maximum <= 0 ? 0 : Math.max(0, Math.min(1, value / maximum));
  return Math.min(1, (0.08 + relative * 0.92) * semanticEvidenceWeight(state));
}

function semanticKeyStyle(columns: number, strength: number): string {
  const fill = (strength * 14).toFixed(1);
  const border = (18 + strength * 42).toFixed(1);
  const text = (44 + strength * 56).toFixed(1);
  return `--key-columns:${columns};--analysis-strength:${strength.toFixed(3)};--semantic-fill:${fill}%;--semantic-border:${border}%;--semantic-text:${text}%`;
}

function keyByToken(model: AnalysisV2Model): ReadonlyMap<TokenId, KeyDiagnostic> {
  return new Map(model.semantic.keys.map((row) => [row.tokenId, row]));
}

function timingEvidenceLabel(row: KeyDiagnostic): string {
  if (row.timingMs === null && row.timingAvailability === "not-applicable") return "不適用";
  if (row.timingSamples === 0) return "尚無乾淨樣本";
  if (row.timingDataState === null) return `${row.timingSamples} 個乾淨樣本`;
  return `${dataStateLabel(row.timingDataState)} · ${row.timingSamples} 個乾淨樣本`;
}

function timingDetailLabel(row: KeyDiagnostic): string {
  const evidence = timingEvidenceLabel(row);
  return row.timingMs === null ? evidence : `${analysisV2Milliseconds(row.timingMs)} · ${evidence}`;
}

function trendChartMarkup(
  label: string,
  points: readonly ProgressSeriesPoint[],
  scale: (value: number) => number,
  format: (value: number) => string,
): string {
  if (points.length < 2) return "";
  const values = points.slice(-10).map((point) => scale(point.value));
  const plotted = sparklinePoints(values, TREND_WIDTH, TREND_HEIGHT, TREND_PAD);
  const path = plotted
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ");
  const last = plotted.at(-1)!;
  return `<div class="analysis-v2-trend-chart">
    <div class="analysis-v2-trend-heading"><span>${escapeHtml(label)}</span><strong>${escapeHtml(format(values.at(-1)!))}</strong></div>
    <svg viewBox="0 0 ${TREND_WIDTH} ${TREND_HEIGHT}" preserveAspectRatio="none" aria-hidden="true">
      <line x1="${TREND_PAD}" y1="${TREND_HEIGHT - TREND_PAD}" x2="${TREND_WIDTH - TREND_PAD}" y2="${TREND_HEIGHT - TREND_PAD}"></line>
      <path d="${path}"></path>
      <circle cx="${last.x.toFixed(1)}" cy="${last.y.toFixed(1)}" r="2.5"></circle>
    </svg>
  </div>`;
}

function keyDetailMarkup(model: AnalysisV2Model, tokenId: TokenId | null): string {
  if (tokenId === null) return "";
  const row = model.semantic.keys.find((candidate) => candidate.tokenId === tokenId);
  if (row === undefined) return "";
  const progress = model.semantic.keyProgress[tokenId];
  const trends = progress === undefined ? "" : [
    trendChartMarkup(
      "近期錯誤觀察",
      progress.correctness.points,
      (value) => value * 100,
      (value) => `${Math.round(value)}%`,
    ),
    trendChartMarkup(
      "近期鍵間時間",
      progress.timing.points,
      (value) => value,
      (value) => `${Math.round(value)} ms`,
    ),
  ].filter(Boolean).join("");
  return `<article class="analysis-v2-inspector-content">
    <div class="analysis-v2-detail-heading"><strong>${escapeHtml(row.symbol)}</strong><span>實體鍵 ${escapeHtml(row.physicalKey)}</span></div>
    <dl>
      <div><dt>錯誤觀察</dt><dd>${escapeHtml(analysisV2Percent(row.displayedErrorRatio))}</dd></div>
      <div><dt>錯誤資料</dt><dd>${escapeHtml(dataStateLabel(row.errorDataState))} · ${row.attempts} 次</dd></div>
      <div><dt>有效鍵間時間</dt><dd>${escapeHtml(timingDetailLabel(row))}</dd></div>
    </dl>
    ${trends === "" ? "" : `<section class="analysis-v2-trends" aria-label="${escapeHtml(row.symbol)} 的歷史趨勢">${trends}</section>`}
  </article>`;
}

function rankedSemanticKeys(model: AnalysisV2Model): readonly KeyDiagnostic[] {
  return [...model.semantic.keys]
    .filter((row) => row.errorDataState === "sufficient"
      && row.displayedErrorRatio !== null
      && row.displayedErrorRatio > 0)
    .sort((left, right) => (right.displayedErrorRatio ?? 0) - (left.displayedErrorRatio ?? 0)
      || right.attempts - left.attempts
      || left.tokenId.localeCompare(right.tokenId));
}

function strongestConfusionsByToken(model: AnalysisV2Model): ReadonlyMap<TokenId, ConfusionDiagnostic> {
  const result = new Map<TokenId, ConfusionDiagnostic>();
  for (const row of model.semantic.confusions) {
    const previous = result.get(row.expectedTokenId);
    if (previous === undefined
      || row.expectedErrorShare > previous.expectedErrorShare
      || (row.expectedErrorShare === previous.expectedErrorShare && row.occurrences > previous.occurrences)) {
      result.set(row.expectedTokenId, row);
    }
  }
  return result;
}

function confusionKeyDataState(row: ConfusionDiagnostic | undefined): DiagnosticDataState {
  return dataStateForSamples(
    row?.expectedConfusionTotal ?? 0,
    DIAGNOSTIC_POLICY.relationshipSamples,
  );
}

function rankedConfusionKeys(model: AnalysisV2Model): readonly ConfusionDiagnostic[] {
  return [...strongestConfusionsByToken(model).values()]
    .filter((row) => confusionKeyDataState(row) === "sufficient" && row.expectedConfusionTotal > 0)
    .sort((left, right) => right.expectedConfusionTotal - left.expectedConfusionTotal
      || right.occurrences - left.occurrences
      || right.expectedErrorShare - left.expectedErrorShare
      || left.expectedTokenId.localeCompare(right.expectedTokenId));
}

function semanticLeadMarkup(model: AnalysisV2Model, view: AnalysisV2SemanticView): string {
  if (view === "correctness") {
    const rows = rankedSemanticKeys(model);
    if (rows.length === 0) {
      return `<div class="analysis-v2-hero-readout analysis-v2-semantic-readout"><strong>仍在累積</strong><small>資料足夠後才顯示需要留意的按鍵</small></div>`;
    }
    const symbols = rows.slice(0, SEMANTIC_LEAD_KEY_COUNT)
      .map((row) => escapeHtml(row.symbol))
      .join("　");
    return `<div class="analysis-v2-hero-readout analysis-v2-semantic-readout"><strong class="analysis-v2-semantic-symbols">${symbols}</strong><small>較常出現錯誤的按鍵</small></div>`;
  }
  const rows = rankedConfusionKeys(model);
  if (rows.length === 0) {
    return `<div class="analysis-v2-hero-readout analysis-v2-semantic-readout"><strong>仍在累積</strong><small>誤按資料足夠後才顯示需要留意的按鍵</small></div>`;
  }
  const symbols = rows.slice(0, SEMANTIC_LEAD_KEY_COUNT)
    .map((row) => escapeHtml(row.expectedSymbol))
    .join("　");
  return `<div class="analysis-v2-hero-readout analysis-v2-semantic-readout"><strong class="analysis-v2-semantic-symbols">${symbols}</strong><small>較常發生誤按的按鍵</small></div>`;
}

function semanticSummaryRailMarkup(model: AnalysisV2Model): string {
  const comparableKeys = model.semantic.keys.filter((row) => row.errorDataState === "sufficient").length;
  const observedDirections = model.semantic.confusions.filter((row) => row.occurrences > 0).length;
  const comparableDirections = model.semantic.confusions.filter((row) => row.dataState === "sufficient").length;
  return `<section class="analysis-v2-semantic-rail" aria-label="語意摘要">
    <div><strong>按鍵資料</strong><span>${model.semantic.keysWithData} 鍵 · ${comparableKeys} 鍵可比較</span></div>
    <div><strong>誤按資料</strong><span>${model.semantic.repeatedConfusions} 組重複 · ${observedDirections} 條觀察方向 · ${comparableDirections} 條可比較</span></div>
  </section>`;
}

function correctnessKeyboardMarkup(model: AnalysisV2Model, selectedKey: TokenId | null): string {
  const byToken = keyByToken(model);
  const maximum = Math.max(0, ...model.semantic.keys.map((row) => row.displayedErrorRatio ?? 0));
  const keyboard = analysisV2KeyboardRowsMarkup((tokenId, key, columns) => {
    const diagnostic = byToken.get(tokenId);
    const state = diagnostic?.errorDataState ?? "insufficient";
    const selected = selectedKey === tokenId;
    const hasData = diagnostic !== undefined && diagnostic.attempts > 0 && diagnostic.displayedErrorRatio !== null;
    const strength = semanticGradientStrength(
      diagnostic?.displayedErrorRatio ?? 0,
      maximum,
      state,
      hasData,
    );
    return `<button type="button" class="analysis-v2-key ${state}${hasData ? " has-data" : ""}${selected ? " selected" : ""}" style="${semanticKeyStyle(columns, strength)}" data-action="select-key" data-token="${escapeHtml(tokenId)}" aria-pressed="${selected}" aria-label="${escapeHtml(tokenLabel(tokenId))}，實體鍵 ${escapeHtml(physicalKeyLabel(key.code))}，錯誤觀察比例 ${escapeHtml(analysisV2Percent(diagnostic?.displayedErrorRatio ?? null))}，${escapeHtml(dataStateLabel(state))}，${diagnostic?.attempts ?? 0} 次觀察"><strong>${escapeHtml(tokenLabel(tokenId))}</strong><small aria-hidden="true"></small></button>`;
  });
  const object = `<div class="analysis-v2-keyboard analysis-v2-semantic-gradient-keyboard">${keyboard}</div>`;
  return `<div class="analysis-v2-semantic-stage${selectedKey === null ? "" : " has-selection"}">
    ${analysisV2PrimaryStageMarkup(object, semanticLeadMarkup(model, "correctness"), "analysis-v2-semantic-primary")}
    ${selectedKey === null ? "" : `<aside class="analysis-v2-inspector" aria-live="polite">${keyDetailMarkup(model, selectedKey)}</aside>`}
  </div>`;
}

function confusionRowsFor(model: AnalysisV2Model, tokenId: TokenId): readonly ConfusionDiagnostic[] {
  return model.semantic.confusions
    .filter((row) => row.expectedTokenId === tokenId)
    .sort((left, right) => right.occurrences - left.occurrences
      || right.expectedErrorShare - left.expectedErrorShare
      || left.id.localeCompare(right.id));
}

function confusionDetailMarkup(model: AnalysisV2Model, tokenId: TokenId | null): string {
  if (tokenId === null) return "";
  const rows = confusionRowsFor(model, tokenId);
  const key = model.semantic.keys.find((candidate) => candidate.tokenId === tokenId);
  if (key === undefined) return "";
  return `<article class="analysis-v2-inspector-content">
    <div class="analysis-v2-detail-heading"><strong>${escapeHtml(key.symbol)}</strong><span>誤按去向</span></div>
    ${rows.length === 0
      ? '<p class="analysis-v2-inspector-empty">目前沒有能確認原意的誤按。</p>'
      : `<ol class="analysis-v2-confusion-list">${rows.map((row) => `<li><div><strong>${escapeHtml(row.actualSymbol)}</strong><span>${escapeHtml(row.actualPhysicalKey)}</span></div><div><b>${row.occurrences}</b><small>${escapeHtml(analysisV2Percent(row.expectedErrorShare))} · ${escapeHtml(dataStateLabel(row.dataState))}</small></div></li>`).join("")}</ol>`}
  </article>`;
}

function visibleConfusionRows(
  model: AnalysisV2Model,
  selectedKey: TokenId | null,
): readonly ConfusionDiagnostic[] {
  const rows = model.semantic.confusions
    .filter((row) => row.occurrences > 0 && row.expectedTokenId !== row.actualTokenId)
    .filter((row) => selectedKey === null || row.expectedTokenId === selectedKey)
    .sort((left, right) => {
      const leftEvidence = semanticEvidenceWeight(left.dataState);
      const rightEvidence = semanticEvidenceWeight(right.dataState);
      return rightEvidence - leftEvidence
        || right.occurrences - left.occurrences
        || right.expectedErrorShare - left.expectedErrorShare
        || left.id.localeCompare(right.id);
    });
  return rows.slice(0, SEMANTIC_CONFUSION_MAX_VISIBLE_EDGES);
}

function confusionFlylinesMarkup(
  model: AnalysisV2Model,
  selectedKey: TokenId | null,
): string {
  const rows = visibleConfusionRows(model, selectedKey);
  if (rows.length === 0) return "";
  const maximum = Math.max(...rows.map((row) => row.occurrences), 1);
  const viewBox = ANALYSIS_V2_SPEED_VIEWBOX;
  const paths = rows.map((row, index) => {
    const path = analysisV2KeyboardCurvePath(row.id, row.expectedTokenId, row.actualTokenId);
    if (path === null) return "";
    const strength = semanticGradientStrength(
      row.occurrences,
      maximum,
      row.dataState,
      true,
    );
    const accent = selectedKey !== null && index === 0;
    const label = `${row.expectedSymbol} 誤按成 ${row.actualSymbol}，${row.occurrences} 次，${analysisV2Percent(row.expectedErrorShare)}`;
    return `<path class="analysis-v2-confusion-path${accent ? " is-accent" : ""}" d="${path}" style="--confusion-strength:${strength.toFixed(3)}" aria-hidden="true"><title>${escapeHtml(label)}</title></path>`;
  }).join("");
  return `<svg class="analysis-v2-confusion-svg" viewBox="${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}" preserveAspectRatio="none" aria-hidden="true">${paths}</svg>`;
}

function confusionKeyboardMarkup(model: AnalysisV2Model, selectedKey: TokenId | null): string {
  const strongestByToken = strongestConfusionsByToken(model);
  const maximum = Math.max(0, ...[...strongestByToken.values()].map((row) => row.expectedConfusionTotal));
  const keyboard = analysisV2KeyboardRowsMarkup((tokenId, key, columns) => {
    const confusion = strongestByToken.get(tokenId);
    const state = confusionKeyDataState(confusion);
    const selected = selectedKey === tokenId;
    const hasData = confusion !== undefined && confusion.expectedConfusionTotal > 0;
    const strength = semanticGradientStrength(
      confusion?.expectedConfusionTotal ?? 0,
      maximum,
      state,
      hasData,
    );
    return `<button type="button" class="analysis-v2-key ${state}${hasData ? " has-data" : ""}${selected ? " selected" : ""}" style="${semanticKeyStyle(columns, strength)}" data-action="select-key" data-token="${escapeHtml(tokenId)}" aria-pressed="${selected}" aria-label="${escapeHtml(tokenLabel(tokenId))}，實體鍵 ${escapeHtml(physicalKeyLabel(key.code))}，已確認原意的誤按 ${confusion?.expectedConfusionTotal ?? 0} 次，${escapeHtml(dataStateLabel(state))}"><strong>${escapeHtml(tokenLabel(tokenId))}</strong><small aria-hidden="true"></small></button>`;
  });
  const object = `<div class="analysis-v2-keyboard analysis-v2-semantic-gradient-keyboard analysis-v2-confusion-keyboard">${keyboard}${confusionFlylinesMarkup(model, selectedKey)}</div>`;
  return `<div class="analysis-v2-semantic-stage${selectedKey === null ? "" : " has-selection"}">
    ${analysisV2PrimaryStageMarkup(object, semanticLeadMarkup(model, "confusion"), "analysis-v2-semantic-primary")}
    ${selectedKey === null ? "" : `<aside class="analysis-v2-inspector" aria-live="polite">${confusionDetailMarkup(model, selectedKey)}</aside>`}
  </div>`;
}

export function renderAnalysisV2Semantic(
  model: AnalysisV2Model,
  preferences: AnalysisV2Preferences,
  selectedKey: TokenId | null,
): string {
  return `<section class="analysis-v2-domain analysis-v2-semantic-domain" aria-labelledby="analysis-v2-tab-semantic">
    <div class="analysis-v2-domain-controls"><div class="analysis-v2-segments" role="group" aria-label="語意觀察方式">
      <button type="button" data-action="semantic-view" data-value="correctness" aria-pressed="${preferences.semanticView === "correctness"}">按鍵</button>
      <button type="button" data-action="semantic-view" data-value="confusion" aria-pressed="${preferences.semanticView === "confusion"}">誤按</button>
    </div></div>
    ${preferences.semanticView === "correctness"
      ? correctnessKeyboardMarkup(model, selectedKey)
      : confusionKeyboardMarkup(model, selectedKey)}
    ${semanticSummaryRailMarkup(model)}
    ${analysisV2MethodDetailsMarkup(
      "資料規則",
      preferences.semanticView === "correctness"
        ? "錯誤觀察比例只來自能確定原本應按哪個鍵的觀察；樣本不足時不做高低判讀。時間描述前一個已接受事件到目前按鍵，不是能力分數。"
        : "只顯示實際觀察到，而且能確定原本應按哪個鍵的誤按方向；資料足夠後才做高低判讀。",
    )}
  </section>`;
}
