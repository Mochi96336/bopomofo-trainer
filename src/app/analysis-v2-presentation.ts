import type { TokenId } from "../core/model.js";
import { tokenLabel } from "../diagnostics/labels.js";
import { sparklinePoints } from "./practice-sparkline.js";
import type { AnalysisV2Model } from "./analysis-v2-model.js";

const TAB_ORDER = ["coordination", "semantic", "strategy"] as const;
const TREND_WIDTH = 168;
const TREND_HEIGHT = 40;
const TREND_PAD = 4;

export interface AnalysisV2Presentation {
  refresh(): void;
  destroy(): void;
}

function setText(element: Element | null, value: string): void {
  if (element !== null && element.textContent !== value) element.textContent = value;
}

function renderTrend(
  label: string,
  values: readonly number[],
  formatValue: (value: number) => string,
): string {
  if (values.length < 2) return "";
  const points = sparklinePoints(values, TREND_WIDTH, TREND_HEIGHT, TREND_PAD);
  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ");
  const last = points.at(-1)!;
  return `<div class="analysis-v2-trend-chart">
    <div class="analysis-v2-trend-heading"><span>${label}</span><strong>${formatValue(values.at(-1)!)}</strong></div>
    <svg viewBox="0 0 ${TREND_WIDTH} ${TREND_HEIGHT}" preserveAspectRatio="none" aria-hidden="true">
      <line x1="${TREND_PAD}" y1="${TREND_HEIGHT - TREND_PAD}" x2="${TREND_WIDTH - TREND_PAD}" y2="${TREND_HEIGHT - TREND_PAD}"></line>
      <path d="${path}"></path>
      <circle cx="${last.x.toFixed(1)}" cy="${last.y.toFixed(1)}" r="2.5"></circle>
    </svg>
  </div>`;
}

function reorderTabs(host: HTMLElement): void {
  const tabs = host.querySelector<HTMLElement>(".analysis-v2-tabs");
  if (tabs === null) return;
  const ordered = TAB_ORDER
    .map((tab) => tabs.querySelector<HTMLButtonElement>(`[data-tab="${tab}"]`))
    .filter((button): button is HTMLButtonElement => button !== null);
  if (ordered.length !== TAB_ORDER.length) return;
  const current = [...tabs.querySelectorAll<HTMLButtonElement>(":scope > [role='tab']")];
  if (current.every((button, index) => button === ordered[index])) return;
  const fragment = document.createDocumentFragment();
  for (const button of ordered) fragment.append(button);
  tabs.append(fragment);
}

function relabelStrategySegments(host: HTMLElement): void {
  const labels: Record<string, { text: string; title: string }> = {
    "2": { text: "2 個注音", title: "音節本體有 2 個注音成分，不含聲調" },
    "3": { text: "3 個注音", title: "音節本體有 3 個注音成分，不含聲調" },
    "4+": { text: "4+ 個注音", title: "音節本體有 4 個以上注音成分，不含聲調" },
  };
  for (const button of host.querySelectorAll<HTMLButtonElement>('[data-action="strategy-size"]')) {
    const label = labels[button.dataset.value ?? ""];
    if (label === undefined) continue;
    setText(button, label.text);
    if (button.title !== label.title) button.title = label.title;
  }
  const group = host.querySelector<HTMLElement>(".analysis-v2-strategy-segments");
  if (group !== null && group.getAttribute("aria-label") !== "音節內注音成分數，不含聲調") {
    group.setAttribute("aria-label", "音節內注音成分數，不含聲調");
  }
}

function semanticTrends(host: HTMLElement, model: AnalysisV2Model): void {
  const selected = host.querySelector<HTMLElement>('.analysis-v2-semantic-stage [data-action="select-key"].selected');
  const inspector = host.querySelector<HTMLElement>(".analysis-v2-semantic-stage .analysis-v2-inspector-content");
  if (selected === null || inspector === null) return;
  const tokenId = selected.dataset.token as TokenId | undefined;
  if (tokenId === undefined) return;
  const progress = model.semantic.keyProgress[tokenId];
  const correctness = progress?.correctness.points.slice(-10).map((point) => point.value * 100) ?? [];
  const timing = progress?.timing.points.slice(-10).map((point) => point.value) ?? [];
  const signature = `${tokenId}:${correctness.join(",")}:${timing.join(",")}`;
  const existing = inspector.querySelector<HTMLElement>(".analysis-v2-trends");
  if (existing?.dataset.signature === signature) return;
  existing?.remove();
  const markup = [
    renderTrend("錯誤觀察", correctness, (value) => `${Math.round(value)}%`),
    renderTrend("鍵間時間", timing, (value) => `${Math.round(value)} ms`),
  ].filter(Boolean).join("");
  for (const paragraph of inspector.querySelectorAll<HTMLParagraphElement>("p")) {
    if (paragraph.textContent?.startsWith("錯誤趨勢") || paragraph.textContent?.startsWith("時間趨勢")) {
      paragraph.hidden = true;
    }
  }
  if (markup === "") return;
  const trends = document.createElement("section");
  trends.className = "analysis-v2-trends";
  trends.dataset.signature = signature;
  trends.setAttribute("aria-label", `${tokenLabel(tokenId)} 的歷史趨勢`);
  trends.innerHTML = markup;
  inspector.append(trends);
}

function speedTrend(host: HTMLElement, model: AnalysisV2Model): void {
  const selected = host.querySelector<SVGPathElement>(".analysis-v2-speed-path.selected");
  const inspector = host.querySelector<HTMLElement>(".analysis-v2-speed-inspector .analysis-v2-inspector-content");
  if (selected === null || inspector === null) return;
  const id = selected.dataset.speedId;
  const cell = model.coordination.immediateTokens.find((candidate) => candidate.id === id);
  if (cell === undefined) return;
  const values = cell.history.slice(-10).map((point) => point.representativeTimingMs);
  const signature = `${cell.id}:${values.join(",")}`;
  const existing = inspector.querySelector<HTMLElement>(".analysis-v2-trends");
  if (existing?.dataset.signature === signature) return;
  existing?.remove();
  const markup = renderTrend("歷史鍵間時間", values, (value) => `${Math.round(value)} ms`);
  if (markup === "") return;
  const trends = document.createElement("section");
  trends.className = "analysis-v2-trends";
  trends.dataset.signature = signature;
  trends.setAttribute("aria-label", "選取轉換的歷史鍵間時間");
  trends.innerHTML = markup;
  inspector.append(trends);
}

function normalizeAnalysis(host: HTMLElement, model: AnalysisV2Model): void {
  setText(host.querySelector("#analysis-v2-title"), "分析");
  reorderTabs(host);
  relabelStrategySegments(host);
  semanticTrends(host, model);
  speedTrend(host, model);
}

export function normalizeAnalysisV2Summary(section: HTMLElement): void {
  setText(section.querySelector(".analysis-v2-summary-heading h3"), "分析");
  const signals = section.querySelector<HTMLElement>(".analysis-v2-summary-signals");
  if (signals !== null && signals.getAttribute("aria-label") !== "分析摘要") {
    signals.setAttribute("aria-label", "分析摘要");
  }
}

export function mountAnalysisV2Presentation(
  host: HTMLElement,
  getModel: () => AnalysisV2Model,
): AnalysisV2Presentation {
  let frame: number | null = null;
  const refresh = (): void => {
    if (frame !== null) window.cancelAnimationFrame(frame);
    frame = null;
    normalizeAnalysis(host, getModel());
  };
  const schedule = (): void => {
    if (frame !== null) return;
    frame = window.requestAnimationFrame(refresh);
  };
  const observer = new MutationObserver(schedule);
  observer.observe(host, { childList: true, subtree: true });

  const tabNavigation = (event: KeyboardEvent): void => {
    const target = event.target instanceof HTMLButtonElement ? event.target : null;
    if (target?.getAttribute("role") !== "tab") return;
    const tab = target.dataset.tab as (typeof TAB_ORDER)[number] | undefined;
    if (tab === undefined || !TAB_ORDER.includes(tab)) return;
    const current = TAB_ORDER.indexOf(tab);
    let next: number | null = null;
    if (event.key === "ArrowRight") next = (current + 1) % TAB_ORDER.length;
    if (event.key === "ArrowLeft") next = (current - 1 + TAB_ORDER.length) % TAB_ORDER.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = TAB_ORDER.length - 1;
    if (next === null) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const nextButton = host.querySelector<HTMLButtonElement>(`[data-tab="${TAB_ORDER[next]}"]`);
    nextButton?.click();
    nextButton?.focus();
  };
  host.addEventListener("keydown", tabNavigation, { capture: true });

  return {
    refresh,
    destroy(): void {
      if (frame !== null) window.cancelAnimationFrame(frame);
      observer.disconnect();
      host.removeEventListener("keydown", tabNavigation, { capture: true });
    },
  };
}
