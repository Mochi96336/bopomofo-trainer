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
} from "../diagnostics/types.js";
import type {
  CoordinationAggregateScope,
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
import {
  ANALYSIS_V2_SPEED_MAX_VISIBLE_EDGES,
  ANALYSIS_V2_SPEED_VIEWBOX,
  buildAnalysisV2SpeedPaths,
} from "./analysis-v2-speed-network.js";

export type AnalysisV2Tab = "semantic" | "coordination" | "strategy";
type SemanticView = "correctness" | "confusion";

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
const TABS: readonly AnalysisV2Tab[] = ["semantic", "coordination", "strategy"];
const DEFAULT_PREFERENCES: AnalysisV2Preferences = {
  activeTab: "semantic",
  semanticView: "correctness",
};
const BODY_SIZES: readonly CoordinationBodySizeBucket[] = ["2", "3", "4+"];
const POSITIONS = ["first", "middle", "last"] as const;
const SEMANTIC_SALIENT_KEY_COUNT = 4;
const SEMANTIC_LEAD_KEY_COUNT = 3;
const SPEED_SALIENT_EDGE_COUNT = 16;
const SPEED_ACCENT_EDGE_COUNT = 3;
const STRATEGY_LEAD_MIN_ROW_OBSERVATIONS = 8;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isTab(value: unknown): value is AnalysisV2Tab {
  return value === "semantic" || value === "coordination" || value === "strategy";
}

function isSemanticView(value: unknown): value is SemanticView {
  return value === "correctness" || value === "confusion";
}

function isBodySize(value: unknown): value is CoordinationBodySizeBucket {
  return value === "2" || value === "3" || value === "4+";
}

function loadPreferences(storage: AnalysisV2PreferenceStorage): AnalysisV2Preferences {
  try {
    const source = storage.getItem(PREFERENCES_KEY);
    if (source === null) return DEFAULT_PREFERENCES;
    const value = JSON.parse(source) as unknown;
    if (!isRecord(value) || !isTab(value.activeTab) || !isSemanticView(value.semanticView)) {
      return DEFAULT_PREFERENCES;
    }
    return { activeTab: value.activeTab, semanticView: value.semanticView };
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

function keyByToken(model: AnalysisV2Model): ReadonlyMap<TokenId, KeyDiagnostic> {
  return new Map(model.semantic.keys.map((row) => [row.tokenId, row]));
}

function timingEvidenceLabel(row: KeyDiagnostic): string {
  if (row.timingAvailability === "not-applicable") return "不適用";
  if (row.timingDataState === null) return `${row.timingSamples} 個乾淨樣本`;
  return `${dataStateLabel(row.timingDataState)} · ${row.timingSamples} 個乾淨樣本`;
}

function keyDetailMarkup(model: AnalysisV2Model, tokenId: TokenId | null): string {
  if (tokenId === null) return "";
  const row = model.semantic.keys.find((candidate) => candidate.tokenId === tokenId);
  if (row === undefined) return "";
  const progress = model.semantic.keyProgress[tokenId];
  const correctness = progress?.correctness.points
    .slice(-5)
    .map((point) => `${Math.round(point.value * 100)}%`) ?? [];
  const timing = progress?.timing.points
    .slice(-5)
    .map((point) => `${Math.round(point.value)} ms`) ?? [];
  return `<article class="analysis-v2-inspector-content">
    <div class="analysis-v2-detail-heading"><strong>${escapeHtml(row.symbol)}</strong><span>${escapeHtml(row.physicalKey)}</span></div>
    <dl>
      <div><dt>錯誤觀察</dt><dd>${escapeHtml(percent(row.displayedErrorRatio))}</dd></div>
      <div><dt>錯誤資料</dt><dd>${escapeHtml(dataStateLabel(row.errorDataState))} · ${row.attempts} 次</dd></div>
      <div><dt>有效鍵間時間</dt><dd>${escapeHtml(milliseconds(row.timingMs))}</dd></div>
      <div><dt>時間資料</dt><dd>${escapeHtml(timingEvidenceLabel(row))}</dd></div>
    </dl>
    <p>錯誤趨勢 ${correctness.length === 0 ? "—" : escapeHtml(correctness.join(" → "))}</p>
    <p>時間趨勢 ${timing.length === 0 ? "—" : escapeHtml(timing.join(" → "))}</p>
  </article>`;
}

function keyboardRowsMarkup(
  keyMarkup: (tokenId: TokenId, key: (typeof KEYBOARD_GEOMETRY_ROWS)[number][number], columns: number) => string,
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
      return `<div class="analysis-v2-hero-readout analysis-v2-semantic-readout"><span>按鍵觀察</span><strong>仍在累積</strong><small>資料充足後才標記少數值得注意的鍵</small></div>`;
    }
    const symbols = rows.slice(0, SEMANTIC_LEAD_KEY_COUNT).map((row) => escapeHtml(row.symbol)).join("　");
    return `<div class="analysis-v2-hero-readout analysis-v2-semantic-readout"><span>錯誤觀察較高的可比較按鍵</span><strong class="analysis-v2-semantic-symbols">${symbols}</strong><small>鍵盤只標記前 ${Math.min(SEMANTIC_SALIENT_KEY_COUNT, rows.length)} 個；其餘數值留在檢視欄</small></div>`;
  }
  const rows = rankedConfusionKeys(model);
  if (rows.length === 0) {
    return `<div class="analysis-v2-hero-readout analysis-v2-semantic-readout"><span>可歸因誤按</span><strong>仍在累積</strong><small>原意鍵累積足夠的可歸因誤按後才會被標記</small></div>`;
  }
  const symbols = rows.slice(0, SEMANTIC_LEAD_KEY_COUNT)
    .map((row) => escapeHtml(row.expectedSymbol))
    .join("　");
  return `<div class="analysis-v2-hero-readout analysis-v2-semantic-readout"><span>可歸因誤按較多的原意鍵</span><strong class="analysis-v2-semantic-symbols">${symbols}</strong><small>依每個原意鍵累積的可歸因誤按次數排序</small></div>`;
}

function correctnessKeyboardMarkup(model: AnalysisV2Model, selectedKey: TokenId | null): string {
  const byToken = keyByToken(model);
  const salientTokens = new Set(rankedSemanticKeys(model)
    .slice(0, SEMANTIC_SALIENT_KEY_COUNT)
    .map((row) => row.tokenId));
  const keyboard = keyboardRowsMarkup((tokenId, key, columns) => {
    const diagnostic = byToken.get(tokenId);
    const state = diagnostic?.errorDataState ?? "insufficient";
    const selected = selectedKey === tokenId;
    const salient = salientTokens.has(tokenId);
    return `<button type="button" class="analysis-v2-key ${state}${salient ? " is-salient" : ""}${selected ? " selected" : ""}" style="--key-columns:${columns}" data-action="select-key" data-token="${escapeHtml(tokenId)}" aria-pressed="${selected}" aria-label="${escapeHtml(tokenLabel(tokenId))}，實體鍵 ${escapeHtml(physicalKeyLabel(key.code))}，錯誤觀察比例 ${escapeHtml(percent(diagnostic?.displayedErrorRatio ?? null))}，${escapeHtml(dataStateLabel(state))}，${diagnostic?.attempts ?? 0} 次觀察"><strong>${escapeHtml(tokenLabel(tokenId))}</strong><small aria-hidden="true"></small></button>`;
  });
  return `<div class="analysis-v2-semantic-stage${selectedKey === null ? "" : " has-selection"}">
    <section class="analysis-v2-visual-stage" aria-label="按鍵錯誤觀察比例">
      ${semanticLeadMarkup(model, "correctness")}
      <div class="analysis-v2-keyboard">${keyboard}</div>
    </section>
    <aside class="analysis-v2-inspector" aria-live="polite">${keyDetailMarkup(model, selectedKey)}</aside>
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
      ? '<p class="analysis-v2-inspector-empty">目前沒有可歸因的誤按。</p>'
      : `<ol class="analysis-v2-confusion-list">${rows.map((row) => `<li><div><strong>${escapeHtml(row.actualSymbol)}</strong><span>${escapeHtml(row.actualPhysicalKey)}</span></div><div><b>${row.occurrences}</b><small>${escapeHtml(percent(row.expectedErrorShare))} · ${escapeHtml(dataStateLabel(row.dataState))}</small></div></li>`).join("")}</ol>`}
  </article>`;
}

function confusionKeyboardMarkup(model: AnalysisV2Model, selectedKey: TokenId | null): string {
  const strongestByToken = strongestConfusionsByToken(model);
  const salientTokens = new Set(rankedConfusionKeys(model)
    .slice(0, SEMANTIC_SALIENT_KEY_COUNT)
    .map((row) => row.expectedTokenId));
  const keyboard = keyboardRowsMarkup((tokenId, key, columns) => {
    const confusion = strongestByToken.get(tokenId);
    const state = confusionKeyDataState(confusion);
    const selected = selectedKey === tokenId;
    const salient = salientTokens.has(tokenId);
    return `<button type="button" class="analysis-v2-key ${state}${salient ? " is-salient" : ""}${selected ? " selected" : ""}" style="--key-columns:${columns}" data-action="select-key" data-token="${escapeHtml(tokenId)}" aria-pressed="${selected}" aria-label="${escapeHtml(tokenLabel(tokenId))}，實體鍵 ${escapeHtml(physicalKeyLabel(key.code))}，${confusion === undefined ? "尚無可歸因誤按" : `累積 ${confusion.expectedConfusionTotal} 次可歸因誤按，最常見去向 ${escapeHtml(confusion.actualSymbol)} ${confusion.occurrences} 次`}，${escapeHtml(dataStateLabel(state))}"><strong>${escapeHtml(tokenLabel(tokenId))}</strong><small aria-hidden="true"></small></button>`;
  });
  return `<div class="analysis-v2-semantic-stage${selectedKey === null ? "" : " has-selection"}">
    <section class="analysis-v2-visual-stage" aria-label="可歸因誤按鍵盤">
      ${semanticLeadMarkup(model, "confusion")}
      <div class="analysis-v2-keyboard">${keyboard}</div>
    </section>
    <aside class="analysis-v2-inspector" aria-live="polite">${confusionDetailMarkup(model, selectedKey)}</aside>
  </div>`;
}

function methodDetailsMarkup(summary: string, body: string): string {
  return `<details class="analysis-v2-method"><summary>${escapeHtml(summary)}</summary><p>${escapeHtml(body)}</p></details>`;
}

function semanticMarkup(
  model: AnalysisV2Model,
  preferences: AnalysisV2Preferences,
  selectedKey: TokenId | null,
): string {
  return `<section class="analysis-v2-domain analysis-v2-semantic-domain" aria-labelledby="analysis-v2-semantic-title">
    <div class="analysis-v2-domain-head"><div><h3 id="analysis-v2-semantic-title">語意</h3><p>${model.semantic.keysWithData} 個按鍵已有可用觀察</p></div>
      <div class="analysis-v2-segments" role="group" aria-label="語意分析視圖"><button type="button" data-action="semantic-view" data-value="correctness" aria-pressed="${preferences.semanticView === "correctness"}">按鍵</button><button type="button" data-action="semantic-view" data-value="confusion" aria-pressed="${preferences.semanticView === "confusion"}">誤按</button></div></div>
    ${preferences.semanticView === "correctness"
      ? correctnessKeyboardMarkup(model, selectedKey)
      : confusionKeyboardMarkup(model, selectedKey)}
    ${methodDetailsMarkup("資料規則", preferences.semanticView === "correctness"
      ? "少於 3 次觀察不發言，3–7 次只保留為初步資料，8 次以上才可能進入少數標記。標記只整理注意力，不把不同動作指標混成一個弱點分數。"
      : "只顯示實際觀察到而且能歸因的誤按方向；原意鍵的標記依累積可歸因誤按總數決定，單一去向占比只留在檢視欄，不拿來跨原意鍵排行。")}
  </section>`;
}

function speedKeyboardMarkup(): string {
  return `<div class="analysis-v2-keyboard analysis-v2-speed-keyboard" aria-hidden="true">${keyboardRowsMarkup((tokenId, _key, columns) => `<span class="analysis-v2-key mapped" style="--key-columns:${columns}" data-speed-token="${escapeHtml(tokenId)}"><strong>${escapeHtml(tokenLabel(tokenId))}</strong></span>`)}</div>`;
}

function speedInspectorMarkup(
  model: AnalysisV2Model,
  selectedPathId: string | null,
): string {
  if (selectedPathId === null) return "";
  const cell = model.coordination.immediateTokens.find((candidate) => candidate.id === selectedPathId);
  if (cell === undefined || cell.currentTimeToTypeMs === null) return "";
  return `<article class="analysis-v2-inspector-content analysis-v2-speed-detail">
    <div class="analysis-v2-speed-pair"><strong>${escapeHtml(tokenLabel(cell.scope.fromToken))}</strong><span>→</span><strong>${escapeHtml(tokenLabel(cell.scope.toToken))}</strong></div>
    <dl>
      <div><dt>鍵間時間</dt><dd>${escapeHtml(milliseconds(cell.currentTimeToTypeMs))}</dd></div>
      <div><dt>乾淨樣本</dt><dd>${cell.timingSamples}</dd></div>
      <div><dt>累積觀察</dt><dd>${cell.observations}</dd></div>
      <div><dt>資料狀態</dt><dd>${cell.ready ? "可比較" : "樣本中"}</dd></div>
    </dl>
    <p>這裡只描述同一類實際鍵間轉換，不和其他協調範圍混成一個分數。</p>
  </article>`;
}

function speedLeadMarkup(
  cell: AnalysisV2MotorCell<ImmediateTokenAggregateScope> | undefined,
  selected: boolean,
): string {
  if (cell === undefined || cell.currentTimeToTypeMs === null) {
    return `<div class="analysis-v2-hero-readout analysis-v2-speed-readout"><span>鍵間軌跡</span><strong>仍在累積</strong><small>單一轉換累積 5 個乾淨時間樣本後才可比較</small></div>`;
  }
  return `<div class="analysis-v2-hero-readout analysis-v2-speed-readout"><span>${selected ? "已固定的鍵間轉換" : "目前畫面中較慢的可比較轉換"}</span><strong><b>${escapeHtml(tokenLabel(cell.scope.fromToken))} → ${escapeHtml(tokenLabel(cell.scope.toToken))}</b><em>${escapeHtml(milliseconds(cell.currentTimeToTypeMs))}</em></strong><small>${cell.timingSamples} 個乾淨樣本 · 僅在畫面中的同類實際鍵間轉換中比較</small></div>`;
}

function speedNetworkMarkup(model: AnalysisV2Model, selectedPathId: string | null): string {
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
  const accentIds = new Set(paths.slice(-SPEED_ACCENT_EDGE_COUNT).map((path) => path.id));
  const selectedCell = selectedPathId === null ? undefined : cellById.get(selectedPathId);
  const slowestVisibleCell = paths.length === 0 ? undefined : cellById.get(paths[paths.length - 1]!.id);
  const leadCell = selectedCell ?? slowestVisibleCell;
  const allSamples = model.coordination.immediateTokens.reduce(
    (sum, cell) => sum + cell.timingSamples,
    0,
  );
  const readySamples = readyCells.reduce((sum, cell) => sum + cell.timingSamples, 0);
  const viewBox = ANALYSIS_V2_SPEED_VIEWBOX;
  const displayCount = readyCells.length > ANALYSIS_V2_SPEED_MAX_VISIBLE_EDGES
    ? `${paths.length} / ${readyCells.length} 條`
    : `${readyCells.length} 條`;
  return `<section class="analysis-v2-speed-field" aria-labelledby="analysis-v2-speed-title">
    <div class="analysis-v2-speed-meta"><div><span id="analysis-v2-speed-title">鍵間軌跡</span><strong>${displayCount}可比較</strong></div><small>${readySamples} 個乾淨樣本</small></div>
    ${speedLeadMarkup(leadCell, selectedCell !== undefined)}
    <div class="analysis-v2-speed-stage${selectedCell === undefined ? "" : " has-selection"}">
      <div class="analysis-v2-speed-scroll" tabindex="0" aria-label="鍵間軌跡，可水平捲動">
        <div class="analysis-v2-speed-board">
          ${speedKeyboardMarkup()}
          ${paths.length === 0
            ? `<div class="analysis-v2-speed-empty">目前有 ${allSamples} 個鍵間乾淨樣本，但還沒有任何單一轉換累積到 5 個。</div>`
            : `<svg class="analysis-v2-speed-svg" viewBox="${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}" preserveAspectRatio="none" role="group" aria-label="可比較的實際鍵間軌跡">${paths.map((path) => {
              const cell = cellById.get(path.id);
              if (cell === undefined) return "";
              const selected = selectedPathId === path.id;
              const interaction = `data-action="select-speed" data-speed-id="${escapeHtml(path.id)}" data-from-token="${escapeHtml(cell.scope.fromToken)}" data-to-token="${escapeHtml(cell.scope.toToken)}"`;
              return `<path class="analysis-v2-speed-hit" d="${path.path}" ${interaction} aria-hidden="true"></path><path class="analysis-v2-speed-path${path.includesTone ? " tone" : ""}${salientIds.has(path.id) ? " salient" : ""}${accentIds.has(path.id) ? " is-slow" : ""}${selected ? " selected" : ""}" d="${path.path}" style="--relation-width:${path.width};--relation-opacity:${path.opacity};--relation-slowness:${path.slowness}" ${interaction} tabindex="0" role="button" aria-pressed="${selected}" aria-label="${escapeHtml(path.label)}"><title>${escapeHtml(path.label)}</title></path>`;
            }).join("")}</svg>`}
        </div>
      </div>
      ${selectedCell === undefined ? "" : `<aside class="analysis-v2-speed-inspector analysis-v2-inspector" aria-live="polite">${speedInspectorMarkup(model, selectedPathId)}</aside>`}
    </div>
    <div class="analysis-v2-speed-legend" aria-label="軌跡圖例"><span>墨色是實際轉換；紅色只標較慢或選取</span><small>線粗代表樣本支持</small></div>
    ${methodDetailsMarkup("資料規則", `只畫同一音節內實際相鄰接受且乾淨的轉換，每一條至少 5 個時間樣本。不補 canonical 結構線；最多顯示支持度較高的 ${ANALYSIS_V2_SPEED_MAX_VISIBLE_EDGES} 條。畫面中的相對較慢只在目前可見的同類轉換內判讀；大多數軌跡使用既有墨階，紅色只保留給少數較慢轉換與目前互動焦點。`)}
  </section>`;
}

function trendText<Scope>(cell: AnalysisV2MotorCell<Scope> | undefined): string {
  if (cell === undefined || cell.history.length === 0) return "尚無歷史點";
  return cell.history
    .slice(-5)
    .map((point) => `${Math.round(point.representativeTimingMs)} ms`)
    .join(" → ");
}

function motorCellMarkup<Scope>(cell: AnalysisV2MotorCell<Scope> | undefined): string {
  if (cell === undefined) {
    return '<div class="analysis-v2-motor-cell empty"><strong>—</strong><small>尚無觀察</small></div>';
  }
  return `<div class="analysis-v2-motor-cell ${cell.ready ? "ready" : "sampling"}"><strong>${escapeHtml(milliseconds(cell.currentTimeToTypeMs))}</strong><small>${cell.timingSamples} 個乾淨樣本 · ${cell.observations} 次</small><span>${escapeHtml(trendText(cell))}</span></div>`;
}

function familyStatus<Scope>(cells: readonly AnalysisV2MotorCell<Scope>[]): string {
  const observed = cells.filter((cell) => cell.observations > 0).length;
  const ready = cells.filter((cell) => cell.ready).length;
  return observed === 0 ? "尚無資料" : `${ready} / ${observed} 可比較`;
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

function immediateHandEvidence(model: AnalysisV2Model): string {
  const hands = ["left", "right"] as const;
  const label = (hand: "left" | "right") => hand === "left" ? "左側" : "右側";
  return `<details class="analysis-v2-evidence-group"><summary><span>手別轉換</span><small>${familyStatus(model.coordination.immediateHands)}</small></summary><div class="analysis-v2-evidence-body"><p>依標準指法的鍵位分工推定，不代表偵測到你實際使用哪隻手。</p><div class="analysis-v2-table-scroll"><table class="analysis-v2-motor-table"><thead><tr><th>前一鍵 ↓ / 下一鍵 →</th>${hands.map((hand) => `<th>${label(hand)}</th>`).join("")}</tr></thead><tbody>${hands.map((from) => `<tr><th>${label(from)}</th>${hands.map((to) => `<td>${motorCellMarkup(findImmediate(model, from, to))}</td>`).join("")}</tr>`).join("")}</tbody></table></div></div></details>`;
}

function findCoordination(
  model: AnalysisV2Model,
  bodySize: CoordinationBodySizeBucket,
  handShape: CoordinationAggregateScope["handShape"],
): AnalysisV2MotorCell<CoordinationAggregateScope> | undefined {
  return model.coordination.coordination.find(
    (cell) => cell.scope.bodySize === bodySize && cell.scope.handShape === handShape,
  );
}

function coordinationEvidence(model: AnalysisV2Model): string {
  const shapes: readonly CoordinationAggregateScope["handShape"][] = [
    "left-only",
    "right-only",
    "mixed",
    "unknown",
  ];
  const labels: Record<CoordinationAggregateScope["handShape"], string> = {
    "left-only": "左側",
    "right-only": "右側",
    mixed: "跨側",
    unknown: "未知",
  };
  return `<details class="analysis-v2-evidence-group"><summary><span>音節跨度</span><small>${familyStatus(model.coordination.coordination)}</small></summary><div class="analysis-v2-evidence-body"><p>從第一個已接受的 body 成分到最後一個 body 成分；不同成分數分開看。</p><div class="analysis-v2-table-scroll"><table class="analysis-v2-motor-table wide"><thead><tr><th>body 成分</th>${shapes.map((shape) => `<th>${labels[shape]}</th>`).join("")}</tr></thead><tbody>${BODY_SIZES.map((size) => `<tr><th>${size}</th>${shapes.map((shape) => `<td>${motorCellMarkup(findCoordination(model, size, shape))}</td>`).join("")}</tr>`).join("")}</tbody></table></div></div></details>`;
}

function findRevisit(
  model: AnalysisV2Model,
  hand: "left" | "right",
  opposite: boolean,
): AnalysisV2MotorCell<SameHandRevisitAggregateScope> | undefined {
  return model.coordination.sameHandRevisits.find(
    (cell) => cell.scope.hand === hand && cell.scope.oppositeHandIntervened === opposite,
  );
}

function revisitEvidence(model: AnalysisV2Model): string {
  const hands = ["left", "right"] as const;
  return `<details class="analysis-v2-evidence-group"><summary><span>同側再出手</span><small>${familyStatus(model.coordination.sameHandRevisits)}</small></summary><div class="analysis-v2-evidence-body"><p>比較同一標準指法側再次出現時，中間是否曾出現另一側鍵位。</p><div class="analysis-v2-table-scroll"><table class="analysis-v2-motor-table"><thead><tr><th>鍵位側</th><th>連續同側</th><th>中間有另一側</th></tr></thead><tbody>${hands.map((hand) => `<tr><th>${hand === "left" ? "左側" : "右側"}</th><td>${motorCellMarkup(findRevisit(model, hand, false))}</td><td>${motorCellMarkup(findRevisit(model, hand, true))}</td></tr>`).join("")}</tbody></table></div></div></details>`;
}

function toneEvidence(model: AnalysisV2Model): string {
  const cells = [...model.coordination.toneCommits]
    .sort((a, b) => a.scope.toneToken.localeCompare(b.scope.toneToken));
  return `<details class="analysis-v2-evidence-group"><summary><span>聲調收尾</span><small>${familyStatus(cells)}</small></summary><div class="analysis-v2-evidence-body"><p>最後一個 body 成分到聲調鍵的乾淨時間，各聲調分開看。</p><div class="analysis-v2-tone-grid">${cells.length === 0 ? '<div class="analysis-v2-empty compact">尚無聲調完成資料。</div>' : cells.map((cell) => `<div class="analysis-v2-tone-cell"><b>${escapeHtml(tokenLabel(cell.scope.toneToken))}</b>${motorCellMarkup(cell)}</div>`).join("")}</div></div></details>`;
}

function coordinationMarkup(model: AnalysisV2Model, selectedPathId: string | null): string {
  return `<section class="analysis-v2-domain analysis-v2-coordination-domain" aria-labelledby="analysis-v2-coordination-title">
    <div class="analysis-v2-domain-head"><div><h3 id="analysis-v2-coordination-title">協調</h3><p>${model.coordination.readyTokenTransitions} 條實際鍵間轉換已有足夠樣本</p></div></div>
    ${speedNetworkMarkup(model, selectedPathId)}
    <div class="analysis-v2-evidence-rail" aria-label="其他協調觀察">${immediateHandEvidence(model)}${revisitEvidence(model)}${coordinationEvidence(model)}${toneEvidence(model)}</div>
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
    ? `<div class="analysis-v2-hero-readout analysis-v2-strategy-readout"><span>順序位置</span><strong>仍在累積</strong><small>單一結構位置累積 ${STRATEGY_LEAD_MIN_ROW_OBSERVATIONS} 個觀察後才提升偏移</small></div>`
    : lead === undefined
      ? `<div class="analysis-v2-hero-readout analysis-v2-strategy-readout"><span>順序位置</span><strong>目前以原位置完成</strong><small>${bodySize} 成分 · ${total} 個位置觀察</small></div>`
      : `<div class="analysis-v2-hero-readout analysis-v2-strategy-readout"><span>目前較常見的順序偏移</span><strong><b>${positionLabel(lead.canonical)} → ${positionLabel(lead.accepted)}</b><em>${Math.round(lead.ratio * 100)}%</em></strong><small>${lead.count} / ${lead.rowTotal} 個同位置觀察</small></div>`;
  return `<div class="analysis-v2-strategy-stage">
    ${leadMarkup}
    <div class="analysis-v2-strategy-axis"><span>結構位置</span><i aria-hidden="true">→</i><span>實際完成位置</span></div>
    <div class="analysis-v2-strategy-field"><table class="analysis-v2-matrix strategy-matrix"><caption class="analysis-v2-visually-hidden">列是結構位置，欄是實際被接受的位置。</caption><thead><tr><th scope="col">位置</th>${positions.map((position) => `<th scope="col">${positionLabel(position)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr><th scope="row">${positionLabel(row.canonical)}</th>${row.values.map((count) => {
      const ratio = row.total === 0 ? 0 : count / row.total;
      return `<td style="--analysis-strength:${ratio}"><strong>${count === 0 ? "·" : count}</strong><small>${row.total === 0 ? "" : `${Math.round(ratio * 100)}%`}</small></td>`;
    }).join("")}</tr>`).join("")}</tbody></table></div>
    <p class="analysis-v2-strategy-total">${bodySize} 成分 · ${total} 個位置觀察</p>
  </div>`;
}

function strategyMarkup(model: AnalysisV2Model, bodySize: CoordinationBodySizeBucket): string {
  return `<section class="analysis-v2-domain analysis-v2-strategy-domain" aria-labelledby="analysis-v2-strategy-title">
    <div class="analysis-v2-domain-head"><div><h3 id="analysis-v2-strategy-title">策略</h3><p>${model.strategy.totalObservations} 個完成位置觀察</p></div><div class="analysis-v2-segments analysis-v2-strategy-segments" role="group" aria-label="音節成分數">${BODY_SIZES.map((size) => `<button type="button" data-action="strategy-size" data-value="${size}" aria-pressed="${bodySize === size}">${size} 成分</button>`).join("")}</div></div>
    ${strategyFieldMarkup(model, bodySize)}
    ${methodDetailsMarkup("資料規則", `結構位置只是一組參考座標，不要求固定輸入順序。2 成分只有前／後；4+ 成分把內部位置合併成中間，讓長期資料保持 bounded。單一結構位置至少累積 ${STRATEGY_LEAD_MIN_ROW_OBSERVATIONS} 個觀察才會提升偏移為主讀值；系統不保存 raw trace，也不建立 token-pair 順序分數。`)}
  </section>`;
}

function bodyMarkup(
  model: AnalysisV2Model,
  tab: AnalysisV2Tab,
  preferences: AnalysisV2Preferences,
  selectedKey: TokenId | null,
  selectedPathId: string | null,
  strategyBodySize: CoordinationBodySizeBucket,
): string {
  if (tab === "coordination") return coordinationMarkup(model, selectedPathId);
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
  section.innerHTML = `<div class="analysis-v2-summary-heading"><div><h3>學習分析</h3><p>${model.semantic.keysWithData} 鍵有語意資料 · ${model.coordination.readyScopes} 類協調觀察已可比較 · ${model.strategy.totalObservations} 個順序位置觀察</p></div><button type="button" class="analysis-v2-open">進入分析</button></div><div class="analysis-v2-summary-signals" aria-label="學習分析摘要"><div><span>語意</span><strong>${model.semantic.keysWithData} 鍵</strong><small>${model.semantic.repeatedConfusions} 組重複誤按</small></div><div><span>協調</span><strong>${model.coordination.readyScopes} 類</strong><small>${model.coordination.cleanTimingSamples} 個乾淨樣本</small></div><div><span>策略</span><strong>${model.strategy.totalObservations}</strong><small>${model.strategy.bodySizeBucketsWithData} 種 body 尺度有資料</small></div></div>`;
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
    host.innerHTML = `<div class="analysis-v2-shell"><header class="analysis-v2-header"><div><p class="analysis-v2-kicker">Analysis V2</p><h2 id="analysis-v2-title">學習分析</h2></div><div class="analysis-v2-header-actions"><div class="analysis-v2-tabs" role="tablist" aria-label="分析類型">${TABS.map((tab) => `<button id="${tabId(tab)}" type="button" role="tab" data-action="select-tab" data-tab="${tab}" aria-controls="${tabPanelId(tab)}" aria-selected="${activeTab === tab}" tabindex="${activeTab === tab ? 0 : -1}">${tabLabel(tab)}</button>`).join("")}</div><button type="button" class="analysis-v2-close" data-action="close-analysis" aria-label="Esc，返回練習">Esc</button></div></header><main class="analysis-v2-main">${TABS.map((tab) => `<section id="${tabPanelId(tab)}" role="tabpanel" aria-labelledby="${tabId(tab)}"${activeTab === tab ? "" : " hidden"}>${activeTab === tab ? bodyMarkup(model, tab, preferences, selectedKey, selectedSpeedPathId, strategyBodySize) : ""}</section>`).join("")}</main></div>`;
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
    preferences = initialTab === undefined
      ? loaded
      : { ...loaded, activeTab: initialTab };
    selectedKey = null;
    selectedSpeedPathId = null;
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
