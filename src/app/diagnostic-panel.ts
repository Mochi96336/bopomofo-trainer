import "./diagnostics.css";
import "./diagnostic-polish.css";
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
import {
  openDiagnosticAnalysisState,
  selectDiagnosticAnalysisTab,
  toggleDiagnosticNetwork,
  type DiagnosticAnalysisSelection,
  type DiagnosticAnalysisState,
} from "./diagnostic-analysis-state.js";
import {
  confusionDetailMarkup,
  keyDetailMarkup,
  transitionDetailMarkup,
} from "./diagnostic-detail.js";
import { milliseconds, percent } from "./diagnostic-format.js";
import { keyboardMarkup } from "./diagnostic-keyboard.js";
import {
  DEFAULT_DIAGNOSTIC_PREFERENCES,
  loadDiagnosticPreferences,
  saveDiagnosticPreferences,
  type DiagnosticPreferenceStorage,
  type DiagnosticPreferences,
  type DiagnosticTab,
} from "./diagnostic-preferences.js";
import {
  confusionEmptyMessage,
  confusionListRowMarkup,
  confusionRows,
  keyListRowMarkup,
  keyRows,
  transitionEmptyMessage,
  transitionListRowMarkup,
  transitionRows,
} from "./diagnostic-rows.js";
import {
  captureFocusIdentity,
  restoreFocusIdentity,
} from "./focus-preservation.js";
import { escapeHtml } from "./html.js";
const DIAGNOSTIC_TABS = ["key", "transition", "confusion"] as const;
const ANALYSIS_ANIMATION_MS = 180;
const KEYBOARD_TILT = "perspective(520px) rotateX(19deg)";

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

export interface DiagnosticAnalysisController {
  /**
   * The element this controller created and owns. Handed over so a caller that
   * needs to wrap or observe it does not have to find it again by id.
   */
  readonly host: HTMLElement;
  open(initialTab?: DiagnosticTab): void;
  close(): void;
  destroy(): void;
}

export interface DiagnosticAnalysisOptions {
  readonly getModel: () => DiagnosticModel;
  readonly storage: DiagnosticPreferenceStorage;
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
      ? "按下各鍵前的有效輸入間隔；音節起始、誤按、修正與干擾不計。"
      : "錯誤輸入占已記錄輸入的比例；修正後的正確輸入也會計入。";
  }
  return preferences.activeTab === "transition"
    ? "同音節相鄰鍵的輸入間隔；僅計正確且連續的輸入。"
    : "應按的鍵被誤按成哪一鍵；反向另計。";
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

function inspectorHeadMarkup(preferences: DiagnosticPreferences): string {
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
      ${inspectorHeadMarkup(preferences)}
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
      ${inspectorHeadMarkup(preferences)}
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
    ${inspectorHeadMarkup(preferences)}
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
    host,
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
