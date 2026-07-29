import "./style.css";
import {
  bindBackupFileInputReset,
  bindProductionInspectionBoundary,
} from "./browser-boundaries.js";
import { mountDiagnosticEnhancement } from "./diagnostic-enhancement.js";
import {
  recoverLocalPersistenceTransaction,
} from "./persistence-transaction.js";
import { planBalancedPracticeLines } from "./presentation-model.js";

const RECOVERY_NOTICE_MESSAGES = new Set([
  "舊版或無效的本機進度已刪除，已從新的進度世代重新開始。",
  "舊版或無效的 Pilot 歷史已刪除；目前世代可由有效完成摘要補齊。",
]);

const productionBuild = (import.meta as ImportMeta & {
  readonly env: { readonly PROD: boolean };
}).env.PROD;
const unmountInspectionBoundary = bindProductionInspectionBoundary(
  window,
  productionBuild,
);
try {
  recoverLocalPersistenceTransaction(localStorage);
} catch {
  // Storage may be blocked. The main app retains its existing degraded-session
  // handling and will surface the relevant warning after it mounts.
}

function requirePracticeStage(): HTMLElement {
  const element = document.querySelector<HTMLElement>("#practice-stage");
  if (element === null) throw new Error("Missing practice stage after app mount");
  return element;
}

function mountRecoveryNoticeRetirement(): () => void {
  const region = document.querySelector<HTMLElement>("#notice-region");
  if (region === null) return () => {};

  const isRecoveryNotice = (notice: HTMLElement): boolean =>
    RECOVERY_NOTICE_MESSAGES.has(notice.textContent?.trim() ?? "");
  if (![...region.querySelectorAll<HTMLElement>(".notice")].some(isRecoveryNotice)) {
    return () => {};
  }

  let retired = false;
  const removeRecoveryNotices = (): void => {
    if (!retired) return;
    for (const notice of region.querySelectorAll<HTMLElement>(".notice")) {
      if (isRecoveryNotice(notice)) notice.remove();
    }
  };
  const observer = new MutationObserver(removeRecoveryNotices);
  observer.observe(region, { childList: true });
  const timer = window.setTimeout(() => {
    retired = true;
    removeRecoveryNotices();
  }, 6000);

  return () => {
    window.clearTimeout(timer);
    observer.disconnect();
  };
}

async function mountBrowser(): Promise<void> {
  // The production function-key boundary and interrupted-write recovery must be
  // installed before main registers listeners or reads any local records.
  await import("./main.js");

  const unmountRecoveryNoticeRetirement = mountRecoveryNoticeRetirement();
  const stage = requirePracticeStage();
  let layoutFrame: number | null = null;
  let centerResizeObserver: ResizeObserver | null = null;

  function layoutPracticeRunway(): void {
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

  function schedulePracticeLayout(): void {
    if (layoutFrame !== null) window.cancelAnimationFrame(layoutFrame);
    layoutFrame = window.requestAnimationFrame(() => {
      layoutFrame = null;
      layoutPracticeRunway();
    });
  }

  function connectPracticeCenter(): void {
    centerResizeObserver?.disconnect();
    centerResizeObserver = null;
    if (layoutFrame !== null) {
      window.cancelAnimationFrame(layoutFrame);
      layoutFrame = null;
    }

    layoutPracticeRunway();
    const center = stage.querySelector<HTMLElement>(".practice-center");
    if (center === null || typeof ResizeObserver === "undefined") return;
    centerResizeObserver = new ResizeObserver(schedulePracticeLayout);
    centerResizeObserver.observe(center);
  }

  const stageObserver = new MutationObserver(connectPracticeCenter);
  stageObserver.observe(stage, { childList: true });
  connectPracticeCenter();
  void document.fonts.ready.then(schedulePracticeLayout);
  const unmountDiagnostics = mountDiagnosticEnhancement();
  const unmountBackupInputReset = bindBackupFileInputReset(document);

  window.addEventListener("beforeunload", () => {
    stageObserver.disconnect();
    centerResizeObserver?.disconnect();
    unmountDiagnostics();
    unmountBackupInputReset();
    unmountRecoveryNoticeRetirement();
    unmountInspectionBoundary();
    if (layoutFrame !== null) window.cancelAnimationFrame(layoutFrame);
  }, { once: true });
}

void mountBrowser();
