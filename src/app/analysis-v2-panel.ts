import "./analysis-v2.css";
import type { TokenId } from "../core/model.js";
import { physicalKeyLabel, tokenLabel } from "../diagnostics/labels.js";
import type { KeyDiagnostic } from "../diagnostics/types.js";
import type {
  CoordinationAggregateScope,
  CoordinationBodySizeBucket,
  ImmediateHandAggregateScope,
  InputOrderPositionAggregateScope,
  SameHandRevisitAggregateScope,
} from "../measurement-v2/aggregate.js";
import { STANDARD_BOPOMOFO_LAYOUT } from "../scheme/standard-layout.js";
import { KEYBOARD_GEOMETRY_ROWS, keyboardColumnSpan } from "./keyboard-geometry.js";
import { escapeHtml } from "./html.js";
import type { AnalysisV2Model, AnalysisV2MotorCell } from "./analysis-v2-model.js";
import {
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
const DEFAULT_PREFERENCES: AnalysisV2Preferences = { activeTab: "semantic", semanticView: "correctness" };
const BODY_SIZES: readonly CoordinationBodySizeBucket[] = ["2", "3", "4+"];
const POSITIONS = ["first", "middle", "last"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isTab(value: unknown): value is AnalysisV2Tab {
  return value === "semantic" || value === "coordination" || value === "strategy";
}
function isSemanticView(value: unknown): value is SemanticView {
  return value === "correctness" || value === "confusion";
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
  try { storage.setItem(PREFERENCES_KEY, JSON.stringify(value)); } catch { /* session-only */ }
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

function keyByToken(model: AnalysisV2Model): ReadonlyMap<TokenId, KeyDiagnostic> {
  return new Map(model.semantic.keys.map((row) => [row.tokenId, row]));
}

function keyDetailMarkup(model: AnalysisV2Model, tokenId: TokenId | null): string {
  if (tokenId === null) return '<div class="analysis-v2-selection-empty">選一個按鍵查看累積資料與最近趨勢。</div>';
  const row = model.semantic.keys.find((candidate) => candidate.tokenId === tokenId);
  if (row === undefined) return "";
  const progress = model.semantic.keyProgress[tokenId];
  const correctness = progress?.correctness.points.slice(-5).map((point) => `${Math.round(point.value * 100)}%`) ?? [];
  const timing = progress?.timing.points.slice(-5).map((point) => `${Math.round(point.value)} ms`) ?? [];
  return `<article class="analysis-v2-detail-card">
    <div class="analysis-v2-detail-heading"><strong>${escapeHtml(row.symbol)}</strong><span>實體鍵 ${escapeHtml(row.physicalKey)}</span></div>
    <dl>
      <div><dt>錯誤觀察比例</dt><dd>${escapeHtml(percent(row.displayedErrorRatio))}</dd></div>
      <div><dt>已記錄輸入</dt><dd>${row.attempts}</dd></div>
      <div><dt>錯誤</dt><dd>${row.errors}</dd></div>
      <div><dt>有效鍵間時間</dt><dd>${escapeHtml(milliseconds(row.timingMs))}</dd></div>
    </dl>
    <p>錯誤趨勢：${correctness.length === 0 ? "尚無完成的歷史點" : escapeHtml(correctness.join(" → "))}</p>
    <p>時間趨勢：${timing.length === 0 ? "尚無完成的歷史點" : escapeHtml(timing.join(" → "))}</p>
  </article>`;
}

function correctnessKeyboardMarkup(model: AnalysisV2Model, selectedKey: TokenId | null): string {
  const byToken = keyByToken(model);
  return `<div class="analysis-v2-semantic-layout">
    <section class="analysis-v2-keyboard-wrap" aria-label="按鍵錯誤觀察比例">
      <div class="analysis-v2-keyboard">${KEYBOARD_GEOMETRY_ROWS.map((row) => `<div class="analysis-v2-keyboard-row">${row.map((key) => {
        const columns = keyboardColumnSpan(key);
        const tokenId = STANDARD_BOPOMOFO_LAYOUT.bindings[key.code];
        if (tokenId === undefined) return `<span class="analysis-v2-key unmapped" style="--key-columns:${columns}" aria-hidden="true"></span>`;
        const diagnostic = byToken.get(tokenId);
        const ratio = diagnostic?.displayedErrorRatio ?? 0;
        const selected = selectedKey === tokenId;
        return `<button type="button" class="analysis-v2-key${selected ? " selected" : ""}" style="--key-columns:${columns};--analysis-strength:${Math.max(0, Math.min(1, ratio))}" data-action="select-key" data-token="${escapeHtml(tokenId)}" aria-pressed="${selected}" aria-label="${escapeHtml(tokenLabel(tokenId))}，實體鍵 ${escapeHtml(physicalKeyLabel(key.code))}，錯誤觀察比例 ${escapeHtml(percent(diagnostic?.displayedErrorRatio ?? null))}"><strong>${escapeHtml(tokenLabel(tokenId))}</strong><small>${diagnostic?.attempts ? escapeHtml(percent(diagnostic.displayedErrorRatio)) : "—"}</small></button>`;
      }).join("")}</div>`).join("")}</div>
      <p class="analysis-v2-note">顏色深淺只表示各鍵自己的錯誤觀察比例，不把鍵間時間或其他動作指標混成一個弱點分數。</p>
    </section>
    <aside class="analysis-v2-side-detail">${keyDetailMarkup(model, selectedKey)}</aside>
  </div>`;
}

function confusionMatrixMarkup(model: AnalysisV2Model): string {
  const totals = new Map<TokenId, number>();
  for (const row of model.semantic.confusions) {
    totals.set(row.expectedTokenId, (totals.get(row.expectedTokenId) ?? 0) + row.occurrences);
    totals.set(row.actualTokenId, (totals.get(row.actualTokenId) ?? 0) + row.occurrences);
  }
  const tokens = [...totals.entries()]
    .map(([tokenId, count]) => ({ tokenId, count, label: tokenLabel(tokenId) }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "zh-Hant"));
  if (tokens.length === 0) return '<div class="analysis-v2-empty">尚無可歸因的誤按資料。多個候選仍可能成立時，系統不會猜測你原本想按哪一鍵。</div>';
  const counts = new Map<string, number>();
  let maximum = 1;
  for (const row of model.semantic.confusions) {
    counts.set(`${row.expectedTokenId}\u0000${row.actualTokenId}`, row.occurrences);
    maximum = Math.max(maximum, row.occurrences);
  }
  return `<div class="analysis-v2-matrix-scroll"><table class="analysis-v2-matrix confusion-matrix">
    <caption>誤按方向矩陣：列是應按，欄是實際按下；方向分開計算。</caption>
    <thead><tr><th scope="col">應按 ↓ / 實按 →</th>${tokens.map((token) => `<th scope="col">${escapeHtml(token.label)}</th>`).join("")}</tr></thead>
    <tbody>${tokens.map((expected) => `<tr><th scope="row">${escapeHtml(expected.label)}</th>${tokens.map((actual) => {
      if (expected.tokenId === actual.tokenId) return '<td class="not-applicable">—</td>';
      const count = counts.get(`${expected.tokenId}\u0000${actual.tokenId}`) ?? 0;
      return `<td style="--analysis-strength:${count / maximum}" title="${escapeHtml(expected.label)} → ${escapeHtml(actual.label)}：${count} 次">${count === 0 ? "·" : count}</td>`;
    }).join("")}</tr>`).join("")}</tbody>
  </table></div>`;
}

function semanticMarkup(model: AnalysisV2Model, preferences: AnalysisV2Preferences, selectedKey: TokenId | null): string {
  return `<section class="analysis-v2-domain" aria-labelledby="analysis-v2-semantic-title">
    <div class="analysis-v2-domain-head"><div><h3 id="analysis-v2-semantic-title">語意輸入</h3><p>只回答「哪個符號容易按錯、會誤成什麼」，不把結構相鄰當成實際動作。</p></div>
      <div class="analysis-v2-segments" role="group" aria-label="語意分析視圖"><button type="button" data-action="semantic-view" data-value="correctness" aria-pressed="${preferences.semanticView === "correctness"}">按鍵</button><button type="button" data-action="semantic-view" data-value="confusion" aria-pressed="${preferences.semanticView === "confusion"}">誤按</button></div>
    </div>
    ${preferences.semanticView === "correctness" ? correctnessKeyboardMarkup(model, selectedKey) : confusionMatrixMarkup(model)}
  </section>`;
}

function speedKeyboardMarkup(): string {
  return `<div class="analysis-v2-keyboard analysis-v2-speed-keyboard" aria-hidden="true">${KEYBOARD_GEOMETRY_ROWS.map((row) => `<div class="analysis-v2-keyboard-row">${row.map((key) => {
    const columns = keyboardColumnSpan(key);
    const tokenId = STANDARD_BOPOMOFO_LAYOUT.bindings[key.code];
    if (tokenId === undefined) return `<span class="analysis-v2-key unmapped" style="--key-columns:${columns}"></span>`;
    return `<span class="analysis-v2-key mapped" style="--key-columns:${columns}"><strong>${escapeHtml(tokenLabel(tokenId))}</strong></span>`;
  }).join("")}</div>`).join("")}</div>`;
}

function speedNetworkMarkup(model: AnalysisV2Model): string {
  const paths = buildAnalysisV2SpeedPaths(model.coordination.immediateTokens);
  const samples = model.coordination.immediateTokens.reduce((sum, cell) => sum + cell.timingSamples, 0);
  const viewBox = ANALYSIS_V2_SPEED_VIEWBOX;
  return `<section class="analysis-v2-card analysis-v2-speed-card">
    <div class="analysis-v2-card-title-line"><div><h4>實際鍵間速度</h4><p>只畫實際相鄰接受、同音節且乾淨的鍵間時間；不從 canonical 結構補線。</p></div><span>${paths.length} 條有速度資料 · ${samples} 個乾淨樣本</span></div>
    <div class="analysis-v2-speed-board">
      ${speedKeyboardMarkup()}
      ${paths.length === 0 ? '<div class="analysis-v2-speed-empty">累積到乾淨的同音節相鄰輸入後，速度飛線會出現在這裡。</div>' : `<svg class="analysis-v2-speed-svg" viewBox="${viewBox.minX} ${viewBox.minY} ${viewBox.width} ${viewBox.height}" preserveAspectRatio="none" aria-label="實際鍵間速度圖">${paths.map((path) => `<path class="analysis-v2-speed-path${path.ready ? " ready" : " sampling"}${path.includesTone ? " tone" : ""}" d="${path.path}" style="--relation-width:${path.width};--relation-opacity:${path.opacity};--relation-slowness:${path.slowness}"><title>${escapeHtml(path.label)}</title></path>`).join("")}</svg>`}
    </div>
    <div class="analysis-v2-speed-legend"><span>相對較快</span><i aria-hidden="true"></i><span>相對較慢</span><small>線粗反映乾淨樣本量；少於 5 個樣本會較淡。此版先不加方向箭頭。</small></div>
  </section>`;
}

function trendText<Scope>(cell: AnalysisV2MotorCell<Scope> | undefined): string {
  if (cell === undefined || cell.history.length === 0) return "尚無歷史點";
  return cell.history.slice(-5).map((point) => `${Math.round(point.representativeTimingMs)} ms`).join(" → ");
}
function motorCellMarkup<Scope>(cell: AnalysisV2MotorCell<Scope> | undefined): string {
  if (cell === undefined) return '<div class="analysis-v2-motor-cell empty"><strong>—</strong><small>尚無觀察</small></div>';
  return `<div class="analysis-v2-motor-cell ${cell.ready ? "ready" : "sampling"}"><strong>${escapeHtml(milliseconds(cell.currentTimeToTypeMs))}</strong><small>${cell.timingSamples} 個乾淨樣本 · ${cell.observations} 次觀察</small><span>${escapeHtml(trendText(cell))}</span></div>`;
}
function findImmediate(model: AnalysisV2Model, fromHand: "left" | "right", toHand: "left" | "right"): AnalysisV2MotorCell<ImmediateHandAggregateScope> | undefined {
  return model.coordination.immediateHands.find((cell) => cell.scope.fromHand === fromHand && cell.scope.toHand === toHand);
}
function immediateHandMatrix(model: AnalysisV2Model): string {
  const hands = ["left", "right"] as const;
  const label = (hand: "left" | "right") => hand === "left" ? "左側鍵位" : "右側鍵位";
  return `<section class="analysis-v2-card"><h4>標準指法手別轉換</h4><p>依實體鍵的標準指法分工推定，不是偵測實際使用的手。</p><table class="analysis-v2-motor-table"><thead><tr><th>前一鍵 ↓ / 下一鍵 →</th>${hands.map((hand) => `<th>${label(hand)}</th>`).join("")}</tr></thead><tbody>${hands.map((from) => `<tr><th>${label(from)}</th>${hands.map((to) => `<td>${motorCellMarkup(findImmediate(model, from, to))}</td>`).join("")}</tr>`).join("")}</tbody></table></section>`;
}
function findCoordination(model: AnalysisV2Model, bodySize: CoordinationBodySizeBucket, handShape: CoordinationAggregateScope["handShape"]): AnalysisV2MotorCell<CoordinationAggregateScope> | undefined {
  return model.coordination.coordination.find((cell) => cell.scope.bodySize === bodySize && cell.scope.handShape === handShape);
}
function coordinationFacet(model: AnalysisV2Model): string {
  const shapes: readonly CoordinationAggregateScope["handShape"][] = ["left-only", "right-only", "mixed", "unknown"];
  const labels: Record<CoordinationAggregateScope["handShape"], string> = { "left-only": "左側鍵位", "right-only": "右側鍵位", mixed: "跨側鍵位", unknown: "手別未知" };
  return `<section class="analysis-v2-card"><h4>音節內協調</h4><p>從第一個已接受的 body 成分到最後一個 body 成分；不同成分數分開看。</p><table class="analysis-v2-motor-table wide"><thead><tr><th>body 成分</th>${shapes.map((shape) => `<th>${labels[shape]}</th>`).join("")}</tr></thead><tbody>${BODY_SIZES.map((size) => `<tr><th>${size}</th>${shapes.map((shape) => `<td>${motorCellMarkup(findCoordination(model, size, shape))}</td>`).join("")}</tr>`).join("")}</tbody></table></section>`;
}
function findRevisit(model: AnalysisV2Model, hand: "left" | "right", opposite: boolean): AnalysisV2MotorCell<SameHandRevisitAggregateScope> | undefined {
  return model.coordination.sameHandRevisits.find((cell) => cell.scope.hand === hand && cell.scope.oppositeHandIntervened === opposite);
}
function revisitMatrix(model: AnalysisV2Model): string {
  const hands = ["left", "right"] as const;
  return `<section class="analysis-v2-card"><h4>同側鍵位再出手</h4><p>比較同一標準指法側再次出現時，中間是否曾出現另一側鍵位。</p><table class="analysis-v2-motor-table"><thead><tr><th>鍵位側</th><th>連續同側</th><th>中間有另一側</th></tr></thead><tbody>${hands.map((hand) => `<tr><th>${hand === "left" ? "左側" : "右側"}</th><td>${motorCellMarkup(findRevisit(model, hand, false))}</td><td>${motorCellMarkup(findRevisit(model, hand, true))}</td></tr>`).join("")}</tbody></table></section>`;
}
function toneCommitCards(model: AnalysisV2Model): string {
  const cells = [...model.coordination.toneCommits].sort((a, b) => a.scope.toneToken.localeCompare(b.scope.toneToken));
  return `<section class="analysis-v2-card"><h4>聲調完成</h4><p>最後一個 body 成分到聲調鍵的乾淨時間，各聲調分開估計。</p><div class="analysis-v2-tone-grid">${cells.length === 0 ? '<div class="analysis-v2-empty compact">尚無聲調完成資料。</div>' : cells.map((cell) => `<div class="analysis-v2-tone-cell"><b>${escapeHtml(tokenLabel(cell.scope.toneToken))}</b>${motorCellMarkup(cell)}</div>`).join("")}</div></section>`;
}
function coordinationMarkup(model: AnalysisV2Model): string {
  return `<section class="analysis-v2-domain" aria-labelledby="analysis-v2-coordination-title"><div class="analysis-v2-domain-head"><div><h3 id="analysis-v2-coordination-title">動作協調</h3><p>${model.coordination.readyTokenTransitions} 條實際鍵間轉換與 ${model.coordination.readyScopes} 類協調 scope 已有至少 5 個乾淨樣本。不同動作類型不以絕對毫秒互相比弱。</p></div></div>${speedNetworkMarkup(model)}<div class="analysis-v2-card-grid">${immediateHandMatrix(model)}${revisitMatrix(model)}${coordinationFacet(model)}${toneCommitCards(model)}</div></section>`;
}

function positionLabel(position: InputOrderPositionAggregateScope["canonicalPosition"]): string {
  return position === "first" ? "前" : position === "last" ? "後" : "中";
}
function positionCount(model: AnalysisV2Model, bodySize: CoordinationBodySizeBucket, canonical: InputOrderPositionAggregateScope["canonicalPosition"], accepted: InputOrderPositionAggregateScope["acceptedPosition"]): number {
  return model.strategy.inputOrderPositions.find((row) => row.scope.bodySize === bodySize && row.scope.canonicalPosition === canonical && row.scope.acceptedPosition === accepted)?.observations ?? 0;
}
function strategyMatrix(model: AnalysisV2Model, bodySize: CoordinationBodySizeBucket): string {
  const rows = POSITIONS.map((canonical) => {
    const values = POSITIONS.map((accepted) => positionCount(model, bodySize, canonical, accepted));
    return { canonical, values, total: values.reduce((sum, value) => sum + value, 0) };
  });
  const total = rows.reduce((sum, row) => sum + row.total, 0);
  return `<section class="analysis-v2-card strategy-card"><div class="analysis-v2-card-title-line"><h4>${bodySize} 成分 body</h4><span>${total} 個位置觀察</span></div><table class="analysis-v2-matrix strategy-matrix"><caption>列是 canonical 位置；欄是實際被接受的位置。</caption><thead><tr><th>canonical ↓ / 實際 →</th>${POSITIONS.map((position) => `<th>${positionLabel(position)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr><th>${positionLabel(row.canonical)}</th>${row.values.map((count) => {
    const ratio = row.total === 0 ? 0 : count / row.total;
    return `<td style="--analysis-strength:${ratio}"><strong>${count === 0 ? "·" : count}</strong><small>${row.total === 0 ? "" : `${Math.round(ratio * 100)}%`}</small></td>`;
  }).join("")}</tr>`).join("")}</tbody></table></section>`;
}
function strategyMarkup(model: AnalysisV2Model): string {
  return `<section class="analysis-v2-domain" aria-labelledby="analysis-v2-strategy-title"><div class="analysis-v2-domain-head"><div><h3 id="analysis-v2-strategy-title">輸入策略</h3><p>${model.strategy.totalObservations} 個位置觀察。canonical 位置只是注音結構的參考座標，不代表要求的輸入順序；實際位置來自你真正完成 body 的順序。</p></div></div><div class="analysis-v2-strategy-grid">${BODY_SIZES.map((size) => strategyMatrix(model, size)).join("")}</div><p class="analysis-v2-note">4+ 成分為了讓長期資料保持 bounded，中間位置會合併成同一格；不保存 raw trace，也不建立 token-pair 順序分數。</p></section>`;
}
function bodyMarkup(model: AnalysisV2Model, preferences: AnalysisV2Preferences, selectedKey: TokenId | null): string {
  if (preferences.activeTab === "coordination") return coordinationMarkup(model);
  if (preferences.activeTab === "strategy") return strategyMarkup(model);
  return semanticMarkup(model, preferences, selectedKey);
}

export function renderAnalysisV2Summary(section: HTMLElement, model: AnalysisV2Model, openAnalysis: () => void): void {
  section.className = "panel-section diagnostic-summary-section analysis-v2-summary";
  section.removeAttribute("data-legacy-weak-section");
  section.innerHTML = `<div class="diagnostic-summary-heading"><div><h3>學習分析</h3><p>${model.semantic.keysWithData} 鍵有語意資料 · ${model.coordination.readyScopes} 類協調樣本已可比較 · ${model.strategy.totalObservations} 個順序位置觀察</p></div><button type="button" class="diagnostic-open-analysis">進入分析</button></div><div class="diagnostic-summary-signals" aria-label="學習分析摘要"><div><span>語意</span><strong>${model.semantic.keysWithData} 鍵</strong><small>${model.semantic.repeatedConfusions} 組重複誤按</small></div><div><span>協調</span><strong>${model.coordination.readyScopes} 類</strong><small>${model.coordination.cleanTimingSamples} 個乾淨時間樣本</small></div><div><span>策略</span><strong>${model.strategy.totalObservations}</strong><small>${model.strategy.bodySizeBucketsWithData} 種 body 尺度有資料</small></div></div>`;
  section.querySelector<HTMLButtonElement>(".diagnostic-open-analysis")?.addEventListener("click", openAnalysis);
}

export function createAnalysisV2(options: AnalysisV2Options): AnalysisV2Controller {
  const host = document.createElement("section");
  host.id = "diagnostic-analysis";
  host.className = "diagnostic-analysis analysis-v2";
  host.hidden = true;
  host.setAttribute("role", "dialog");
  host.setAttribute("aria-modal", "true");
  host.setAttribute("aria-labelledby", "diagnostic-analysis-title");
  document.body.append(host);

  let model = options.getModel();
  let preferences = loadPreferences(options.storage);
  let selectedKey: TokenId | null = null;
  let openFrame: number | null = null;
  const persist = () => savePreferences(options.storage, preferences);
  const cancelOpenFrame = (): void => {
    if (openFrame === null) return;
    window.cancelAnimationFrame(openFrame);
    openFrame = null;
  };
  const render = () => {
    host.innerHTML = `<div class="analysis-v2-shell"><header class="analysis-v2-header"><div><p class="analysis-v2-kicker">Analysis V2</p><h2 id="diagnostic-analysis-title">學習分析</h2></div><div class="analysis-v2-header-actions"><div class="analysis-v2-tabs" role="tablist" aria-label="分析類型">${TABS.map((tab) => `<button type="button" role="tab" data-action="select-tab" data-tab="${tab}" aria-selected="${preferences.activeTab === tab}" tabindex="${preferences.activeTab === tab ? 0 : -1}">${tabLabel(tab)}</button>`).join("")}</div><button type="button" class="diagnostic-analysis-close" data-action="close-analysis" aria-label="返回練習">Esc</button></div></header><main class="analysis-v2-main">${bodyMarkup(model, preferences, selectedKey)}</main></div>`;
  };
  const selectTab = (tab: AnalysisV2Tab, focus = true) => {
    preferences = { ...preferences, activeTab: tab };
    selectedKey = null;
    persist();
    render();
    if (focus) host.querySelector<HTMLButtonElement>(`[data-action="select-tab"][data-tab="${tab}"]`)?.focus();
  };
  const close = () => {
    cancelOpenFrame();
    host.hidden = true;
    host.classList.remove("open");
    options.onClose?.();
  };
  const open = (initialTab?: AnalysisV2Tab) => {
    cancelOpenFrame();
    model = options.getModel();
    const loaded = loadPreferences(options.storage);
    preferences = initialTab === undefined ? loaded : { ...loaded, activeTab: initialTab };
    selectedKey = null;
    host.hidden = false;
    render();
    openFrame = window.requestAnimationFrame(() => {
      openFrame = null;
      if (host.hidden) return;
      host.classList.add("open");
      host.querySelector<HTMLButtonElement>(".diagnostic-analysis-close")?.focus();
    });
  };

  host.onclick = (event) => {
    const target = event.target instanceof Element ? event.target.closest<HTMLElement>("[data-action]") : null;
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
        persist();
        render();
      }
      return;
    }
    if (target.dataset.action === "select-key") {
      const token = target.dataset.token;
      if (token !== undefined) {
        selectedKey = selectedKey === token ? null : token;
        render();
      }
    }
  };
  host.onkeydown = (event) => {
    if (!(event.target instanceof HTMLButtonElement) || event.target.getAttribute("role") !== "tab") return;
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
  const interceptEscape = (event: KeyboardEvent) => {
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
