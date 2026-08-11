import "./style.css";
import {
  bindBackupFileInputReset,
  bindProductionInspectionBoundary,
} from "./browser-boundaries.js";
import { createApp, type App } from "./create-app.js";
import { mountAnalysisV2Integration } from "./analysis-v2-integration.js";
import {
  recoverLocalPersistenceTransaction,
} from "./persistence-transaction.js";
import { planBalancedPracticeLines } from "./presentation-model.js";

/**
 * The page's entry point, and the only place the running app is assembled.
 *
 * The shell used to start itself as a side effect of being imported, which left
 * this file with no way to sequence anything around it: the boundary and the
 * interrupted-write recovery had to be installed first, so the import had to be
 * dynamic and awaited, and everything this file adds afterwards had to find the
 * app again through the document. `createApp` is a call, so the order below is
 * simply the order it is written in.
 */

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) throw new Error(`Missing required element: ${selector}`);
  return element;
}

function newSeed(): string {
  return globalThis.crypto?.randomUUID?.() ?? `local-${Date.now().toString(36)}`;
}

const productionBuild = (import.meta as ImportMeta & {
  readonly env: { readonly PROD: boolean };
}).env.PROD;

// Both must be in place before the app registers a listener or reads a local
// record, which is now guaranteed by standing above the `createApp` call.
const unmountInspectionBoundary = bindProductionInspectionBoundary(
  window,
  productionBuild,
);
try {
  recoverLocalPersistenceTransaction(localStorage);
} catch {
  // Storage may be blocked. The app retains its existing degraded-session
  // handling and will surface the relevant warning after it mounts.
}

let layoutFrame: number | null = null;
let centerResizeObserver: ResizeObserver | null = null;

/**
 * Breaks the utterance into balanced lines once its entries can be measured.
 *
 * This is why the browser layer needs to know when a round was mounted: the
 * widths only exist after the shell has put the entries in the document.
 */
function layoutPracticeRunway(stage: HTMLElement): void {
  const center = stage.querySelector<HTMLElement>(".practice-center");
  const runway = center?.querySelector<HTMLElement>(".utterance-runway") ?? null;
  if (center === null || runway === null) return;

  const entries = [...runway.querySelectorAll<HTMLElement>(".practice-entry")]
    .sort((left, right) =>
      Number(left.dataset.entryIndex) - Number(right.dataset.entryIndex)
    );
  if (entries.length === 0) return;

  runway.style.removeProperty("width");
  runway.replaceChildren(...entries);
  const maxLineWidth = center.clientWidth;
  if (maxLineWidth <= 0) return;

  const entryWidths = entries.map((entry) => entry.getBoundingClientRect().width);
  const lines = planBalancedPracticeLines(entryWidths, maxLineWidth);
  const plannedWidth = Math.min(
    maxLineWidth,
    Math.max(...lines.map((line) => line.width)),
  );
  runway.style.width = `${Math.ceil(plannedWidth)}px`;
  runway.dataset.lineCount = String(lines.length);

  const fragment = document.createDocumentFragment();
  for (const line of lines) {
    const lineElement = document.createElement("div");
    lineElement.className = "practice-line";
    lineElement.setAttribute("role", "presentation");
    lineElement.append(
      ...entries.slice(line.startEntryIndex, line.endEntryIndex),
    );
    fragment.append(lineElement);
  }
  runway.replaceChildren(fragment);
}

function connectPracticeCenter(stage: HTMLElement): void {
  centerResizeObserver?.disconnect();
  centerResizeObserver = null;
  if (layoutFrame !== null) {
    window.cancelAnimationFrame(layoutFrame);
    layoutFrame = null;
  }

  layoutPracticeRunway(stage);
  const center = stage.querySelector<HTMLElement>(".practice-center");
  if (center === null || typeof ResizeObserver === "undefined") return;
  centerResizeObserver = new ResizeObserver(() => {
    if (layoutFrame !== null) window.cancelAnimationFrame(layoutFrame);
    layoutFrame = window.requestAnimationFrame(() => {
      layoutFrame = null;
      layoutPracticeRunway(stage);
    });
  });
  centerResizeObserver.observe(center);
}

// Analysis V2 needs handles the app only has once it exists, and the app needs
// somewhere to report information-panel renders. The indirection is one variable
// wide: nothing calls through it before `createApp` has returned.
let app: App | null = null;

const analysisV2 = mountAnalysisV2Integration({
  closePanel: () => app?.closePanel(),
  focusPractice: () => app?.focusPractice(),
  getSnapshot: () => app?.getAnalysisV2Snapshot() ?? null,
  storage: localStorage,
});

app = createApp({
  root: requireElement<HTMLDivElement>("#app"),
  capture: requireElement<HTMLTextAreaElement>("#keyboard-capture"),
  storage: localStorage,
  newSeed,
  onRoundMounted: connectPracticeCenter,
  onPanelRendered: (content) => analysisV2.panelRendered(content),
});

// Fonts change the measurements the line plan was built from, so the first
// round is laid out again once they have settled.
void document.fonts.ready.then(() => {
  const stage = document.querySelector<HTMLElement>("#practice-stage");
  if (stage !== null) layoutPracticeRunway(stage);
});

const unmountBackupInputReset = bindBackupFileInputReset(document);

window.addEventListener("beforeunload", () => {
  app?.destroy();
  centerResizeObserver?.disconnect();
  analysisV2.destroy();
  unmountBackupInputReset();
  unmountInspectionBoundary();
  if (layoutFrame !== null) window.cancelAnimationFrame(layoutFrame);
}, { once: true });
