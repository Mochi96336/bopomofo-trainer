import "./diagnostics.css";
import "./diagnostic-polish.css";
import type { TokenId } from "../core/model.js";
import {
  diagnosticDataStateLabel,
  physicalKeyLabel,
  tokenLabel,
} from "../diagnostics/labels.js";
import { DIAGNOSTIC_POLICY } from "../diagnostics/policy.js";
import {
  selectConfusionDiagnostics,
  selectKeyDiagnostics,
  selectTransitionDiagnostics,
} from "../diagnostics/selectors.js";
import type {
  ConfusionDiagnostic,
  DiagnosticDataState,
  DiagnosticModel,
  KeyDiagnostic,
  KeyProgressSeries,
  KeyProgressTrends,
  TransitionDiagnostic,
} from "../diagnostics/types.js";
import { STANDARD_BOPOMOFO_LAYOUT } from "../scheme/standard-layout.js";
import {
  diagnosticNetworkVisible,
  openDiagnosticAnalysisState,
  selectDiagnosticAnalysisTab,
  toggleDiagnosticNetwork,
  type DiagnosticAnalysisSelection,
  type DiagnosticAnalysisState,
} from "./diagnostic-analysis-state.js";
import {
  DEFAULT_DIAGNOSTIC_PREFERENCES,
  loadDiagnosticPreferences,
  saveDiagnosticPreferences,
  type DiagnosticPreferenceStorage,
  type DiagnosticPreferences,
  type DiagnosticTab,
} from "./diagnostic-preferences.js";
import {
  KEYBOARD_GEOMETRY_ROWS,
  keyboardColumnSpan,
} from "./keyboard-geometry.js";
import {
  captureFocusIdentity,
  restoreFocusIdentity,
} from "./focus-preservation.js";

const DIAGNOSTIC_TABS = ["key", "transition", "confusion"] as const;
const ANALYSIS_ANIMATION_MS = 180;
const KEYBOARD_TILT = "perspective(520px) rotateX(19deg)";
const NETWORK_ICON_SVG = `<svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round">
  <path d="M3.4 3.4 L12.6 3.4 M3.4 3.4 L8 13 M12.6 3.4 L8 13"></path>
  <circle cx="3.4" cy="3.4" r="1.7" fill="currentColor" stroke="none"></circle>
  <circle cx="12.6" cy="3.4" r="1.7" fill="currentColor" stroke="none"></circle>
  <circle cx="8" cy="13" r="1.7" fill="currentColor" stroke="none"></circle>
</svg>`;

// Where the keyboard visually "comes from": the practice keyboard hint if it
// is currently shown, otherwise a strip near the bottom of the practice
// stage, so the rise below always has a real on-screen origin to animate from.
function keyboardFlipOrigin(): DOMRect | null {
  const sketch = document.querySelector<HTMLElement>("#keyboard-sketch");
  if (sketch !== null && !sketch.hidden) {
    const rect = sketch.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) return rect;
  }
  const stage = document.querySelector<HTMLElement>("#practice-stage");
  const stageRect = stage?.getBoundingClientRect();
  if (stageRect === undefined || stageRect.width === 0) return null;
  return new DOMRect(
    stageRect.left,
    stageRect.bottom - stageRect.height * 0.18,
    stageRect.width,
    stageRect.height * 0.18,
  );
}

function animateKeyboardRise(board: HTMLElement): void {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const origin = keyboardFlipOrigin();
  if (origin === null) return;
  const target = board.getBoundingClientRect();
  if (target.width === 0 || target.height === 0) return;
  const dx = (origin.left + origin.width / 2) - (target.left + target.width / 2);
  const dy = (origin.top + origin.height / 2) - (target.top + target.height / 2);
  const scaleX = origin.width / target.width;
  const scaleY = origin.height / target.height;
  board.animate([
    {
      transform: `translate(${dx}px, ${dy}px) scale(${scaleX}, ${scaleY}) ${KEYBOARD_TILT}`,
      opacity: 0.25,
    },
    { transform: KEYBOARD_TILT, opacity: 1 },
  ], { duration: 320, easing: "cubic-bezier(.2, .75, .25, 1)" });
}

interface KeyboardSignal {
  readonly strength: number;
  readonly connected: boolean;
  readonly selected: boolean;
}

export interface DiagnosticAnalysisController {
  open(initialTab?: DiagnosticTab): void;
  close(): void;
  destroy(): void;
}

export interface DiagnosticAnalysisOptions {
  readonly getModel: () => DiagnosticModel;
  readonly storage: DiagnosticPreferenceStorage;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/gu, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character] ?? character);
}

function percent(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function milliseconds(value: number): string {
  return `${Math.round(value)} ms`;
}

function boost(value: number): string {
  return `${value.toFixed(2)}×`;
}

function summaryText(model: DiagnosticModel): string {
  return `${model.summary.keysWithData} 鍵有資料 · ${model.summary.repeatedConfusions} 組重複誤按 · ${model.summary.slowerTransitions} 組慢轉換`;
}

function tabLabel(tab: DiagnosticTab): string {
  if (tab === "transition") return "轉換";
  if (tab === "confusion") return "誤按";
  return "按鍵";
}

function tabButtonId(tab: DiagnosticTab): string {
  return `diagnostic-analysis-tab-${tab}`;
}

function tabPanelId(tab: DiagnosticTab): string {
  return `diagnostic-analysis-panel-${tab}`;
}

function isDiagnosticTab(value: string | undefined): value is DiagnosticTab {
  return value === "key" || value === "transition" || value === "confusion";
}

function stateBadgeMarkup(state: DiagnosticDataState): string {
  if (state === "sufficient") return "";
  return `<span class="diagnostic-state ${state}">${escapeHtml(diagnosticDataStateLabel(state))}</span>`;
}

function detailStateMarkup(state: DiagnosticDataState): string {
  if (state === "sufficient") return "";
  return `<strong class="diagnostic-detail-state ${state}">${escapeHtml(diagnosticDataStateLabel(state))}</strong>`;
}

function keyRows(
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
function transitionRows(
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
  if (selectedKey !== null) return `${tokenLabel(selectedKey)} 目前沒有可列出的轉換。`;
  if (model.transitions.length === 0) return "尚無轉換資料。";
  return `轉換樣本仍不足；累積 ${DIAGNOSTIC_POLICY.relationshipSamples.preliminary} 個樣本後才會列出。`;
}

export function confusionEmptyMessage(selectedKey: TokenId | null): string {
  return selectedKey === null
    ? "尚無誤按資料。"
    : `${tokenLabel(selectedKey)} 目前沒有誤按紀錄。`;
}

function confusionRows(
  model: DiagnosticModel,
  state: DiagnosticAnalysisSelection,
): readonly ConfusionDiagnostic[] {
  return selectConfusionDiagnostics(model.confusions, {
    selectedKey: state.selectedKey,
    direction: "both",
    complete: true,
  });
}

function representativeSignals(model: DiagnosticModel): {
  readonly key: KeyDiagnostic | null;
  readonly transition: TransitionDiagnostic | null;
  readonly confusion: ConfusionDiagnostic | null;
} {
  return {
    key: selectKeyDiagnostics(
      model.keys.filter((row) => row.attempts > 0),
      "error-ratio",
      false,
    )[0] ?? null,
    transition: selectTransitionDiagnostics(model.transitions, {
      selectedKey: null,
      direction: "both",
      minimumSamples: 5,
      includeTone: true,
      complete: false,
    })[0] ?? null,
    confusion: selectConfusionDiagnostics(model.confusions, {
      selectedKey: null,
      direction: "both",
      complete: false,
    })[0] ?? null,
  };
}

export function renderDiagnosticSummary(
  section: HTMLElement,
  model: DiagnosticModel,
  openAnalysis: () => void,
): void {
  const signals = representativeSignals(model);
  const keyValue = signals.key === null
    ? "—"
    : `${signals.key.symbol} ${signals.key.displayedErrorRatio === null ? "—" : percent(signals.key.displayedErrorRatio)}`;
  const keyMeta = signals.key === null ? "尚無按鍵資料" : `${signals.key.attempts} 次`;
  const transitionValue = signals.transition === null
    ? "—"
    : `${signals.transition.fromSymbol} → ${signals.transition.toSymbol}`;
  const transitionMeta = signals.transition !== null
    ? `${milliseconds(signals.transition.timingMs)} · ${signals.transition.timingSamples} 樣本`
    // No representative row means either nothing recorded at all or nothing that
    // clears the sample gate; those read very differently to a learner.
    : model.transitions.length === 0 ? "尚無轉換資料" : "轉換樣本不足";
  const confusionValue = signals.confusion === null
    ? "—"
    : `${signals.confusion.expectedSymbol} → ${signals.confusion.actualSymbol}`;
  const confusionMeta = signals.confusion === null ? "尚無誤按" : `${signals.confusion.occurrences} 次`;

  section.className = "panel-section diagnostic-summary-section";
  section.removeAttribute("data-legacy-weak-section");
  section.innerHTML = `<div class="diagnostic-summary-heading">
      <div>
        <h3>弱點診斷</h3>
        <p>${escapeHtml(summaryText(model))}</p>
      </div>
      <button type="button" class="diagnostic-open-analysis">進入分析</button>
    </div>
    <div class="diagnostic-summary-signals" aria-label="弱點診斷摘要">
      <div><span>按鍵</span><strong>${escapeHtml(keyValue)}</strong><small>${escapeHtml(keyMeta)}</small></div>
      <div><span>轉換</span><strong>${escapeHtml(transitionValue)}</strong><small>${escapeHtml(transitionMeta)}</small></div>
      <div><span>誤按</span><strong>${escapeHtml(confusionValue)}</strong><small>${escapeHtml(confusionMeta)}</small></div>
    </div>`;
  section.querySelector<HTMLButtonElement>(".diagnostic-open-analysis")
    ?.addEventListener("click", openAnalysis);
}

function metricExplanation(preferences: DiagnosticPreferences): string {
  if (preferences.activeTab === "key") {
    return preferences.keySort === "timing"
      ? "到達各鍵的有效鍵間時間；起始、錯誤、修正與干擾不計。"
      : "已映射觀察中的錯誤比例，不是首次作答錯誤率。";
  }
  return preferences.activeTab === "transition"
    ? "同音節相鄰鍵的方向性時間；反向另計。"
    : "應按與實際按鍵的方向性關係；反向另計。";
}

function visibleRowsForTab(
  model: DiagnosticModel,
  preferences: DiagnosticPreferences,
  state: DiagnosticAnalysisSelection,
): readonly (KeyDiagnostic | TransitionDiagnostic | ConfusionDiagnostic)[] {
  if (preferences.activeTab === "transition") return transitionRows(model, state);
  if (preferences.activeTab === "confusion") return confusionRows(model, state);
  return keyRows(model, preferences);
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

function keyboardMarkup(
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
      <button type="button" class="diagnostic-network-icon" data-action="toggle-network" aria-pressed="${networkVisible(preferences, state)}" aria-label="全網：顯示所有已發生與注音結構上可能的轉換，依嚴重程度從淡墨變紅" title="全網">${NETWORK_ICON_SVG}</button>
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

function segmentedRowMarkup(
  label: string,
  action: string,
  options: readonly (readonly [string, string])[],
  active: string,
): string {
  return `<div class="diagnostic-toolbar-row">
    <span class="diagnostic-toolbar-label">${escapeHtml(label)}</span>
    <div class="diagnostic-segments" aria-label="${escapeHtml(label)}">
      ${options.map(([value, text]) => `<button type="button" data-action="${action}" data-value="${escapeHtml(value)}" aria-pressed="${active === value}">${escapeHtml(text)}</button>`).join("")}
    </div>
  </div>`;
}

// Direction, sample-count, and top-5/all filters all turned out to be noise
// nobody used; every list now always shows everything it has. Only the
// controls that change what the data itself means (sort basis, whether tone
// relations count) remain.
function inspectorToolbarMarkup(preferences: DiagnosticPreferences): string {
  if (preferences.activeTab === "key") {
    return `<div class="diagnostic-inspector-toolbar">
      ${segmentedRowMarkup("排序", "key-sort", [["error-ratio", "錯誤比例"], ["timing", "鍵間時間"]], preferences.keySort)}
    </div>`;
  }
  return "";
}

function keyListRowMarkup(row: KeyDiagnostic, selected: boolean): string {
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

function transitionListRowMarkup(row: TransitionDiagnostic, selected: boolean): string {
  return `<button type="button" class="diagnostic-inspector-row relation${selected ? " selected" : ""}" data-action="select-relation" data-id="${escapeHtml(row.id)}" aria-pressed="${selected}">
    <span class="diagnostic-relation-pair"><strong>${escapeHtml(row.fromSymbol)}</strong><small>${escapeHtml(row.fromPhysicalKey)}</small><i>→</i><strong>${escapeHtml(row.toSymbol)}</strong><small>${escapeHtml(row.toPhysicalKey)}</small></span>
    <span class="diagnostic-inspector-main"><strong>${milliseconds(row.timingMs)}</strong><small>${row.timingSamples} 樣本</small></span>
    ${stateBadgeMarkup(row.dataState)}
  </button>`;
}

function confusionListRowMarkup(row: ConfusionDiagnostic, selected: boolean): string {
  return `<button type="button" class="diagnostic-inspector-row relation${selected ? " selected" : ""}" data-action="select-relation" data-id="${escapeHtml(row.id)}" aria-pressed="${selected}">
    <span class="diagnostic-relation-pair"><strong>${escapeHtml(row.expectedSymbol)}</strong><small>${escapeHtml(row.expectedPhysicalKey)}</small><i>→</i><strong>${escapeHtml(row.actualSymbol)}</strong><small>${escapeHtml(row.actualPhysicalKey)}</small></span>
    <span class="diagnostic-inspector-main"><strong>${row.occurrences} 次</strong><small>同目標占 ${percent(row.expectedErrorShare)}</small></span>
    ${stateBadgeMarkup(row.dataState)}
  </button>`;
}

function keySampleNotices(row: KeyDiagnostic): string {
  const notices: string[] = [];
  if (row.errorDataState !== "sufficient") {
    notices.push(`<div><dt>錯誤觀察</dt><dd>${escapeHtml(diagnosticDataStateLabel(row.errorDataState))}</dd></div>`);
  }
  // Timing availability and timing data state move together: the model only
  // leaves the state null when timing is not applicable, which the first branch
  // already covers. There is no third case to write copy for.
  if (row.timingAvailability === "not-applicable") {
    notices.push("<div><dt>鍵間時間</dt><dd>不適用</dd></div>");
  } else if (row.timingDataState !== null && row.timingDataState !== "sufficient") {
    notices.push(`<div><dt>鍵間時間</dt><dd>${escapeHtml(diagnosticDataStateLabel(row.timingDataState))}</dd></div>`);
  }
  if (notices.length === 0) return "";
  return `<section><h4>樣本提示</h4><dl class="diagnostic-detail-lines">${notices.join("")}</dl></section>`;
}

function keyTimingCaption(row: KeyDiagnostic): string {
  if (row.timingAvailability === "not-applicable") return "不適用";
  if (row.timingDataState === "insufficient" || row.timingDataState === null) return "資料不足";
  if (row.timingDataState === "preliminary") return "初步";
  return `${row.timingSamples} 樣本`;
}

// The viewBox scales uniformly (no `preserveAspectRatio="none"`), so the point
// markers stay circular at every pane width instead of being squashed into
// ellipses, and the horizontal padding keeps the emphasized newest point fully
// inside the frame.
const PROGRESS_CHART = {
  /** Left gutter reserved for the axis bound labels. */
  gutter: 40,
  plotWidth: 230,
  height: 56,
  padX: 9,
  padY: 9,
  tick: 3,
} as const;

function progressValueText(series: KeyProgressSeries, value: number): string {
  return series.unit === "percent" ? percent(value) : milliseconds(value);
}

// The axis bounds are drawn on the chart itself rather than described beside
// it, so the scale is read where it is used. They matter because the domain is
// adaptive: without them a bounded 8%-to-7% fall and a real collapse would look
// alike.
function progressBoundText(series: KeyProgressSeries, value: number): string {
  return series.unit === "percent" ? percent(value) : `${Math.round(value)} ms`;
}

// The delta line is the two comparison windows' representative values, not the
// first and last raw points: a single outlying bucket at either end must not be
// what the learner reads as the change.
function progressDeltaText(series: KeyProgressSeries): string {
  const { previousValue, recentValue } = series.trend;
  if (previousValue !== null && recentValue !== null) {
    return `${progressValueText(series, previousValue)} → ${progressValueText(series, recentValue)}`;
  }
  return series.latestValue === null ? "—" : progressValueText(series, series.latestValue);
}

function progressPartialText(series: KeyProgressSeries): string {
  if (series.partialSampleCount === 0) return "";
  return `下一個區段 ${series.partialSampleCount} / ${series.bucketSize}`;
}

/**
 * A small inline chart. Points are positioned inside the domain the diagnostics
 * projection already chose, which carries a minimum span, so a one-point
 * difference cannot be drawn as a cliff. There is no extrapolated segment past
 * the newest point.
 */
function progressChartMarkup(series: KeyProgressSeries): string {
  const { gutter, plotWidth, height, padX, padY, tick } = PROGRESS_CHART;
  const { minimum, maximum } = series.chartDomain;
  const span = maximum - minimum || 1;
  const width = gutter + plotWidth;
  const left = gutter + padX;
  const right = width - padX;
  const innerWidth = right - left;
  const innerHeight = height - padY * 2;
  const yFor = (value: number): number =>
    padY + innerHeight - ((value - minimum) / span) * innerHeight;

  const step = series.points.length > 1 ? innerWidth / (series.points.length - 1) : 0;
  const placed = series.points.map((point) => ({
    point,
    x: series.points.length > 1 ? left + step * point.index : left + innerWidth / 2,
    y: yFor(point.value),
  }));
  const path = placed
    .map((entry, index) => `${index === 0 ? "M" : "L"}${entry.x.toFixed(1)},${entry.y.toFixed(1)}`)
    .join(" ");

  // Upper and lower bound of the adaptive domain, labelled where they sit.
  const bounds = [maximum, minimum].map((value) => {
    const y = yFor(value).toFixed(1);
    return `<line class="diagnostic-progress-axis-tick" x1="${gutter - tick}" x2="${gutter}" y1="${y}" y2="${y}"></line>`
      + `<text class="diagnostic-progress-axis-label" x="${gutter - tick - 3}" y="${y}" text-anchor="end" dominant-baseline="middle">${escapeHtml(progressBoundText(series, value))}</text>`;
  }).join("");

  const referenceY = series.trend.previousValue === null
    ? null
    : yFor(series.trend.previousValue).toFixed(1);
  const reference = referenceY === null
    ? ""
    : `<line class="diagnostic-progress-reference" x1="${left}" x2="${right}" y1="${referenceY}" y2="${referenceY}"></line>`;

  const dots = placed.map((entry, index) => {
    const latest = index === placed.length - 1;
    const title = `第 ${entry.point.index + 1} 區段 · ${progressValueText(series, entry.point.value)} · ${entry.point.sampleCount} 樣本`;
    return `<circle class="diagnostic-progress-point${latest ? " latest" : ""}" cx="${entry.x.toFixed(1)}" cy="${entry.y.toFixed(1)}" r="${latest ? 3 : 1.9}"><title>${escapeHtml(title)}</title></circle>`;
  }).join("");

  // Hidden from assistive technology: the accessible summary below already
  // carries every value, so the axis text must not be read out as loose numbers.
  return `<svg class="diagnostic-progress-svg" viewBox="0 0 ${width} ${height}" role="presentation" focusable="false" aria-hidden="true">
    ${bounds}
    ${reference}
    ${placed.length > 1 ? `<path class="diagnostic-progress-line" d="${path}"></path>` : ""}
    ${dots}
  </svg>`;
}

function progressSeriesMarkup(series: KeyProgressSeries): string {
  const head = `<figcaption class="diagnostic-progress-head">
      <span class="diagnostic-progress-metric">${escapeHtml(series.metricLabel)}</span>
      <span class="diagnostic-progress-delta">${escapeHtml(progressDeltaText(series))}</span>
    </figcaption>`;
  const summary = `<p class="visually-hidden">${escapeHtml(series.accessibleSummary)}</p>`;

  if (series.state === "not-applicable") {
    return `<figure class="diagnostic-progress-series" data-metric="${series.metric}" data-state="not-applicable">
      <figcaption class="diagnostic-progress-head"><span class="diagnostic-progress-metric">${escapeHtml(series.metricLabel)}</span></figcaption>
      <p class="diagnostic-progress-note">不適用</p>
      ${summary}
    </figure>`;
  }
  if (series.state === "no-history") {
    const partial = progressPartialText(series);
    return `<figure class="diagnostic-progress-series" data-metric="${series.metric}" data-state="no-history">
      <figcaption class="diagnostic-progress-head"><span class="diagnostic-progress-metric">${escapeHtml(series.metricLabel)}</span></figcaption>
      <p class="diagnostic-progress-note">從本版本開始累積趨勢</p>
      ${partial ? `<p class="diagnostic-progress-partial">${escapeHtml(partial)}</p>` : ""}
      ${summary}
    </figure>`;
  }

  const caption = series.state === "single-point"
    ? "再累積一些有效觀察後才能比較"
    : series.trend.state === "insufficient"
      ? "目前資料不足以判斷方向"
      : series.trend.label;
  const partial = progressPartialText(series);

  return `<figure class="diagnostic-progress-series" data-metric="${series.metric}" data-state="${series.state}" data-trend="${series.trend.state}">
    ${head}
    ${progressChartMarkup(series)}
    <p class="diagnostic-progress-trend">${escapeHtml(caption)}</p>
    ${partial ? `<p class="diagnostic-progress-meta">${escapeHtml(partial)}</p>` : ""}
    ${summary}
  </figure>`;
}

/**
 * `最近變化` sits below the exact cumulative detail, never replacing it. The two
 * metrics stay on separate charts with separate values: they are different
 * observations and are never combined into one score or one axis.
 */
export function keyProgressMarkup(trends: KeyProgressTrends | undefined): string {
  if (trends === undefined) return "";
  return `<section class="diagnostic-progress">
    <h4>最近變化</h4>
    ${progressSeriesMarkup(trends.correctness)}
    ${progressSeriesMarkup(trends.timing)}
  </section>`;
}

function keyDetailMarkup(
  row: KeyDiagnostic | null,
  trends?: KeyProgressTrends,
): string {
  if (row === null) return '<div class="diagnostic-detail-empty">選一個按鍵查看量測。</div>';
  return `<article class="diagnostic-detail-card">
    <header><div><span>按鍵</span><h3>${escapeHtml(row.symbol)} <small>${escapeHtml(row.physicalKey)}</small></h3></div>${detailStateMarkup(row.overallDataState)}</header>
    <dl class="diagnostic-detail-metrics">
      <div><dt>錯誤觀察比例</dt><dd>${row.displayedErrorRatio === null ? "—" : percent(row.displayedErrorRatio)}</dd><small>${row.errors} / ${row.attempts}</small></div>
      <div><dt>有效鍵間時間</dt><dd>${row.timingMs === null ? "—" : milliseconds(row.timingMs)}</dd><small>${escapeHtml(keyTimingCaption(row))}</small></div>
      <div><dt>最佳時間</dt><dd>${row.bestTimingMs === null ? "—" : milliseconds(row.bestTimingMs)}</dd><small>${row.timingSamples} 樣本</small></div>
      <div><dt>選題倍率</dt><dd>${boost(row.reinforcement.expectedTokenBoost)}</dd><small>${escapeHtml(row.reinforcement.label)}</small></div>
    </dl>
    ${keySampleNotices(row)}
    <section><h4>未計入時間</h4><dl class="diagnostic-detail-lines four">
      <div><dt>音節起始</dt><dd>${row.excludedSamples.syllableStart}</dd></div>
      <div><dt>錯誤輸入</dt><dd>${row.excludedSamples.incorrect}</dd></div>
      <div><dt>修正輸入</dt><dd>${row.excludedSamples.recovery}</dd></div>
      <div><dt>輸入干擾</dt><dd>${row.excludedSamples.interactionNoise}</dd></div>
    </dl></section>
    <section><h4>選題原因</h4><p>${escapeHtml(row.reinforcement.reason)}</p></section>
    ${keyProgressMarkup(trends)}
  </article>`;
}

function transitionDetailMarkup(row: TransitionDiagnostic | null): string {
  if (row === null) return '<div class="diagnostic-detail-empty">選一筆轉換查看數值。</div>';
  return `<article class="diagnostic-detail-card relation-detail">
    <header><div><span>轉換</span><h3>${escapeHtml(row.fromSymbol)} <small>${escapeHtml(row.fromPhysicalKey)}</small> → ${escapeHtml(row.toSymbol)} <small>${escapeHtml(row.toPhysicalKey)}</small></h3></div>${detailStateMarkup(row.dataState)}</header>
    <dl class="diagnostic-detail-metrics three">
      <div><dt>目前</dt><dd>${milliseconds(row.timingMs)}</dd></div>
      <div><dt>最佳</dt><dd>${milliseconds(row.bestTimingMs)}</dd></div>
      <div><dt>樣本</dt><dd>${row.timingSamples}</dd></div>
    </dl>
    <section><h4>計算方式</h4><p>同音節、相鄰且正確的乾淨輸入；反向另計。</p></section>
  </article>`;
}

function confusionDetailMarkup(row: ConfusionDiagnostic | null): string {
  if (row === null) return '<div class="diagnostic-detail-empty">選一筆誤按查看數值。</div>';
  return `<article class="diagnostic-detail-card relation-detail">
    <header><div><span>誤按</span><h3>${escapeHtml(row.expectedSymbol)} <small>${escapeHtml(row.expectedPhysicalKey)}</small> → ${escapeHtml(row.actualSymbol)} <small>${escapeHtml(row.actualPhysicalKey)}</small></h3></div>${detailStateMarkup(row.dataState)}</header>
    <dl class="diagnostic-detail-metrics three">
      <div><dt>此組</dt><dd>${row.occurrences}</dd></div>
      <div><dt>同目標總數</dt><dd>${row.expectedConfusionTotal}</dd></div>
      <div><dt>占比</dt><dd>${percent(row.expectedErrorShare)}</dd></div>
    </dl>
    <section><h4>計算方式</h4><p>分母是同一應按鍵的所有誤按；反向另計。</p></section>
  </article>`;
}

function inspectorHeadMarkup(preferences: DiagnosticPreferences, state: DiagnosticAnalysisSelection): string {
  return `<div class="diagnostic-inspector-head">
    <div class="diagnostic-analysis-tabs" role="tablist" aria-label="弱點診斷類型">
      ${DIAGNOSTIC_TABS.map((tab) => `<button id="${tabButtonId(tab)}" type="button" role="tab" data-action="select-tab" data-tab="${tab}" aria-selected="${preferences.activeTab === tab}" aria-controls="${tabPanelId(tab)}" tabindex="${preferences.activeTab === tab ? 0 : -1}">${tabLabel(tab)}</button>`).join("")}
    </div>
    <button type="button" class="diagnostic-analysis-close" data-action="close-analysis" aria-label="返回練習">Esc</button>
  </div>`;
}

function inspectorSummaryMarkup(preferences: DiagnosticPreferences, visibleCount: number): string {
  return `<p class="diagnostic-metric-hint">${visibleCount} 筆 · ${escapeHtml(metricExplanation(preferences))}</p>`;
}

function inspectorMarkup(
  model: DiagnosticModel,
  preferences: DiagnosticPreferences,
  state: DiagnosticAnalysisSelection,
): string {
  if (preferences.activeTab === "key") {
    const rows = keyRows(model, preferences);
    const selected = model.keys.find((row) => row.tokenId === state.selectedKey) ?? rows[0] ?? null;
    return `<aside class="diagnostic-analysis-inspector" aria-label="按鍵診斷列表與細節">
      ${inspectorHeadMarkup(preferences, state)}
      ${inspectorToolbarMarkup(preferences)}
      <div class="diagnostic-inspector-list">
        ${rows.length === 0 ? '<p class="diagnostic-inspector-empty">尚無按鍵資料。</p>' : rows.map((row) => keyListRowMarkup(row, selected?.tokenId === row.tokenId)).join("")}
      </div>
      <div class="diagnostic-inspector-detail">${keyDetailMarkup(selected, selected === null ? undefined : model.keyProgress[selected.tokenId])}</div>
      ${inspectorSummaryMarkup(preferences, rows.length)}
    </aside>`;
  }
  if (preferences.activeTab === "transition") {
    const rows = transitionRows(model, state);
    const selected = rows.find((row) => row.id === state.selectedRelationId) ?? rows[0] ?? null;
    return `<aside class="diagnostic-analysis-inspector" aria-label="轉換診斷列表與細節">
      ${inspectorHeadMarkup(preferences, state)}
      ${inspectorToolbarMarkup(preferences)}
      <div class="diagnostic-inspector-list">
        ${rows.length === 0 ? `<p class="diagnostic-inspector-empty">${escapeHtml(transitionEmptyMessage(model, state.selectedKey))}</p>` : rows.map((row) => transitionListRowMarkup(row, selected?.id === row.id)).join("")}
      </div>
      <div class="diagnostic-inspector-detail">${transitionDetailMarkup(selected)}</div>
      ${inspectorSummaryMarkup(preferences, rows.length)}
    </aside>`;
  }
  const rows = confusionRows(model, state);
  const selected = rows.find((row) => row.id === state.selectedRelationId) ?? rows[0] ?? null;
  return `<aside class="diagnostic-analysis-inspector" aria-label="誤按診斷列表與細節">
    ${inspectorHeadMarkup(preferences, state)}
    ${inspectorToolbarMarkup(preferences)}
    <div class="diagnostic-inspector-list">
      ${rows.length === 0 ? `<p class="diagnostic-inspector-empty">${escapeHtml(confusionEmptyMessage(state.selectedKey))}</p>` : rows.map((row) => confusionListRowMarkup(row, selected?.id === row.id)).join("")}
    </div>
    <div class="diagnostic-inspector-detail">${confusionDetailMarkup(selected)}</div>
    ${inspectorSummaryMarkup(preferences, rows.length)}
  </aside>`;
}

function loadPreferences(storage: DiagnosticPreferenceStorage): DiagnosticPreferences {
  try {
    return loadDiagnosticPreferences(storage);
  } catch {
    return DEFAULT_DIAGNOSTIC_PREFERENCES;
  }
}

export function createDiagnosticAnalysis(
  options: DiagnosticAnalysisOptions,
): DiagnosticAnalysisController {
  const host = document.createElement("section");
  host.id = "diagnostic-analysis";
  host.className = "diagnostic-analysis";
  host.hidden = true;
  host.setAttribute("role", "dialog");
  host.setAttribute("aria-modal", "true");
  host.setAttribute("aria-labelledby", "diagnostic-analysis-title");
  document.body.append(host);

  let model = options.getModel();
  let preferences = loadPreferences(options.storage);
  let state: DiagnosticAnalysisSelection = {
    selectedKey: null,
    selectedRelationId: null,
  };
  let closingTimer: number | null = null;
  let analysisOpener: HTMLElement | null = null;
  let sourceDialogToRestore: HTMLDialogElement | null = null;

  const applyAnalysisState = (next: DiagnosticAnalysisState): void => {
    preferences = next.preferences;
    state = next.selection;
  };

  const persist = (): void => {
    try {
      saveDiagnosticPreferences(options.storage, preferences);
    } catch {
      // Preferences remain active for this analysis session when storage is unavailable.
    }
  };

  const render = (): void => {
    const focusIdentity = captureFocusIdentity(host);
    host.innerHTML = `<div class="diagnostic-analysis-shell">
      <div id="${tabPanelId(preferences.activeTab)}" class="diagnostic-analysis-body" role="tabpanel" aria-labelledby="${tabButtonId(preferences.activeTab)}">
        ${keyboardMarkup(model, preferences, state)}
        ${inspectorMarkup(model, preferences, state)}
      </div>
    </div>`;
    if (focusIdentity !== null) {
      restoreFocusIdentity(host, focusIdentity, [
        `#${tabButtonId(preferences.activeTab)}`,
        ".diagnostic-analysis-close",
      ]);
    }
  };

  const activateTab = (tab: DiagnosticTab): void => {
    applyAnalysisState(selectDiagnosticAnalysisTab({
      preferences,
      selection: state,
    }, tab));
    persist();
    render();
    host.querySelector<HTMLButtonElement>(`#${tabButtonId(tab)}`)?.focus();
  };

  const finishClose = (): void => {
    closingTimer = null;
    host.hidden = true;
    host.classList.remove("open", "closing");
    document.body.classList.remove("diagnostic-analysis-open");
    const root = document.querySelector<HTMLElement>("#app");
    if (root !== null) root.inert = false;
    window.setTimeout(() => {
      if (sourceDialogToRestore !== null && !sourceDialogToRestore.open) {
        sourceDialogToRestore.showModal();
      }
      if (analysisOpener?.isConnected === true
        && (sourceDialogToRestore === null || sourceDialogToRestore.open)) {
        analysisOpener.focus({ preventScroll: true });
      } else {
        document.querySelector<HTMLTextAreaElement>("#keyboard-capture")
          ?.focus({ preventScroll: true });
      }
      analysisOpener = null;
      sourceDialogToRestore = null;
    }, 0);
  };

  const close = (): void => {
    if (host.hidden || host.classList.contains("closing")) return;
    host.classList.remove("open");
    host.classList.add("closing");
    if (closingTimer !== null) window.clearTimeout(closingTimer);
    closingTimer = window.setTimeout(finishClose, ANALYSIS_ANIMATION_MS);
  };

  const open = (initialTab?: DiagnosticTab): void => {
    if (closingTimer !== null) {
      window.clearTimeout(closingTimer);
      closingTimer = null;
    }
    model = options.getModel();
    applyAnalysisState(openDiagnosticAnalysisState(
      loadPreferences(options.storage),
      initialTab,
    ));
    analysisOpener = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const root = document.querySelector<HTMLElement>("#app");
    if (root !== null) root.inert = true;
    const sourceDialog = document.querySelector<HTMLDialogElement>("#information-dialog");
    sourceDialogToRestore = sourceDialog?.open ? sourceDialog : null;
    if (sourceDialogToRestore !== null) sourceDialogToRestore.close();
    document.body.classList.add("diagnostic-analysis-open");
    host.hidden = false;
    host.classList.remove("closing");
    render();
    window.requestAnimationFrame(() => {
      host.classList.add("open");
      const board = host.querySelector<HTMLElement>(".diagnostic-keyboard-board");
      if (board !== null) animateKeyboardRise(board);
      host.querySelector<HTMLButtonElement>(".diagnostic-analysis-close")
        ?.focus({ preventScroll: true });
    });
  };

  host.onclick = (event) => {
    const target = event.target instanceof Element
      ? event.target.closest<HTMLElement>("[data-action]")
      : null;
    if (target === null) return;
    const action = target.dataset.action;
    if (action === "close-analysis") {
      close();
      return;
    }
    if (action === "select-tab") {
      const tab = target.dataset.tab;
      if (!isDiagnosticTab(tab)) return;
      activateTab(tab);
      return;
    }
    if (action === "select-key") {
      const tokenId = target.dataset.token ?? null;
      state = {
        ...state,
        selectedKey: state.selectedKey === tokenId ? null : tokenId,
        selectedRelationId: null,
      };
      render();
      return;
    }
    if (action === "select-relation") {
      const relationId = target.dataset.id ?? null;
      state = { ...state, selectedRelationId: relationId };
      render();
      return;
    }
    if (action === "key-sort") {
      const value = target.dataset.value;
      if (value !== "error-ratio" && value !== "timing") return;
      preferences = { ...preferences, keySort: value };
      persist();
      render();
      return;
    }
    if (action === "toggle-network") {
      applyAnalysisState(toggleDiagnosticNetwork({
        preferences,
        selection: state,
      }));
      persist();
      render();
    }
  };

  host.onkeydown = (event) => {
    if (!(event.target instanceof HTMLButtonElement) || event.target.getAttribute("role") !== "tab") return;
    const tab = event.target.dataset.tab;
    if (!isDiagnosticTab(tab)) return;
    const currentIndex = DIAGNOSTIC_TABS.indexOf(tab);
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % DIAGNOSTIC_TABS.length;
    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + DIAGNOSTIC_TABS.length) % DIAGNOSTIC_TABS.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = DIAGNOSTIC_TABS.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    activateTab(DIAGNOSTIC_TABS[nextIndex]!);
  };

  const interceptEscape = (event: KeyboardEvent): void => {
    if (host.hidden || event.key !== "Escape") return;
    event.preventDefault();
    event.stopImmediatePropagation();
    close();
  };
  window.addEventListener("keydown", interceptEscape, { capture: true });

  return {
    open,
    close,
    destroy(): void {
      window.removeEventListener("keydown", interceptEscape, { capture: true });
      if (closingTimer !== null) window.clearTimeout(closingTimer);
      const root = document.querySelector<HTMLElement>("#app");
      if (root !== null) root.inert = false;
      document.body.classList.remove("diagnostic-analysis-open");
      host.remove();
    },
  };
}
