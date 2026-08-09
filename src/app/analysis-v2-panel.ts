import "./analysis-v2.css";
import "./analysis-v2-hierarchy.css";
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
import type {
  CoordinationBodySizeBucket,
  ImmediateHandAggregateScope,
  ImmediateTokenAggregateScope,
  InputOrderPositionAggregateScope,
  SameHandRevisitAggregateScope,
} from "../measurement-v2/aggregate.js";
import { STANDARD_BOPOMOFO_LAYOUT } from "../scheme/standard-layout.js";
import { KEYBOARD_GEOMETRY_ROWS, keyboardColumnSpan } from "./keyboard-geometry.js";
import { escapeHtml } from "./html.js";
import type { AnalysisV2Model, AnalysisV2MotorCell } from "./analysis-v2-model.js";
import { sparklinePoints } from "./practice-sparkline.js";
import {
  ANALYSIS_V2_SPEED_MAX_VISIBLE_EDGES,
  ANALYSIS_V2_SPEED_VIEWBOX,
  analysisV2KeyboardCurvePath,
  buildAnalysisV2SpeedPaths,
} from "./analysis-v2-speed-network.js";

export type AnalysisV2Tab = "coordination" | "semantic" | "strategy";
type SemanticView = "correctness" | "confusion";
type CoordinationView = "paths" | "movement";

interface AnalysisV2Preferences {
  readonly activeTab: AnalysisV2Tab;
  readonly semanticView: SemanticView;
}

export interface AnalysisV2PreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface AnalysisV2Controller {
  readonly host: HTMLElement;
  open(initialTab?: AnalysisV2Tab): void;
  close(): void;
  destroy(): void;
}

export interface AnalysisV2Options {
  readonly getModel: () => AnalysisV2Model;
  readonly storage: AnalysisV2PreferenceStorage;
  readonly onClose?: () => void;
}

const PREFERENCES_KEY = "bopomofo-trainer.analysis-v2.v1";
const TABS: readonly AnalysisV2Tab[] = ["coordination", "semantic", "strategy"];
const DEFAULT_PREFERENCES: AnalysisV2Preferences = {
  activeTab: "coordination",
  semanticView: "correctness",
};
const BODY_SIZES: readonly CoordinationBodySizeBucket[] = ["2", "3"];
const POSITIONS = ["first", "middle", "last"] as const;
const SEMANTIC_LEAD_KEY_COUNT = 3;
const SEMANTIC_CONFUSION_MAX_VISIBLE_EDGES = 8;
const SPEED_SALIENT_EDGE_COUNT = 16;
const SPEED_SLOW_EDGE_COUNT = 3;
const STRATEGY_LEAD_MIN_ROW_OBSERVATIONS = 8;
const TREND_WIDTH = 168;
const TREND_HEIGHT = 40;
const TREND_PAD = 4;
const MOTOR_TREND_WIDTH = 168;
const MOTOR_TREND_HEIGHT = 30;
const MOTOR_TREND_PAD = 3;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTab(value: unknown): value is AnalysisV2Tab {
  return value === "coordination" || value === "semantic" || value === "strategy";
}

function isSemanticView(value: unknown): value is SemanticView {
  return value === "correctness" || value === "confusion";
}

function isCoordinationView(value: unknown): value is CoordinationView {
  return value === "paths" || value === "movement";
}

function isBodySize(value: unknown): value is CoordinationBodySizeBucket {
  return value === "2" || value === "3";
}

function loadPreferences(storage: AnalysisV2PreferenceStorage): AnalysisV2Preferences {
  try {
    const source = storage.getItem(PREFERENCES_KEY);
    if (source === null) return DEFAULT_PREFERENCES;
    const value = JSON.parse(source) as unknown;
    if (!isRecord(value) || !isSemanticView(value.semanticView)) return DEFAULT_PREFERENCES;
    return {
      activeTab: isTab(value.activeTab) ? value.activeTab : "coordination",
      semanticView: value.semanticView,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

function savePreferences(storage: AnalysisV2PreferenceStorage, value: AnalysisV2Preferences): void {
  try {
    storage.setItem(PREFERENCES_KEY, JSON.stringify(value));
  } catch {
    // Preferences remain session-only when storage is unavailable.
  }
}

function percent(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

function milliseconds(value: number | null): string {
  return value === null ? "—" : `${Math.round(value)} ms`;
}

function tabLabel(tab: AnalysisV2Tab): string {
  return tab === "coordination" ? "協調" : tab === "strategy" ? "策略" : "語意";
}

function tabId(tab: AnalysisV2Tab): string {
  return `analysis-v2-tab-${tab}`;
}

function tabPanelId(tab: AnalysisV2Tab): string {
  return `analysis-v2-panel-${tab}`;
}

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

function methodDetailsMarkup(label: string, body: string): string {
  return `<details class="analysis-v2-method"><summary>${escapeHtml(label)}</summary><p>${escapeHtml(body)}</p></details>`;
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
  return row.timingMs === null ? evidence : `${milliseconds(row.timingMs)} · ${evidence}`;
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

function motorTrendMarkup<Scope>(cell: AnalysisV2MotorCell<Scope>): string {
  const values = cell.history.slice(-10).map((point) => point.representativeTimingMs);
  if (values.length < 2) {
    return '<span class="analysis-v2-motor-sparkline-empty" aria-hidden="true">—</span>';
  }
  const plotted = sparklinePoints(values, MOTOR_TREND_WIDTH, MOTOR_TREND_HEIGHT, MOTOR_TREND_PAD);
  const path = plotted
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ");
  const last = plotted.at(-1)!;
  return `<svg class="analysis-v2-motor-sparkline" viewBox="0 0 ${MOTOR_TREND_WIDTH} ${MOTOR_TREND_HEIGHT}" preserveAspectRatio="none" aria-hidden="true">
    <line x1="${MOTOR_TREND_PAD}" y1="${MOTOR_TREND_HEIGHT - MOTOR_TREND_PAD}" x2="${MOTOR_TREND_WIDTH - MOTOR_TREND_PAD}" y2="${MOTOR_TREND_HEIGHT - MOTOR_TREND_PAD}"></line>
    <path d="${path}"></path>
    <circle cx="${last.x.toFixed(1)}" cy="${last.y.toFixed(1)}" r="2"></circle>
  </svg>`;
}

function keyDetailMarkup(model: AnalysisV2Model, tokenId: TokenId | null): string {
  if (tokenId === null) return "";
  const row = model.semantic.keys.find((candidate) => candidate.tokenId === tokenId);
  if (row === undefined) return "";
  const progress = model.semantic.keyProgress[tokenId];
  const trends = progress === undefined ? "" : [
    trendChartMarkup("近期錯誤觀察", progress.correctness.points, (value) => value * 100, (value) => `${Math.round(value)}%`),
    trendChartMarkup("近期鍵間時間", progress.timing.points, (value) => value, (value) => `${Math.round(value)} ms`),
  ].filter(Boolean).join("");
  return `<article class="analysis-v2-inspector-content">
    <div class="analysis-v2-detail-heading"><strong>${escapeHtml(row.symbol)}</strong><span>實體鍵 ${escapeHtml(row.physicalKey)}</span></div>
    <dl>
      <div><dt>錯誤觀察</dt><dd>${escapeHtml(percent(row.displayedErrorRatio))}</dd></div>
      <div><dt>錯誤資料</dt><dd>${escapeHtml(dataStateLabel(row.errorDataState))} · ${row.attempts} 次</dd></div>
      <div><dt>有效鍵間時間</dt><dd>${escapeHtml(timingDetailLabel(row))}</dd></div>
    </dl>
    ${trends === "" ? "" : `<section class="analysis-v2-trends" aria-label="${escapeHtml(row.symbol)} 的歷史趨勢">${trends}</section>`}
  </article>`;
}

function keyboardRowsMarkup(
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

function semanticLeadMarkup(model: AnalysisV2Model, view: SemanticView): string {
  if (view === "correctness") {
    const rows = rankedSemanticKeys(model);
    if (rows.length === 0) {
      return `<div class="analysis-v2-hero-readout analysis-v2-semantic-readout"><strong>仍在累積</strong><small>資料足夠後才顯示需要留意的按鍵</small></div>`;
    }
    const symbols = rows.slice(0, SEMANTIC_LEAD_KEY_COUNT).map((row) => escapeHtml(row.symbol)).join("　");
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

function primaryStageMarkup(object: string, readout: string, extraClass: string): string {
  return `<section class="analysis-v2-primary-stage analysis-v2-visual-stage ${extraClass}">
    <div class="analysis-v2-primary-object-slot">${object}</div>
    ${readout}
  </section>`;
}

function correctnessKeyboardMarkup(model: AnalysisV2Model, selectedKey: TokenId | null): string {
  const byToken = keyByToken(model);
  const maximum = Math.max(0, ...model.semantic.keys.map((row) => row.displayedErrorRatio ?? 0));
  const keyboard = keyboardRowsMarkup((tokenId, key, columns) => {
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
    return `<button type="button" class="analysis-v2-key ${state}${hasData ? " has-data" : ""}${selected ? " selected" : ""}" style="${semanticKeyStyle(columns, strength)}" data-action="select-key" data-token="${escapeHtml(tokenId)}" aria-pressed="${selected}" aria-label="${escapeHtml(tokenLabel(tokenId))}，實體鍵 ${escapeHtml(physicalKeyLabel(key.code))}，錯誤觀察比例 ${escapeHtml(percent(diagnostic?.displayedErrorRatio ?? null))}，${escapeHtml(dataStateLabel(state))}，${diagnostic?.attempts ?? 0} 次觀察"><strong>${escapeHtml(tokenLabel(tokenId))}</strong><small aria-hidden="true"></small></button>`;
  });
  const object = `<div class="analysis-v2-keyboard analysis-v2-semantic-gradient-keyboard">${keyboard}</div>`;
  return `<div class="analysis-v2-semantic-stage${selectedKey === null ? "" : " has-selection"}">
    ${primaryStageMarkup(object, semanticLeadMarkup(model, "correctness"), "analysis-v2-semantic-primary")}
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
      : `<ol class="analysis-v2-confusion-list">${rows.map((row) => `<li><div><strong>${escapeHtml(row.actualSymbol)}</strong><span>${escapeHtml(row.actualPhysicalKey)}</span></div><div><b>${row.occurrences}</b><small>${escapeHtml(percent(row.expectedErrorShare))} · ${escapeHtml(dataStateLabel(row.dataState))}</small></div></li>`).join("")}</ol>`}
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
    const label = `${row.expectedSymbol} 誤按成 ${row.actualSymbol}，${row.occurrences} 次，${percent(row.expectedErrorShare)}`;
    return `<path class="analysis-v2-confusion-path${accent ? " is-accent" : ""}" d="${path}" style="--confusion-strength:${strength.toFixed(3)}" aria-hidden="true"><title>${escapeHtml(label)}</title></path>`;
  }).join("");
  return `<svg class="analysis-v2-confusion-svg" viewBox="${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}" preserveAspectRatio="none" aria-hidden="true">${paths}</svg>`;
}

function confusionKeyboardMarkup(model: AnalysisV2Model, selectedKey: TokenId | null): string {
  const strongestByToken = strongestConfusionsByToken(model);
  const maximum = Math.max(0, ...[...strongestByToken.values()].map((row) => row.expectedConfusionTotal));
  const keyboard = keyboardRowsMarkup((tokenId, key, columns) => {
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
    ${primaryStageMarkup(object, semanticLeadMarkup(model, "confusion"), "analysis-v2-semantic-primary")}
    ${selectedKey === null ? "" : `<aside class="analysis-v2-inspector" aria-live="polite">${confusionDetailMarkup(model, selectedKey)}</aside>`}
  </div>`;
}

function semanticMarkup(
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
    ${methodDetailsMarkup(
      "資料規則",
      preferences.semanticView === "correctness"
        ? "錯誤觀察比例只來自能確定原本應按哪個鍵的觀察；樣本不足時不做高低判讀。時間描述前一個已接受事件到目前按鍵，不是能力分數。"
        : "只顯示實際觀察到，而且能確定原本應按哪個鍵的誤按方向；資料足夠後才做高低判讀。",
    )}
  </section>`;
}

function speedKeyboardMarkup(): string {
  return `<div class="analysis-v2-keyboard analysis-v2-speed-keyboard" aria-hidden="true">${keyboardRowsMarkup((tokenId, _key, columns) => `<span class="analysis-v2-key mapped" style="--key-columns:${columns}" data-speed-token="${escapeHtml(tokenId)}"><strong>${escapeHtml(tokenLabel(tokenId))}</strong></span>`)}</div>`;
}

function speedLeadMarkup(
  cell: AnalysisV2MotorCell<ImmediateTokenAggregateScope> | undefined,
  displayCount: string,
): string {
  if (cell === undefined || cell.currentTimeToTypeMs === null) {
    return `<div class="analysis-v2-hero-readout analysis-v2-speed-readout"><strong>仍在累積</strong><small>單一轉換累積 5 個乾淨時間樣本後可比較</small><span>${escapeHtml(displayCount)} · 線粗代表樣本支持；紅線對應目前主讀值</span></div>`;
  }
  return `<div class="analysis-v2-hero-readout analysis-v2-speed-readout">
    <strong><b>${escapeHtml(tokenLabel(cell.scope.fromToken))} → ${escapeHtml(tokenLabel(cell.scope.toToken))}</b><em>${escapeHtml(milliseconds(cell.currentTimeToTypeMs))}</em></strong>
    <small>${cell.timingSamples} 個乾淨樣本 · 僅在畫面中的同類實際鍵間轉換中比較</small>
    <span>${escapeHtml(displayCount)} · 線粗代表樣本支持；紅線對應目前主讀值</span>
  </div>`;
}

function familyStatus<Scope>(cells: readonly AnalysisV2MotorCell<Scope>[]): string {
  const observed = cells.filter((cell) => cell.observations > 0).length;
  const ready = cells.filter((cell) => cell.ready).length;
  if (observed === 0) return "尚無資料";
  if (ready === 0) return "樣本中";
  if (ready === observed) return "可比較";
  return `${ready} 可比較 · ${observed - ready} 樣本中`;
}

function movementStatMarkup<Scope>(
  label: string,
  cell: AnalysisV2MotorCell<Scope> | undefined,
): string {
  if (cell === undefined || cell.observations === 0) {
    return `<div class="analysis-v2-movement-stat empty"><span>${escapeHtml(label)}</span><span class="analysis-v2-motor-sparkline-empty" aria-hidden="true">—</span><strong>—</strong></div>`;
  }
  const value = milliseconds(cell.currentTimeToTypeMs);
  const support = `${cell.timingSamples} 個乾淨樣本，${cell.observations} 次觀察`;
  return `<div class="analysis-v2-movement-stat${cell.ready ? "" : " sampling"}" aria-label="${escapeHtml(label)}，${escapeHtml(value)}，${escapeHtml(support)}"><span>${escapeHtml(label)}</span>${motorTrendMarkup(cell)}<strong>${escapeHtml(value)}</strong>${cell.ready ? "" : "<small>樣本中</small>"}</div>`;
}

function sortedMovementRows<Scope>(
  rows: readonly { readonly label: string; readonly cell: AnalysisV2MotorCell<Scope> | undefined }[],
): readonly { readonly label: string; readonly cell: AnalysisV2MotorCell<Scope> | undefined }[] {
  return [...rows].sort((left, right) => {
    const leftMs = left.cell?.currentTimeToTypeMs ?? -1;
    const rightMs = right.cell?.currentTimeToTypeMs ?? -1;
    if (leftMs !== rightMs) return rightMs - leftMs;
    return left.label.localeCompare(right.label, "zh-Hant");
  });
}

function movementFamilyMarkup(
  title: string,
  status: string,
  note: string,
  diagram: string,
  stats: readonly string[],
): string {
  return `<section class="analysis-v2-movement-family">
    <header><strong>${escapeHtml(title)}</strong><small>${escapeHtml(status)}</small></header>
    ${diagram}
    ${stats.length === 0 ? "" : `<div class="analysis-v2-movement-stats">${stats.join("")}</div>`}
    <p>${escapeHtml(note)}</p>
  </section>`;
}

function simpleMovementDiagram(label: string): string {
  return `<div class="analysis-v2-movement-diagram" aria-hidden="true"><div class="analysis-v2-movement-diagram-line">${label}</div></div>`;
}

function revisitMovementDiagram(): string {
  return `<div class="analysis-v2-movement-diagram" aria-label="同側再次出現；中間可能連續，也可能穿插另一側">
    <div class="analysis-v2-movement-diagram-line"><span>同側</span><i>→</i><span>同側</span></div>
    <div class="analysis-v2-movement-diagram-line"><span>同側</span><i>→</i><span>另一側</span><i>→</i><span>同側</span></div>
  </div>`;
}

function wordStructureDiagram(): string {
  return `<div class="analysis-v2-movement-diagram analysis-v2-word-structure" aria-label="字內結構示意：聲母、介音、韻母；例：家，ㄐㄧㄚ">
    <div class="analysis-v2-word-structure-labels"><span>聲母</span><span>介音</span><span>韻母</span></div>
    <div class="analysis-v2-word-structure-example"><span>ㄐ</span><span>ㄧ</span><span>ㄚ</span></div>
    <small>例：家</small>
  </div>`;
}

function bodyShapeLabel(shape: AnalysisV2Model["coordination"]["coordination"][number]["scope"]["bodyShape"]): string {
  if (shape === "initial-medial-final") return "聲母＋介音＋韻母";
  if (shape === "initial-medial") return "聲母＋介音";
  if (shape === "initial-final") return "聲母＋韻母";
  return "介音＋韻母";
}

function findImmediate(
  model: AnalysisV2Model,
  fromHand: "left" | "right",
  toHand: "left" | "right",
): AnalysisV2MotorCell<ImmediateHandAggregateScope> | undefined {
  return model.coordination.immediateHands.find(
    (cell) => cell.scope.fromHand === fromHand && cell.scope.toHand === toHand,
  );
}

function revisitLabel(cell: AnalysisV2MotorCell<SameHandRevisitAggregateScope>): string {
  const hand = cell.scope.hand === "left" ? "左" : "右";
  if (!cell.scope.oppositeHandIntervened) return `${hand} · 連續`;
  return `${hand} · 隔${cell.scope.hand === "left" ? "右" : "左"}側`;
}

function movementFamiliesMarkup(model: AnalysisV2Model): string {
  const handStats = sortedMovementRows([
    { label: "左 → 左", cell: findImmediate(model, "left", "left") },
    { label: "左 → 右", cell: findImmediate(model, "left", "right") },
    { label: "右 → 左", cell: findImmediate(model, "right", "left") },
    { label: "右 → 右", cell: findImmediate(model, "right", "right") },
  ]).map(({ label, cell }) => movementStatMarkup(label, cell));

  const observedRevisits = model.coordination.sameHandRevisits.filter((cell) => cell.observations > 0);
  const revisitRows = sortedMovementRows(
    observedRevisits.map((cell) => ({ label: revisitLabel(cell), cell })),
  );
  const revisitStats = revisitRows.length === 0
    ? ['<div class="analysis-v2-movement-empty">尚無字內同側再出手資料</div>']
    : revisitRows.map(({ label, cell }) => movementStatMarkup(label, cell));

  const observedStructures = model.coordination.coordination.filter((cell) => cell.observations > 0);
  const structureRows = sortedMovementRows(
    observedStructures.map((cell) => ({ label: bodyShapeLabel(cell.scope.bodyShape), cell })),
  );
  const structureStats = structureRows.length === 0
    ? ['<div class="analysis-v2-movement-empty">尚無字內結構時間資料</div>']
    : structureRows.map(({ label, cell }) => movementStatMarkup(label, cell));

  const toneCells = [...model.coordination.toneCommits]
    .filter((cell) => cell.observations > 0)
    .sort((left, right) => (right.currentTimeToTypeMs ?? -1) - (left.currentTimeToTypeMs ?? -1)
      || left.scope.toneToken.localeCompare(right.scope.toneToken));
  const toneStats = toneCells.length === 0
    ? ['<div class="analysis-v2-movement-empty">尚無聲調完成資料</div>']
    : toneCells.map((cell) => movementStatMarkup(tokenLabel(cell.scope.toneToken), cell));

  return `<section class="analysis-v2-movement-view" aria-label="動作觀察">
    <div class="analysis-v2-movement-intro"><strong>動作觀察</strong><span>diagram 先說明動作；折線只看近期變化，毫秒與排列只在同一家族內比較。</span></div>
    <div class="analysis-v2-movement-grid">
      ${movementFamilyMarkup(
        "手別轉換",
        familyStatus(model.coordination.immediateHands),
        "依標準指法鍵位分側，不代表偵測到實際使用哪隻手；有資料時依目前代表時間由慢到快排列。",
        simpleMovementDiagram('<span>左</span><i>⇄</i><span>右</span>'),
        handStats,
      )}
      ${movementFamilyMarkup(
        "同側再出手",
        familyStatus(observedRevisits),
        "只比較同一個字內的注音成分；聲調與跨字事件不列入。有資料時依目前代表時間由慢到快排列。",
        revisitMovementDiagram(),
        revisitStats,
      )}
      ${movementFamilyMarkup(
        "字內結構",
        familyStatus(observedStructures),
        "以聲母、介音、韻母的結構組合比較字內注音完成時間；依目前代表時間由慢到快排列。",
        wordStructureDiagram(),
        structureStats,
      )}
      ${movementFamilyMarkup(
        "聲調收尾",
        familyStatus(model.coordination.toneCommits),
        "最後一個字內注音到聲調鍵的乾淨時間；有資料時依目前代表時間由慢到快排列。",
        simpleMovementDiagram('<span>字內注音</span><i>→</i><span>聲調</span>'),
        toneStats,
      )}
    </div>
    ${methodDetailsMarkup("資料規則", "折線只表示各家族自己的近期變化；毫秒與排序只在同一家族內比較。字內結構按聲母、介音、韻母組合聚合；同側再出手只看同一字內的注音成分，不含聲調或跨字事件。")}
  </section>`;
}

function speedNetworkMarkup(
  model: AnalysisV2Model,
  selectedPathId: string | null,
): string {
  const readyCells = model.coordination.immediateTokens.filter((cell) => cell.ready);
  const paths = buildAnalysisV2SpeedPaths(model.coordination.immediateTokens);
  const cellById = new Map(model.coordination.immediateTokens.map((cell) => [cell.id, cell]));
  const salientIds = new Set(paths
    .map((path) => ({ path, cell: cellById.get(path.id) }))
    .sort((left, right) => (right.cell?.timingSamples ?? 0) - (left.cell?.timingSamples ?? 0)
      || (right.cell?.observations ?? 0) - (left.cell?.observations ?? 0)
      || left.path.id.localeCompare(right.path.id))
    .slice(0, SPEED_SALIENT_EDGE_COUNT)
    .map(({ path }) => path.id));
  const slowIds = new Set(paths.slice(-SPEED_SLOW_EDGE_COUNT).map((path) => path.id));
  const selectedCell = selectedPathId === null ? undefined : cellById.get(selectedPathId);
  const slowestVisibleCell = paths.length === 0 ? undefined : cellById.get(paths[paths.length - 1]!.id);
  const leadCell = selectedCell ?? slowestVisibleCell;
  const accentId = selectedCell?.id ?? slowestVisibleCell?.id ?? null;
  const allSamples = model.coordination.immediateTokens.reduce(
    (sum, cell) => sum + cell.timingSamples,
    0,
  );
  const displayCount = readyCells.length > ANALYSIS_V2_SPEED_MAX_VISIBLE_EDGES
    ? `${paths.length} / ${readyCells.length} 條可比較`
    : `${readyCells.length} 條可比較`;
  const viewBox = ANALYSIS_V2_SPEED_VIEWBOX;
  const board = `<div class="analysis-v2-speed-scroll" tabindex="0" aria-label="鍵間軌跡"><div class="analysis-v2-speed-board">
    ${speedKeyboardMarkup()}
    ${paths.length === 0
      ? `<div class="analysis-v2-speed-empty">目前有 ${allSamples} 個鍵間乾淨樣本，但還沒有單一轉換累積到 5 個。</div>`
      : `<svg class="analysis-v2-speed-svg" viewBox="${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}" preserveAspectRatio="none" role="group" aria-label="可比較的實際鍵間軌跡">${paths.map((path) => {
        const cell = cellById.get(path.id);
        if (cell === undefined) return "";
        const selected = selectedPathId === path.id;
        const interaction = `data-action="select-speed" data-speed-id="${escapeHtml(path.id)}" data-from-token="${escapeHtml(cell.scope.fromToken)}" data-to-token="${escapeHtml(cell.scope.toToken)}"`;
        return `<path class="analysis-v2-speed-hit" d="${path.path}" ${interaction} aria-hidden="true"></path><path class="analysis-v2-speed-path${path.includesTone ? " tone" : ""}${salientIds.has(path.id) ? " salient" : ""}${slowIds.has(path.id) ? " is-slow" : ""}${accentId === path.id ? " is-accent" : ""}${selected ? " selected" : ""}" d="${path.path}" style="--relation-width:${path.width};--relation-opacity:${path.opacity};--relation-slowness:${path.slowness}" ${interaction} tabindex="0" role="button" aria-pressed="${selected}" aria-label="${escapeHtml(path.label)}"><title>${escapeHtml(path.label)}</title></path>`;
      }).join("")}</svg>`}
  </div></div>`;
  const primary = primaryStageMarkup(board, speedLeadMarkup(leadCell, displayCount), "analysis-v2-speed-primary");
  return `<section class="analysis-v2-speed-field" aria-label="鍵間軌跡">
    <div class="analysis-v2-speed-stage${selectedCell === undefined ? "" : " has-selection"}">${primary}</div>
    ${methodDetailsMarkup("資料規則", `只畫同一字內實際相鄰接受且乾淨的轉換，每一條至少 5 個時間樣本。最多顯示支持度較高的 ${ANALYSIS_V2_SPEED_MAX_VISIBLE_EDGES} 條；紅線只連結目前主讀值，不代表錯誤。`)}
  </section>`;
}

function coordinationMarkup(
  model: AnalysisV2Model,
  selectedPathId: string | null,
  view: CoordinationView,
): string {
  return `<section class="analysis-v2-domain analysis-v2-coordination-domain" aria-labelledby="analysis-v2-tab-coordination">
    <div class="analysis-v2-domain-controls"><div class="analysis-v2-segments" role="group" aria-label="協調觀察方式">
      <button type="button" data-action="coordination-view" data-value="paths" aria-pressed="${view === "paths"}">鍵間</button>
      <button type="button" data-action="coordination-view" data-value="movement" aria-pressed="${view === "movement"}">動作</button>
    </div></div>
    ${view === "paths" ? speedNetworkMarkup(model, selectedPathId) : movementFamiliesMarkup(model)}
  </section>`;
}

function positionLabel(position: InputOrderPositionAggregateScope["canonicalPosition"]): string {
  return position === "first" ? "前" : position === "last" ? "後" : "中";
}

function positionsForBodySize(
  bodySize: CoordinationBodySizeBucket,
): readonly InputOrderPositionAggregateScope["canonicalPosition"][] {
  return bodySize === "2" ? ["first", "last"] : POSITIONS;
}

function positionCount(
  model: AnalysisV2Model,
  bodySize: CoordinationBodySizeBucket,
  canonical: InputOrderPositionAggregateScope["canonicalPosition"],
  accepted: InputOrderPositionAggregateScope["acceptedPosition"],
): number {
  return model.strategy.inputOrderPositions.find(
    (row) => row.scope.bodySize === bodySize
      && row.scope.canonicalPosition === canonical
      && row.scope.acceptedPosition === accepted,
  )?.observations ?? 0;
}

function strategyFieldMarkup(model: AnalysisV2Model, bodySize: CoordinationBodySizeBucket): string {
  const positions = positionsForBodySize(bodySize);
  const rows = positions.map((canonical) => {
    const values = positions.map((accepted) => positionCount(model, bodySize, canonical, accepted));
    return { canonical, values, total: values.reduce((sum, value) => sum + value, 0) };
  });
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  const supportedRows = rows.filter((row) => row.total >= STRATEGY_LEAD_MIN_ROW_OBSERVATIONS);
  const deviations = supportedRows.flatMap((row) => positions.flatMap((accepted, index) => {
    const count = row.values[index] ?? 0;
    if (accepted === row.canonical || count === 0) return [];
    return [{
      canonical: row.canonical,
      accepted,
      count,
      ratio: count / row.total,
      rowTotal: row.total,
    }];
  })).sort((left, right) => right.ratio - left.ratio
    || right.count - left.count
    || positionLabel(left.canonical).localeCompare(positionLabel(right.canonical)));
  const lead = deviations[0];
  const leadMarkup = supportedRows.length === 0
    ? `<div class="analysis-v2-hero-readout analysis-v2-strategy-readout"><strong>仍在累積</strong><small>單一結構位置累積 ${STRATEGY_LEAD_MIN_ROW_OBSERVATIONS} 個觀察後才提升偏移</small></div>`
    : lead === undefined
      ? `<div class="analysis-v2-hero-readout analysis-v2-strategy-readout"><strong>目前以原位置完成</strong><small>${bodySize} 個注音 · ${total} 個位置觀察</small></div>`
      : `<div class="analysis-v2-hero-readout analysis-v2-strategy-readout"><strong><b>${positionLabel(lead.canonical)} → ${positionLabel(lead.accepted)}</b><em>${Math.round(lead.ratio * 100)}%</em></strong><small>${lead.count} / ${lead.rowTotal} 個同位置觀察</small></div>`;
  const object = `<div class="analysis-v2-strategy-object"><div class="analysis-v2-strategy-axis"><span>結構位置</span><i aria-hidden="true">→</i><span>實際完成位置</span></div><div class="analysis-v2-strategy-field"><table class="analysis-v2-matrix strategy-matrix"><caption class="analysis-v2-visually-hidden">列是結構位置，欄是實際被接受的位置。</caption><thead><tr><th scope="col">位置</th>${positions.map((position) => `<th scope="col">${positionLabel(position)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr><th scope="row">${positionLabel(row.canonical)}</th>${row.values.map((count) => {
    const ratio = row.total === 0 ? 0 : count / row.total;
    return `<td style="--analysis-strength:${ratio}"><strong>${count === 0 ? "·" : count}</strong><small>${row.total === 0 ? "" : `${Math.round(ratio * 100)}%`}</small></td>`;
  }).join("")}</tr>`).join("")}</tbody></table></div></div>`;
  return `${primaryStageMarkup(object, leadMarkup, "analysis-v2-strategy-stage")}<p class="analysis-v2-strategy-total">${bodySize} 個注音 · ${total} 個位置觀察</p>`;
}

function strategyMarkup(model: AnalysisV2Model, bodySize: CoordinationBodySizeBucket): string {
  return `<section class="analysis-v2-domain analysis-v2-strategy-domain" aria-labelledby="analysis-v2-tab-strategy">
    <div class="analysis-v2-domain-controls"><div class="analysis-v2-segments analysis-v2-strategy-segments" role="group" aria-label="字內注音成分數，不含聲調">${BODY_SIZES.map((size) => `<button type="button" data-action="strategy-size" data-value="${size}" aria-pressed="${bodySize === size}" title="這個字有 ${size} 個注音，不含聲調">${size} 個注音</button>`).join("")}</div></div>
    ${strategyFieldMarkup(model, bodySize)}
    ${methodDetailsMarkup("資料規則", `只有 2、3 個注音的字有輸入順序可以比較；1 個注音沒有順序差異。結構位置只是一組參考座標，不要求固定輸入順序；單一位置至少累積 ${STRATEGY_LEAD_MIN_ROW_OBSERVATIONS} 個觀察才提升偏移。`)}
  </section>`;
}

function bodyMarkup(
  model: AnalysisV2Model,
  tab: AnalysisV2Tab,
  preferences: AnalysisV2Preferences,
  selectedKey: TokenId | null,
  selectedPathId: string | null,
  strategyBodySize: CoordinationBodySizeBucket,
  coordinationView: CoordinationView,
): string {
  if (tab === "coordination") return coordinationMarkup(model, selectedPathId, coordinationView);
  if (tab === "strategy") return strategyMarkup(model, strategyBodySize);
  return semanticMarkup(model, preferences, selectedKey);
}

export function renderAnalysisV2Summary(
  section: HTMLElement,
  model: AnalysisV2Model,
  openAnalysis: () => void,
): void {
  section.className = "panel-section analysis-v2-summary";
  section.removeAttribute("data-analysis-v2-summary-slot");
  section.innerHTML = `<div class="analysis-v2-summary-heading"><div><h3>分析</h3><p>${model.semantic.keysWithData} 鍵有語意資料 · ${model.coordination.readyScopes} 類協調觀察可比較 · ${model.strategy.totalObservations} 個順序位置觀察</p></div><button type="button" class="analysis-v2-open">進入分析</button></div><div class="analysis-v2-summary-signals" aria-label="分析摘要"><div><span>語意</span><strong>${model.semantic.keysWithData} 鍵</strong><small>${model.semantic.repeatedConfusions} 組重複誤按</small></div><div><span>協調</span><strong>${model.coordination.readyScopes} 類</strong><small>${model.coordination.cleanTimingSamples} 個乾淨樣本</small></div><div><span>策略</span><strong>${model.strategy.totalObservations}</strong><small>${model.strategy.bodySizeBucketsWithData} 種注音數有資料</small></div></div>`;
  section.querySelector<HTMLButtonElement>(".analysis-v2-open")
    ?.addEventListener("click", openAnalysis);
}

export function createAnalysisV2(options: AnalysisV2Options): AnalysisV2Controller {
  const host = document.createElement("section");
  host.id = "analysis-v2";
  host.className = "analysis-v2";
  host.hidden = true;
  host.setAttribute("role", "dialog");
  host.setAttribute("aria-modal", "true");
  host.setAttribute("aria-labelledby", "analysis-v2-title");
  document.body.append(host);

  let model = options.getModel();
  let preferences = loadPreferences(options.storage);
  let selectedKey: TokenId | null = null;
  let selectedSpeedPathId: string | null = null;
  let strategyBodySize: CoordinationBodySizeBucket = "3";
  let coordinationView: CoordinationView = "paths";
  let openFrame: number | null = null;
  const persist = () => savePreferences(options.storage, preferences);

  const cancelOpenFrame = (): void => {
    if (openFrame === null) return;
    window.cancelAnimationFrame(openFrame);
    openFrame = null;
  };

  const focusSemanticView = (value: SemanticView): void => {
    host.querySelector<HTMLButtonElement>(
      `[data-action="semantic-view"][data-value="${value}"]`,
    )?.focus();
  };

  const focusCoordinationView = (value: CoordinationView): void => {
    host.querySelector<HTMLButtonElement>(
      `[data-action="coordination-view"][data-value="${value}"]`,
    )?.focus();
  };

  const focusSemanticKey = (token: TokenId): void => {
    [...host.querySelectorAll<HTMLButtonElement>('[data-action="select-key"]')]
      .find((button) => button.dataset.token === token)
      ?.focus();
  };

  const focusSpeedPath = (pathId: string): void => {
    [...host.querySelectorAll<SVGPathElement>(".analysis-v2-speed-path")]
      .find((path) => path.dataset.speedId === pathId)
      ?.focus();
  };

  const applySpeedFocus = (pathId: string | null): void => {
    const paths = [...host.querySelectorAll<SVGPathElement>(".analysis-v2-speed-path")];
    const focused = pathId === null
      ? null
      : paths.find((path) => path.dataset.speedId === pathId) ?? null;
    for (const path of paths) {
      path.classList.toggle("is-focused", focused !== null && path === focused);
      path.classList.toggle("is-muted", focused !== null && path !== focused);
    }
    const relatedTokens = new Set<string>();
    if (focused !== null) {
      if (focused.dataset.fromToken !== undefined) relatedTokens.add(focused.dataset.fromToken);
      if (focused.dataset.toToken !== undefined) relatedTokens.add(focused.dataset.toToken);
    }
    for (const key of host.querySelectorAll<HTMLElement>("[data-speed-token]")) {
      key.classList.toggle("is-related", relatedTokens.has(key.dataset.speedToken ?? ""));
    }
  };

  const render = (preserveScroll = true): void => {
    const previousMain = host.querySelector<HTMLElement>(".analysis-v2-main");
    const scrollTop = preserveScroll ? previousMain?.scrollTop ?? 0 : 0;
    const scrollLeft = preserveScroll ? previousMain?.scrollLeft ?? 0 : 0;
    const activeTab = preferences.activeTab;
    host.innerHTML = `<div class="analysis-v2-shell"><header class="analysis-v2-header"><div><h2 id="analysis-v2-title">分析</h2></div><div class="analysis-v2-header-actions"><div class="analysis-v2-tabs" role="tablist" aria-label="分析類型">${TABS.map((tab) => `<button id="${tabId(tab)}" type="button" role="tab" data-action="select-tab" data-tab="${tab}" aria-controls="${tabPanelId(tab)}" aria-selected="${activeTab === tab}" tabindex="${activeTab === tab ? 0 : -1}">${tabLabel(tab)}</button>`).join("")}</div><button type="button" class="analysis-v2-close" data-action="close-analysis" aria-label="Esc，返回練習">Esc</button></div></header><main class="analysis-v2-main">${TABS.map((tab) => `<section id="${tabPanelId(tab)}" role="tabpanel" aria-labelledby="${tabId(tab)}"${activeTab === tab ? "" : " hidden"}>${activeTab === tab ? bodyMarkup(model, tab, preferences, selectedKey, selectedSpeedPathId, strategyBodySize, coordinationView) : ""}</section>`).join("")}</main></div>`;
    const nextMain = host.querySelector<HTMLElement>(".analysis-v2-main");
    if (nextMain !== null) {
      nextMain.scrollTop = scrollTop;
      nextMain.scrollLeft = scrollLeft;
    }
    applySpeedFocus(selectedSpeedPathId);
  };

  const selectTab = (tab: AnalysisV2Tab, focus = true): void => {
    preferences = { ...preferences, activeTab: tab };
    selectedKey = null;
    selectedSpeedPathId = null;
    if (tab === "coordination") coordinationView = "paths";
    persist();
    render(false);
    if (focus) {
      host.querySelector<HTMLButtonElement>(
        `[data-action="select-tab"][data-tab="${tab}"]`,
      )?.focus();
    }
  };

  const close = (): void => {
    cancelOpenFrame();
    host.hidden = true;
    host.classList.remove("open");
    options.onClose?.();
  };

  const open = (initialTab?: AnalysisV2Tab): void => {
    cancelOpenFrame();
    model = options.getModel();
    const loaded = loadPreferences(options.storage);
    preferences = {
      ...loaded,
      activeTab: initialTab ?? "coordination",
    };
    selectedKey = null;
    selectedSpeedPathId = null;
    coordinationView = "paths";
    host.hidden = false;
    render(false);
    openFrame = window.requestAnimationFrame(() => {
      openFrame = null;
      if (host.hidden) return;
      host.classList.add("open");
      host.querySelector<HTMLButtonElement>(".analysis-v2-close")?.focus();
    });
  };

  host.onclick = (event) => {
    const target = event.target instanceof Element
      ? event.target.closest<HTMLElement | SVGElement>("[data-action]")
      : null;
    if (target === null) return;
    if (target.dataset.action === "close-analysis") return close();
    if (target.dataset.action === "select-tab") {
      const tab = target.dataset.tab;
      if (isTab(tab)) selectTab(tab);
      return;
    }
    if (target.dataset.action === "semantic-view") {
      const value = target.dataset.value;
      if (isSemanticView(value)) {
        preferences = { ...preferences, semanticView: value };
        selectedKey = null;
        persist();
        render();
        focusSemanticView(value);
      }
      return;
    }
    if (target.dataset.action === "coordination-view") {
      const value = target.dataset.value;
      if (isCoordinationView(value)) {
        coordinationView = value;
        selectedSpeedPathId = null;
        render(false);
        focusCoordinationView(value);
      }
      return;
    }
    if (target.dataset.action === "select-key") {
      const token = target.dataset.token;
      if (token !== undefined) {
        selectedKey = selectedKey === token ? null : token;
        render();
        focusSemanticKey(token);
      }
      return;
    }
    if (target.dataset.action === "select-speed") {
      const pathId = target.dataset.speedId;
      if (pathId !== undefined) {
        selectedSpeedPathId = selectedSpeedPathId === pathId ? null : pathId;
        render();
        focusSpeedPath(pathId);
      }
      return;
    }
    if (target.dataset.action === "strategy-size") {
      const value = target.dataset.value;
      if (isBodySize(value)) {
        strategyBodySize = value;
        render(false);
        host.querySelector<HTMLButtonElement>(`[data-action="strategy-size"][data-value="${value}"]`)?.focus();
      }
    }
  };

  host.onpointerover = (event) => {
    if (!(event.target instanceof Element)) return;
    const path = event.target.closest<SVGPathElement>(
      ".analysis-v2-speed-path, .analysis-v2-speed-hit",
    );
    if (path !== null) applySpeedFocus(path.dataset.speedId ?? null);
  };

  host.onpointerout = (event) => {
    if (!(event.target instanceof Element)) return;
    if (event.target.closest(".analysis-v2-speed-path, .analysis-v2-speed-hit") !== null) {
      applySpeedFocus(selectedSpeedPathId);
    }
  };

  host.onkeydown = (event) => {
    if (event.target instanceof SVGElement
      && event.target.dataset.action === "select-speed"
      && (event.key === "Enter" || event.key === " ")) {
      event.preventDefault();
      event.target.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      return;
    }
    if (!(event.target instanceof HTMLButtonElement)
      || event.target.getAttribute("role") !== "tab") return;
    const tab = event.target.dataset.tab;
    if (!isTab(tab)) return;
    const current = TABS.indexOf(tab);
    let next: number | null = null;
    if (event.key === "ArrowRight") next = (current + 1) % TABS.length;
    if (event.key === "ArrowLeft") next = (current - 1 + TABS.length) % TABS.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = TABS.length - 1;
    if (next !== null) {
      event.preventDefault();
      selectTab(TABS[next]!);
    }
  };

  const interceptEscape = (event: KeyboardEvent): void => {
    if (!host.hidden && event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
    }
  };
  window.addEventListener("keydown", interceptEscape, { capture: true });

  return {
    host,
    open,
    close,
    destroy(): void {
      cancelOpenFrame();
      window.removeEventListener("keydown", interceptEscape, { capture: true });
      host.remove();
    },
  };
}
