import "./analysis-v2.css";
import "./analysis-v2-hierarchy.css";
import type { TokenId } from "../core/model.js";
import type { CoordinationBodySizeBucket } from "../measurement-v2/aggregate.js";
import { renderAnalysisV2Coordination } from "./analysis-v2-coordination-renderer.js";
import type { AnalysisV2Model } from "./analysis-v2-model.js";
import { renderAnalysisV2Semantic } from "./analysis-v2-semantic-renderer.js";
import { mountAnalysisV2SpeedPreview } from "./analysis-v2-speed-preview.js";
import {
  ANALYSIS_V2_TABS,
  isAnalysisV2CoordinationView,
  isAnalysisV2SemanticView,
  isAnalysisV2Tab,
  loadAnalysisV2Preferences,
  saveAnalysisV2Preferences,
  type AnalysisV2CoordinationView,
  type AnalysisV2Preferences,
  type AnalysisV2PreferenceStorage,
  type AnalysisV2SemanticView,
  type AnalysisV2Tab,
} from "./analysis-v2-state.js";
import { renderAnalysisV2Strategy } from "./analysis-v2-strategy-renderer.js";

export type {
  AnalysisV2PreferenceStorage,
  AnalysisV2Tab,
} from "./analysis-v2-state.js";
export { renderAnalysisV2Summary } from "./analysis-v2-summary.js";

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

function isBodySize(value: unknown): value is CoordinationBodySizeBucket {
  return value === "2" || value === "3";
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

function bodyMarkup(
  model: AnalysisV2Model,
  tab: AnalysisV2Tab,
  preferences: AnalysisV2Preferences,
  selectedKey: TokenId | null,
  selectedPathId: string | null,
  strategyBodySize: CoordinationBodySizeBucket,
  coordinationView: AnalysisV2CoordinationView,
): string {
  if (tab === "coordination") {
    return renderAnalysisV2Coordination(model, selectedPathId, coordinationView);
  }
  if (tab === "strategy") return renderAnalysisV2Strategy(model, strategyBodySize);
  return renderAnalysisV2Semantic(model, preferences, selectedKey);
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
  let preferences = loadAnalysisV2Preferences(options.storage);
  let selectedKey: TokenId | null = null;
  let selectedSpeedPathId: string | null = null;
  let strategyBodySize: CoordinationBodySizeBucket = "3";
  let coordinationView: AnalysisV2CoordinationView = "paths";
  let openFrame: number | null = null;
  const speedPreview = mountAnalysisV2SpeedPreview(host, options.getModel);
  const persist = () => saveAnalysisV2Preferences(options.storage, preferences);

  const cancelOpenFrame = (): void => {
    if (openFrame === null) return;
    window.cancelAnimationFrame(openFrame);
    openFrame = null;
  };

  const focusSemanticView = (value: AnalysisV2SemanticView): void => {
    host.querySelector<HTMLButtonElement>(
      `[data-action="semantic-view"][data-value="${value}"]`,
    )?.focus();
  };

  const focusCoordinationView = (value: AnalysisV2CoordinationView): void => {
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

  const render = (preserveScroll = true): void => {
    const previousMain = host.querySelector<HTMLElement>(".analysis-v2-main");
    const scrollTop = preserveScroll ? previousMain?.scrollTop ?? 0 : 0;
    const scrollLeft = preserveScroll ? previousMain?.scrollLeft ?? 0 : 0;
    const activeTab = preferences.activeTab;
    host.innerHTML = `<div class="analysis-v2-shell"><header class="analysis-v2-header"><div><h2 id="analysis-v2-title">分析</h2></div><div class="analysis-v2-header-actions"><div class="analysis-v2-tabs" role="tablist" aria-label="分析類型">${ANALYSIS_V2_TABS.map((tab) => `<button id="${tabId(tab)}" type="button" role="tab" data-action="select-tab" data-tab="${tab}" aria-controls="${tabPanelId(tab)}" aria-selected="${activeTab === tab}" tabindex="${activeTab === tab ? 0 : -1}">${tabLabel(tab)}</button>`).join("")}</div><button type="button" class="analysis-v2-close" data-action="close-analysis" aria-label="Esc，返回練習">Esc</button></div></header><main class="analysis-v2-main">${ANALYSIS_V2_TABS.map((tab) => `<section id="${tabPanelId(tab)}" role="tabpanel" aria-labelledby="${tabId(tab)}"${activeTab === tab ? "" : " hidden"}>${activeTab === tab ? bodyMarkup(model, tab, preferences, selectedKey, selectedSpeedPathId, strategyBodySize, coordinationView) : ""}</section>`).join("")}</main></div>`;
    const nextMain = host.querySelector<HTMLElement>(".analysis-v2-main");
    if (nextMain !== null) {
      nextMain.scrollTop = scrollTop;
      nextMain.scrollLeft = scrollLeft;
    }
    speedPreview.syncPinned(selectedSpeedPathId);
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
    const loaded = loadAnalysisV2Preferences(options.storage);
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

  const click = (event: MouseEvent): void => {
    const target = event.target instanceof Element
      ? event.target.closest<HTMLElement | SVGElement>("[data-action]")
      : null;
    if (target === null) return;
    if (target.dataset.action === "close-analysis") {
      close();
      return;
    }
    if (target.dataset.action === "select-tab") {
      const tab = target.dataset.tab;
      if (isAnalysisV2Tab(tab)) selectTab(tab);
      return;
    }
    if (target.dataset.action === "semantic-view") {
      const value = target.dataset.value;
      if (isAnalysisV2SemanticView(value)) {
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
      if (isAnalysisV2CoordinationView(value)) {
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
        selectedKey = selectedKey === token ? null : token as TokenId;
        render();
        focusSemanticKey(token as TokenId);
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
        host.querySelector<HTMLButtonElement>(
          `[data-action="strategy-size"][data-value="${value}"]`,
        )?.focus();
      }
    }
  };

  const keydown = (event: KeyboardEvent): void => {
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
    if (!isAnalysisV2Tab(tab)) return;
    const current = ANALYSIS_V2_TABS.indexOf(tab);
    let next: number | null = null;
    if (event.key === "ArrowRight") next = (current + 1) % ANALYSIS_V2_TABS.length;
    if (event.key === "ArrowLeft") next = (current - 1 + ANALYSIS_V2_TABS.length) % ANALYSIS_V2_TABS.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = ANALYSIS_V2_TABS.length - 1;
    if (next !== null) {
      event.preventDefault();
      selectTab(ANALYSIS_V2_TABS[next]!);
    }
  };

  const interceptEscape = (event: KeyboardEvent): void => {
    if (!host.hidden && event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
    }
  };

  host.addEventListener("click", click);
  host.addEventListener("keydown", keydown);
  window.addEventListener("keydown", interceptEscape, { capture: true });

  return {
    host,
    open,
    close,
    destroy(): void {
      cancelOpenFrame();
      speedPreview.destroy();
      host.removeEventListener("click", click);
      host.removeEventListener("keydown", keydown);
      window.removeEventListener("keydown", interceptEscape, { capture: true });
      host.remove();
    },
  };
}
