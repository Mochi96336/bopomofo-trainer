import "./style.css";
import {
  catalogEntryCommonnessTier,
  COMMONNESS_TIERS,
  COMMONNESS_TIER_LABELS,
  commonnessTierShareLabel,
  type CommonnessTier,
} from "../commonness/tiers.js";
import { commonnessDotsMarkup, commonnessTierLabel } from "./commonness-display.js";
import {
  catalogsForCommonnessTiers,
  effectiveCommonnessTiers,
  nextCommonnessUnlock,
  practisedKeyCount,
  requiredPractisedKeys,
  unlockedCommonnessTiers,
} from "../product/commonness-access.js";
import type { TokenId } from "../core/model.js";
import { physicalKeyLabel, tokenLabel } from "../diagnostics/labels.js";
import { createProductBackup, parseProductBackup, type ProductBackup } from "./backup.js";
import { runBackupImport } from "./backup-import.js";
import { backupSummaryLabel, summariseBackup } from "./backup-summary.js";
import { clearLocalRecords } from "./clear-local-records.js";
import {
  createConfirmDialog,
  type ConfirmDialogOptions,
} from "./confirm-dialog.js";
import {
  appendPilotRoundRecord,
  createPilotRoundRecord,
  pilotHistoryFromProgress,
  type PilotHistory,
  type PilotRoundRecord,
} from "../product/pilot-history.js";
import {
  applyProductInput,
  createFreshProgressForEnvironment,
  createProductEnvironment,
  createProductState,
  startNextProductRound,
} from "../product/session.js";
import type {
  ProductCatalogs,
  ProductEnvironment,
  ProductProgress,
  ProductState,
} from "../product/types.js";
import { STANDARD_BOPOMOFO_LAYOUT } from "../scheme/standard-layout.js";
import {
  COMMONNESS_TIER_THRESHOLDS,
  EVALUATION_CATALOG,
  PRACTICE_CATALOG,
  SYNTAX_PROFILES,
} from "./generated/catalog.js";
import {
  isInspectionAdvanceShortcut,
  isInspectionCompleteShortcut,
  isInspectionUnlockShortcut,
  keyboardEventToInput,
} from "./keyboard-adapter.js";
import { saveLocalPilotHistory } from "./pilot-history.js";
import { saveLocalProductProgress } from "./local-progress.js";
import { saveLocalProgressHistory } from "./local-progress-history.js";
import { appendRoundToProgressHistory, createEmptyProgressHistory } from "../progress-history/update.js";
import type { ProgressHistory } from "../progress-history/types.js";
import {
  buildPracticeEntries,
  continuousExerciseText,
} from "./presentation-model.js";
import {
  DEFAULT_SELECTION_TUNING,
  loadSelectionTuning,
  policyForSelectionTuning,
  saveSelectionTuning,
  type SelectionTuning,
} from "./selection-tuning.js";
import { applyTheme, DEFAULT_THEME, loadTheme, saveTheme, type Theme } from "./theme.js";
import { practiceCurrentSyllableText } from "./practice-accessibility.js";
import {
  currentPracticeView,
  errorCanonicalTokenIndex,
  inspectionNextToken,
  isMappedPracticeAttempt,
  isMappedPracticeError,
  syllableState,
  tokenState,
  type PracticeTokenState,
} from "./practice-session-view.js";
import {
  captureFocusIdentity,
  restoreFocusIdentity,
  type FocusIdentity,
} from "./focus-preservation.js";
import { escapeHtml } from "./html.js";
import {
  actionApplied,
  actionFailed,
  NO_ACTION_STATUS,
  panelActionStatusMarkup,
  rarityProgressText,
  type PanelActionStatus,
} from "./information-panel-model.js";
import type { AnalysisV2Snapshot } from "./analysis-v2-snapshot.js";
import { createExpiringValue } from "./expiring-value.js";
import {
  KEYBOARD_GEOMETRY_ROWS,
  keyboardColumnSpan,
} from "./keyboard-geometry.js";
import { loadAppState } from "./load-app-state.js";
import type { StorageLike } from "./persistence-transaction.js";
import { renderTrendSection } from "./practice-sparkline.js";

const UNLOCK_NOTICE_MS = 6000;
const PREVIOUS_RESULT_MS = 1400;
const RECOVERY_NOTICE_MS = 6000;
const PROGRESS_MIGRATION_NOTICE =
  "舊版量測已切換到新的輸入模型；舊量測證據已刪除，其他可相容的本機進度已保留。";
const PROGRESS_INVALID_NOTICE =
  "無效的本機進度已刪除，已重新建立新的練習進度。";
const PILOT_RECOVERY_NOTICE =
  "舊版或無效的 Pilot 歷史已刪除；目前世代可由有效完成摘要補齊。";

type VisualState = "done" | "current" | "upcoming";

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) throw new Error(`Missing required element: ${selector}`);
  return element;
}

export interface AppDependencies {
  readonly root: HTMLElement;
  readonly capture: HTMLTextAreaElement;
  readonly storage: StorageLike;
  readonly newSeed: () => string;
  readonly onRoundMounted?: (stage: HTMLElement) => void;
  readonly onPanelRendered?: (content: HTMLElement) => void;
}

export interface App {
  closePanel(): void;
  focusPractice(): void;
  getAnalysisV2Snapshot(): AnalysisV2Snapshot;
  destroy(): void;
}

export function createApp(deps: AppDependencies): App {
  const { root, capture, storage, newSeed, onRoundMounted, onPanelRendered } = deps;
  const eventScope = new AbortController();

  const catalogs = {
    practice: PRACTICE_CATALOG,
    evaluation: EVALUATION_CATALOG,
    syntaxProfiles: SYNTAX_PROFILES,
  } as const;

  let selectionTuning: SelectionTuning = DEFAULT_SELECTION_TUNING;
  try {
    selectionTuning = loadSelectionTuning(storage);
  } catch {
    // Storage may be blocked; defaults still provide a complete local session.
  }
  let theme: Theme = DEFAULT_THEME;
  try {
    theme = loadTheme(storage);
  } catch {
    // Storage may be blocked; defaults still provide a complete local session.
  }
  applyTheme(theme);

  function environmentFor(source: ProductCatalogs): ProductEnvironment {
    return createProductEnvironment(source, policyForSelectionTuning(selectionTuning));
  }

  let storageEnvironment = environmentFor(catalogs);
  let environment = storageEnvironment;
  let unlockedTiers: readonly CommonnessTier[] = COMMONNESS_TIERS;
  let practisedTiers: readonly CommonnessTier[] = COMMONNESS_TIERS;
  let inspectionUnlockAll = false;

  const boot = loadAppState({
    storage,
    environment: storageEnvironment,
    mode: "guided",
    layoutId: STANDARD_BOPOMOFO_LAYOUT.id,
    newSeed,
  });
  const initialProgress = boot.progress;
  const loadedExistingProgress = boot.loadedExistingProgress;
  let storageWarning = boot.storageWarning;
  let pilotHistory: PilotHistory = boot.pilotHistory;
  let progressHistory: ProgressHistory = boot.progressHistory;

  syncPractisedLevels(initialProgress);
  let product: ProductState = createProductState(
    environment,
    initialProgress,
    performance.now(),
  );
  let compositionActive = false;
  let imeWarning = false;
  let showKeyboardSketch = false;
  let inspectionAdvanceCount = 0;
  let tuningStatus: PanelActionStatus = NO_ACTION_STATUS;
  let rarityStatus: PanelActionStatus = NO_ACTION_STATUS;
  let dataStatus: PanelActionStatus = NO_ACTION_STATUS;

  const unlockNotice = createExpiringValue<string>(window, () => renderNotices());
  const previousResult = createExpiringValue<PilotRoundRecord>(window, () => updateTopbar());
  const recoveryNotices = createExpiringValue<readonly string[]>(window, () => renderNotices());
  const confirmDialog = createConfirmDialog(document.body);

  function syncPractisedLevels(
    progress: ProductProgress,
    rebuildAlways = false,
  ): CommonnessTier | null {
    const unlocked = inspectionUnlockAll
      ? COMMONNESS_TIERS
      : unlockedCommonnessTiers(progress.measurements);
    const practised = effectiveCommonnessTiers(selectionTuning.rarityTiers, unlocked);
    const opened = unlocked.filter((tier) => !unlockedTiers.includes(tier)).at(-1) ?? null;
    const changed = practised.length !== practisedTiers.length
      || practised.some((tier, index) => tier !== practisedTiers[index]);
    unlockedTiers = unlocked;
    practisedTiers = practised;
    if (changed || rebuildAlways) environment = practiceEnvironment();
    return opened;
  }

  function practiceEnvironment(): ProductEnvironment {
    return environmentFor(
      catalogsForCommonnessTiers(catalogs, COMMONNESS_TIER_THRESHOLDS, practisedTiers),
    );
  }

  const reverseBindings = new Map<TokenId, string>();
  for (const [code, tokenId] of Object.entries(STANDARD_BOPOMOFO_LAYOUT.bindings)) {
    reverseBindings.set(tokenId, code);
  }

  function keyboardSketchMarkup(): string {
    return KEYBOARD_GEOMETRY_ROWS.map((row) => `<div class="keyboard-sketch-row">
      ${row.map((key) => `<span class="keyboard-sketch-key${key.units === undefined ? "" : " wide"}" data-code="${key.code}" style="--key-columns:${keyboardColumnSpan(key)}"></span>`).join("")}
    </div>`).join("");
  }

  function completedRoundCount(): number {
    return product.progress.practiceRoundsCompleted;
  }

  function currentRoundNumber(): number {
    return completedRoundCount() + 1;
  }

  function currentProgressPercent(): number {
    const total = product.session.plan.totalSlots;
    if (total === 0) return 100;
    return Math.round((product.session.completedCount / total) * 100);
  }

  function utteranceText(): string {
    const punctuation = product.round.selection.utterance.punctuation ?? "";
    return `${continuousExerciseText(product.round.exercise)}${punctuation}`;
  }

  function mappedRoundCounts(): { readonly attempts: number; readonly errors: number } {
    let attempts = 0;
    let errors = 0;
    for (const trace of product.session.traces) {
      if (!isMappedPracticeAttempt(trace)) continue;
      attempts += 1;
      if (isMappedPracticeError(trace)) errors += 1;
    }
    return { attempts, errors };
  }

  function accuracyLabel(attempts: number, errors: number): string {
    if (attempts === 0) return "—";
    return `${Math.round(((attempts - errors) / attempts) * 100)}%`;
  }

  function focusCapture(force = false): void {
    const dialog = document.querySelector<HTMLDialogElement>("#information-dialog");
    const confirming = document.querySelector<HTMLDialogElement>("#confirm-dialog")?.open === true;
    if (dialog?.open || confirming || imeWarning) return;
    const active = document.activeElement;
    if (!force && active !== null && active !== document.body && active !== capture) return;
    capture.focus({ preventScroll: true });
  }

  function mountShell(): void {
    root.innerHTML = `
      <main class="shell">
        <header class="topbar">
          <div class="wordmark" aria-label="注音鍵位練習">注音</div>
          <div class="topbar-actions">
            <div id="round-status" class="round-status" aria-live="polite"></div>
            <button id="open-information" class="information-button" type="button" aria-label="開啟練習資訊與設定" aria-keyshortcuts="Escape">i</button>
          </div>
        </header>
        <div id="notice-region" class="notice-region" aria-live="polite"></div>
        <section id="practice-stage" class="practice-stage" aria-label="注音語句練習區"></section>
        <dialog id="information-dialog" class="information-dialog" aria-labelledby="information-title">
          <div class="dialog-shell">
            <header class="dialog-header">
              <div class="dialog-title-row">
                <h2 id="information-title">設定與資料</h2>
                <div id="information-round-status" class="dialog-round-status" aria-live="polite"></div>
                <div id="information-commonness" class="dialog-commonness"></div>
              </div>
              <form method="dialog">
                <button class="dialog-close" type="button" aria-label="關閉設定面板">Esc</button>
              </form>
            </header>
            <div id="information-content" class="information-content"></div>
          </div>
        </dialog>
      </main>`;

    requireElement<HTMLButtonElement>("#open-information").addEventListener("click", openInformationPanel);
    const dialog = requireElement<HTMLDialogElement>("#information-dialog");
    requireElement<HTMLButtonElement>(".dialog-close").addEventListener("click", () => dialog.close());
    dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      dialog.close();
    });
    dialog.addEventListener("close", () => {
      clearPanelActionStatus();
      focusCapture(true);
    });
    dialog.addEventListener("click", (event) => {
      if (event.target !== dialog) return;
      const bounds = dialog.getBoundingClientRect();
      const outside = event.clientX < bounds.left
        || event.clientX > bounds.right
        || event.clientY < bounds.top
        || event.clientY > bounds.bottom;
      if (outside) dialog.close();
    });
    requireElement<HTMLElement>("#practice-stage").addEventListener("click", () => focusCapture(true));
  }

  function clearUnlockNotice(): void {
    unlockNotice.clear();
  }

  function showUnlockNotice(message: string): void {
    unlockNotice.set(message, UNLOCK_NOTICE_MS);
  }

  function renderNotices(): void {
    const notices = [
      unlockNotice.value ?? "",
      ...recoveryNotices.value ?? [],
      storageWarning,
    ].filter(Boolean);
    requireElement<HTMLElement>("#notice-region").innerHTML = notices.map((notice) =>
      `<div class="notice${notice === storageWarning && storageWarning ? " warning" : ""}">${escapeHtml(notice)}</div>`
    ).join("");
  }

  function practiceEntryMarkup(): string {
    const entries = buildPracticeEntries(product.round.exercise);
    const punctuation = product.round.selection.utterance.punctuation ?? "";
    let syllableOrdinal = 0;
    return entries.map((entry, entryIndex) => {
      const glyphs = entry.glyphs.map((glyph) => {
        const ordinal = syllableOrdinal;
        syllableOrdinal += 1;
        const reading = glyph.tokens.map((tokenId, canonicalTokenIndex) =>
          `<span class="reading-token upcoming" data-syllable-ordinal="${ordinal}" data-canonical-token-index="${canonicalTokenIndex}">${escapeHtml(tokenLabel(tokenId))}</span>`
        ).join("");
        return `<span class="practice-glyph upcoming" data-syllable-ordinal="${ordinal}">
          <span class="han-character">${escapeHtml(glyph.character)}</span>
          <span class="syllable-reading" aria-hidden="true">${reading}</span>
        </span>`;
      }).join("");
      const suffix = entryIndex === entries.length - 1 && punctuation
        ? `<span class="utterance-punctuation" aria-hidden="true">${escapeHtml(punctuation)}</span>`
        : "";
      return `<span class="practice-entry" data-entry-index="${entry.entryIndex}">${glyphs}${suffix}</span>`;
    }).join("");
  }

  function mountPracticeRound(animateRound = false): void {
    const stage = requireElement<HTMLElement>("#practice-stage");
    stage.innerHTML = `
      <div class="practice-center">
        <div class="utterance-runway" aria-label="${escapeHtml(utteranceText())}">
          ${practiceEntryMarkup()}
        </div>
        <div id="practice-feedback" class="practice-feedback" aria-live="polite"></div>
        <div class="progress-line" aria-hidden="true"><span id="progress-fill"></span></div>
        <div class="progress-caption"><span id="progress-count"></span></div>
        <div id="keyboard-sketch" class="keyboard-sketch" aria-hidden="true">
          <div class="keyboard-sketch-board">${keyboardSketchMarkup()}</div>
        </div>
      </div>`;
    updatePracticeState();

    if (animateRound) {
      stage.classList.remove("round-enter");
      void stage.offsetWidth;
      stage.classList.add("round-enter");
      stage.addEventListener("animationend", () => stage.classList.remove("round-enter"), { once: true });
    }
    onRoundMounted?.(stage);
  }

  function glyphVisualState(ordinal: number): VisualState {
    return syllableState(product.session, ordinal);
  }

  function applyVisualState(element: HTMLElement, state: VisualState): void {
    element.classList.remove("done", "current", "upcoming");
    element.classList.add(state);
    if (state === "current") element.setAttribute("aria-current", "true");
    else element.removeAttribute("aria-current");
  }

  function applyTokenState(element: HTMLElement, state: PracticeTokenState): void {
    element.classList.remove(
      "done",
      "current",
      "upcoming",
      "pending",
      "commit-locked",
      "commit-ready",
    );
    if (state === "done") element.classList.add("done");
    else if (state === "upcoming") element.classList.add("upcoming");
    else if (state === "pending") element.classList.add("current", "pending");
    else if (state === "commit-ready") element.classList.add("current", "commit-ready");
    else element.classList.add("upcoming", "commit-locked");
    if (state === "pending" || state === "commit-ready") {
      element.setAttribute("aria-current", "true");
    } else {
      element.removeAttribute("aria-current");
    }
  }

  function updatePracticeFeedback(): void {
    const feedback = requireElement<HTMLElement>("#practice-feedback");
    feedback.className = "practice-feedback";
    feedback.setAttribute("aria-live", "polite");

    if (imeWarning) {
      feedback.classList.add("ime");
      feedback.setAttribute("aria-live", "assertive");
      feedback.innerHTML = `<div class="ime-blocker" role="alert">
        <span>輸入暫停</span>
        <strong>偵測到中文輸入法</strong>
        <p>切換到英文鍵盤後直接繼續輸入。</p>
      </div>`;
      return;
    }

    const latest = product.session.traces.at(-1);
    if (latest?.outcome === "duplicate-component") {
      feedback.classList.add("error");
      feedback.setAttribute("aria-live", "assertive");
      feedback.textContent = `${latest.actualToken === null ? "這個鍵" : tokenLabel(latest.actualToken)} 已經輸入`;
      return;
    }
    if (latest?.outcome === "premature-tone") {
      feedback.classList.add("error");
      feedback.setAttribute("aria-live", "assertive");
      feedback.textContent = "先完成這個音節的注音，再輸入聲調";
      return;
    }
    if (latest?.outcome === "unexpected-tone" || latest?.outcome === "unexpected-component") {
      const actual = latest.actualToken === null ? "未映射鍵" : tokenLabel(latest.actualToken);
      feedback.classList.add("error");
      feedback.setAttribute("aria-live", "assertive");
      feedback.textContent = latest.attributedExpectedToken === null
        ? `按到 ${actual}，應為目前音節尚未完成的注音之一`
        : `按到 ${actual}，應為 ${tokenLabel(latest.attributedExpectedToken)}`;
      return;
    }
    if (latest?.outcome === "unmapped") {
      feedback.classList.add("muted");
      feedback.textContent = "未映射，進度未移動";
      return;
    }
    feedback.textContent = "";
  }

  function updatePracticeState(): void {
    const stage = requireElement<HTMLElement>("#practice-stage");
    const latest = product.session.traces.at(-1);
    const errorIndex = errorCanonicalTokenIndex(product.session, latest);

    for (const glyph of stage.querySelectorAll<HTMLElement>(".practice-glyph")) {
      applyVisualState(glyph, glyphVisualState(Number(glyph.dataset.syllableOrdinal)));
    }

    for (const token of stage.querySelectorAll<HTMLElement>(".reading-token")) {
      const ordinal = Number(token.dataset.syllableOrdinal);
      const canonicalTokenIndex = Number(token.dataset.canonicalTokenIndex);
      const state = tokenState(product.session, ordinal, canonicalTokenIndex);
      applyTokenState(token, state);
      token.classList.toggle(
        "error",
        ordinal === product.session.currentSyllableOrdinal && errorIndex === canonicalTokenIndex,
      );
    }

    requireElement<HTMLElement>("#progress-fill").style.width = `${currentProgressPercent()}%`;
    requireElement<HTMLElement>("#progress-count").textContent =
      `${product.session.completedCount} / ${product.session.plan.totalSlots}`;

    const view = currentPracticeView(product.session);
    const currentTarget = requireElement<HTMLElement>("#practice-current-target");
    const tokenLabels = view.acceptableTokens.map(tokenLabel);
    const keyLabels = view.acceptableTokens.map((tokenId) =>
      physicalKeyLabel(reverseBindings.get(tokenId) ?? ""));
    const announcement = practiceCurrentSyllableText({
      roundNumber: currentRoundNumber(),
      completed: product.session.completedCount,
      total: product.session.plan.totalSlots,
      tokenLabels,
      physicalKeyLabels: keyLabels,
      toneReady: view.bodyComplete && view.syllable !== null,
    });
    if (currentTarget.textContent !== announcement) currentTarget.textContent = announcement;
    updateKeyboardSketch();
    updatePracticeFeedback();
  }

  function updateKeyboardSketch(): void {
    const keyboard = requireElement<HTMLElement>("#keyboard-sketch");
    keyboard.hidden = !showKeyboardSketch;
    for (const key of keyboard.querySelectorAll<HTMLElement>(".keyboard-sketch-key")) {
      key.classList.remove("current");
    }
    if (!showKeyboardSketch) return;
    for (const tokenId of currentPracticeView(product.session).acceptableTokens) {
      const physicalCode = reverseBindings.get(tokenId);
      if (physicalCode === undefined) continue;
      keyboard.querySelector<HTMLElement>(
        `.keyboard-sketch-key[data-code="${physicalCode}"]`,
      )?.classList.add("current");
    }
  }

  function updateTopbar(): void {
    const status = requireElement<HTMLElement>("#round-status");
    const shown = previousResult.value;
    if (shown !== null) {
      const latency = shown.cleanLatencyMedianMs === null
        ? ""
        : ` · ${Math.round(shown.cleanLatencyMedianMs)} ms`;
      status.setAttribute("aria-label", "上一句結果");
      status.innerHTML = `<span>上一句</span><strong>${accuracyLabel(shown.attempts, shown.errors)}${latency}</strong>`;
      return;
    }
    const { attempts, errors } = mappedRoundCounts();
    status.setAttribute("aria-label", `第 ${currentRoundNumber()} 句，目前正確率 ${accuracyLabel(attempts, errors)}`);
    status.innerHTML = `<span>${currentRoundNumber()}</span><strong>${accuracyLabel(attempts, errors)}</strong>`;
  }

  function clearPreviousResult(): void {
    previousResult.clear();
    updateTopbar();
  }

  function showPreviousResult(record: PilotRoundRecord): void {
    previousResult.set(record, PREVIOUS_RESULT_MS);
  }

  const REPOSITORY_URL = "https://github.com/Mochi96336/bopomofo-trainer";

  function renderHistoryRows(): string {
    const records = [...pilotHistory.records].reverse();
    if (records.length === 0) {
      return '<div class="history-empty">完成第一句後，這裡會保留最近的正確率與乾淨中位時間。</div>';
    }
    return records.map((record) => {
      const latency = record.cleanLatencyMedianMs === null
        ? "—"
        : `${Math.round(record.cleanLatencyMedianMs)} ms`;
      return `<div class="history-record ${record.kind}">
        <div class="history-summary">
          <span class="history-round">${String(record.roundNumber).padStart(2, "0")}</span>
          <span class="history-main"><strong>${accuracyLabel(record.attempts, record.errors)}</strong></span>
          <span class="history-latency">${latency}</span>
        </div>
      </div>`;
    }).join("");
  }

  function roundRarestCommonnessTier(): CommonnessTier | null {
    const tiers = product.round.exercise.entries
      .map((entry) => catalogEntryCommonnessTier(entry, COMMONNESS_TIER_THRESHOLDS))
      .filter((tier): tier is CommonnessTier => tier !== null);
    if (tiers.length === 0) return null;
    return tiers.reduce((rarest, tier) => (tier > rarest ? tier : rarest));
  }

  function renderCommonnessStatus(): void {
    const element = requireElement<HTMLElement>("#information-commonness");
    const tier = roundRarestCommonnessTier();
    if (tier === null) {
      element.hidden = true;
      element.innerHTML = "";
      return;
    }
    element.hidden = false;
    element.setAttribute("aria-label", `本句最罕見的詞 ${commonnessTierLabel(tier)}`);
    element.innerHTML = `<span>等級</span>
      <span class="entry-commonness" data-tier="${tier}" aria-hidden="true">${commonnessDotsMarkup(tier)}</span>`;
  }

  function renderRaritySection(): string {
    const practised = practisedKeyCount(product.progress.measurements);
    const toggles = COMMONNESS_TIERS.map((tier) => {
      const unlocked = unlockedTiers.includes(tier);
      const enabled = practisedTiers.includes(tier);
      const onlyEnabled = enabled && practisedTiers.length === 1;
      const description = `${COMMONNESS_TIER_LABELS[tier]} · ${commonnessTierShareLabel(tier)}`;
      const state = unlocked
        ? onlyEnabled ? "至少要留一種稀有度" : enabled ? "練習中" : "未練習"
        : `未解鎖：需練熟 ${requiredPractisedKeys(tier)} 個按鍵，目前 ${practised} 個`;
      return `<button
        type="button"
        class="rarity-toggle${enabled ? " on" : ""}${unlocked ? "" : " locked"}"
        data-rarity-tier="${tier}"
        aria-pressed="${enabled ? "true" : "false"}"
        aria-label="${escapeHtml(`等級 ${tier}：${description}，${state}`)}"
        title="${escapeHtml(`${description}／${state}`)}"
        ${unlocked && !onlyEnabled ? "" : "disabled"}
      >${tier}</button>`;
    }).join("");
    const progress = rarityProgressText(
      nextCommonnessUnlock(product.progress.measurements),
      inspectionUnlockAll,
    );
    return `<section class="panel-section rarity-section">
      <div class="panel-heading rarity-line">
        <h3>稀有度</h3>
        <div class="rarity-toggles" role="group" aria-label="稀有度">${toggles}</div>
        <div class="rarity-readout">
          <span class="rarity-progress">${escapeHtml(progress)}</span>
          ${panelActionStatusMarkup("rarity-action-status", rarityStatus)}
        </div>
      </div>
    </section>`;
  }

  function bindRarityControls(content: HTMLElement): void {
    for (const button of content.querySelectorAll<HTMLButtonElement>("[data-rarity-tier]")) {
      button.addEventListener("click", () => {
        const tier = Number(button.dataset.rarityTier) as CommonnessTier;
        const wanted = selectionTuning.rarityTiers.includes(tier)
          ? selectionTuning.rarityTiers.filter((candidate) => candidate !== tier)
          : COMMONNESS_TIERS.filter((candidate) =>
            candidate === tier || selectionTuning.rarityTiers.includes(candidate));
        selectionTuning = { ...selectionTuning, rarityTiers: wanted };
        syncPractisedLevels(product.progress);
        try {
          saveSelectionTuning(storage, selectionTuning);
          rarityStatus = actionApplied("下一題生效");
        } catch {
          rarityStatus = actionFailed("本次已套用，但無法保存。");
        }
        renderInformationPanel();
      });
    }
  }

  function restoreInformationFocus(content: HTMLElement, identity: FocusIdentity | null): void {
    if (restoreFocusIdentity(content, identity)) return;
    const tier = Number(identity?.data.rarityTier);
    if (!Number.isFinite(tier)) return;
    const candidates = [...content.querySelectorAll<HTMLButtonElement>("[data-rarity-tier]:not(:disabled)")]
      .sort((left, right) =>
        Math.abs(Number(left.dataset.rarityTier) - tier)
        - Math.abs(Number(right.dataset.rarityTier) - tier));
    candidates[0]?.focus({ preventScroll: true });
  }

  function updateActionStatus(id: string, status: PanelActionStatus): void {
    const element = document.querySelector<HTMLElement>(`#${id}`);
    if (element === null) return;
    element.textContent = status.message;
    element.classList.toggle("failed", status.tone === "danger");
  }

  function clearPanelActionStatus(): void {
    tuningStatus = NO_ACTION_STATUS;
    rarityStatus = NO_ACTION_STATUS;
    dataStatus = NO_ACTION_STATUS;
  }

  function renderInformationPanel(): void {
    const { attempts, errors } = mappedRoundCounts();
    const roundStatus = requireElement<HTMLElement>("#information-round-status");
    roundStatus.setAttribute("aria-label", `第 ${currentRoundNumber()} 句，目前正確率 ${accuracyLabel(attempts, errors)}`);
    roundStatus.innerHTML = `<span>第 ${currentRoundNumber()} 句</span><strong>${accuracyLabel(attempts, errors)}</strong>`;
    renderCommonnessStatus();
    const content = requireElement<HTMLElement>("#information-content");
    const focusIdentity = captureFocusIdentity(content);
    content.innerHTML = `
      <section class="panel-section" data-analysis-v2-summary-slot="true"></section>

      <section class="panel-section history-section">
        <details class="history-details" open>
          <summary class="panel-heading history-heading"><h3>最近紀錄</h3></summary>
          ${renderTrendSection(pilotHistory.records)}
          <div class="history-list" tabindex="0">${renderHistoryRows()}</div>
        </details>
      </section>

      <section class="panel-section">
        <div class="panel-heading"><h3>顯示</h3></div>
        <div class="display-options">
          <label class="setting-row" for="toggle-keyboard-sketch">
            <span><strong>鍵盤提示</strong></span>
            <input id="toggle-keyboard-sketch" type="checkbox"${showKeyboardSketch ? " checked" : ""} />
          </label>
          <label class="setting-row" for="toggle-dark-theme">
            <span><strong>深色模式</strong></span>
            <input id="toggle-dark-theme" type="checkbox"${theme === "dark" ? " checked" : ""} />
          </label>
        </div>
      </section>

      <section class="panel-section">
        <div class="panel-heading panel-heading-inline">
          <h3>選題權重</h3>
          ${panelActionStatusMarkup("tuning-notice", tuningStatus)}
        </div>
        <div class="tuning-controls">
          <label class="tuning-row" for="error-influence">
            <span>錯誤</span><output id="error-influence-value">${Math.round(selectionTuning.errorInfluence * 100)}%</output>
            <input id="error-influence" type="range" min="0" max="300" step="25" value="${Math.round(selectionTuning.errorInfluence * 100)}" />
          </label>
          <label class="tuning-row" for="timing-influence">
            <span>慢速</span><output id="timing-influence-value">${Math.round(selectionTuning.timingInfluence * 100)}%</output>
            <input id="timing-influence" type="range" min="0" max="300" step="25" value="${Math.round(selectionTuning.timingInfluence * 100)}" />
          </label>
        </div>
      </section>

      ${renderRaritySection()}

      <section class="panel-section data-section">
        <div class="panel-heading panel-heading-actions">
          <h3>本機資料</h3>
          <div class="data-actions">
            <button id="download-backup" class="text-button" type="button">匯出存檔</button>
            <button id="choose-backup" class="text-button" type="button">匯入存檔</button>
            <button id="reset-progress" class="danger-button" type="button">清除進度</button>
            <input id="import-backup" class="visually-hidden" type="file" accept="application/json,.json" />
          </div>
        </div>
        ${panelActionStatusMarkup("data-notice", dataStatus)}
      </section>

      <section class="panel-section about-section">
        <div class="panel-heading panel-heading-actions">
          <h3>關於</h3>
          <div class="about-links">
            <a id="about-code-license" href="${REPOSITORY_URL}/blob/main/LICENSE" target="_blank" rel="noopener noreferrer">程式碼授權 ↗</a>
            <a id="about-third-party-notices" href="${REPOSITORY_URL}/blob/main/THIRD_PARTY_NOTICES.md" target="_blank" rel="noopener noreferrer">資料來源與第三方授權 ↗</a>
            <a id="about-repository" href="${REPOSITORY_URL}" target="_blank" rel="noopener noreferrer">GitHub ↗</a>
          </div>
        </div>
        <p class="panel-note">程式碼採 MIT 授權。讀音、詞頻與句法證據來自教育部辭典、CC-CEDICT、Universal Dependencies 與國教院詞頻表，各自的授權不因收錄於本專案而改變。</p>
      </section>`;

    content.querySelector<HTMLInputElement>("#toggle-keyboard-sketch")?.addEventListener("change", (event) => {
      if (!(event.currentTarget instanceof HTMLInputElement)) return;
      showKeyboardSketch = event.currentTarget.checked;
      updateKeyboardSketch();
    });
    content.querySelector<HTMLInputElement>("#toggle-dark-theme")?.addEventListener("change", (event) => {
      if (!(event.currentTarget instanceof HTMLInputElement)) return;
      theme = event.currentTarget.checked ? "dark" : "light";
      applyTheme(theme);
      try {
        saveTheme(storage, theme);
      } catch {
        // Storage may be blocked; the theme still applies for this session.
      }
    });
    bindInfluenceControl(content, "error-influence", "error-influence-value", "errorInfluence");
    bindInfluenceControl(content, "timing-influence", "timing-influence-value", "timingInfluence");
    bindRarityControls(content);
    content.querySelector<HTMLButtonElement>("#download-backup")?.addEventListener("click", downloadProductBackup);
    const backupInput = content.querySelector<HTMLInputElement>("#import-backup");
    content.querySelector<HTMLButtonElement>("#choose-backup")?.addEventListener("click", () => backupInput?.click());
    backupInput?.addEventListener("change", () => void importProductBackup(backupInput));
    content.querySelector<HTMLButtonElement>("#reset-progress")?.addEventListener("click", () => void resetProgress());
    restoreInformationFocus(content, focusIdentity);
    onPanelRendered?.(content);
  }

  function openInformationPanel(): void {
    const dialog = requireElement<HTMLDialogElement>("#information-dialog");
    if (dialog.open) return;
    if (unlockNotice.value !== null) {
      clearUnlockNotice();
      renderNotices();
    }
    renderInformationPanel();
    dialog.showModal();
    requireElement<HTMLButtonElement>(".dialog-close").focus({ preventScroll: true });
  }

  function persistProgress(): void {
    try {
      saveLocalProductProgress(storage, product.progress);
      saveLocalPilotHistory(storage, pilotHistory);
      saveLocalProgressHistory(storage, progressHistory);
      storageWarning = "";
    } catch {
      storageWarning = "無法寫入 localStorage；請勿關閉頁面，否則本輪進度可能遺失。";
    }
    renderNotices();
  }

  function downloadJson(filename: string, source: string): void {
    const url = URL.createObjectURL(new Blob([source], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function syncRangeFill(input: HTMLInputElement): void {
    const min = Number(input.min || "0");
    const max = Number(input.max || "100");
    const percent = max === min ? 0 : ((Number(input.value) - min) / (max - min)) * 100;
    input.style.setProperty("--fill", `${percent}%`);
  }

  function bindInfluenceControl(
    content: HTMLElement,
    inputId: string,
    outputId: string,
    key: "errorInfluence" | "timingInfluence",
  ): void {
    const input = content.querySelector<HTMLInputElement>(`#${inputId}`);
    const output = content.querySelector<HTMLOutputElement>(`#${outputId}`);
    if (input !== null) syncRangeFill(input);
    input?.addEventListener("input", () => {
      if (output !== null) output.value = `${input.value}%`;
      syncRangeFill(input);
    });
    input?.addEventListener("change", () => {
      selectionTuning = { ...selectionTuning, [key]: Number(input.value) / 100 };
      environment = practiceEnvironment();
      try {
        saveSelectionTuning(storage, selectionTuning);
        tuningStatus = actionApplied("下一題生效");
      } catch {
        tuningStatus = actionFailed("本次已套用，但無法保存。");
      }
      updateActionStatus("tuning-notice", tuningStatus);
    });
  }

  function downloadProductBackup(): void {
    downloadJson(
      `bopomofo-backup-${new Date().toISOString().slice(0, 10)}.json`,
      createProductBackup(product.progress, pilotHistory, progressHistory, selectionTuning),
    );
    dataStatus = actionApplied("已匯出存檔");
    updateActionStatus("data-notice", dataStatus);
  }

  const IMPORT_REPLACES = [
    "練習進度",
    "最近紀錄",
    "弱點量測",
    "進步趨勢",
    "選題權重",
  ] as const;

  function importConfirmation(incoming: ProductBackup): ConfirmDialogOptions {
    const current = summariseBackup({ progress: product.progress, pilotHistory, progressHistory });
    return {
      title: "匯入這份存檔？",
      sections: [
        { heading: "目前資料", items: [backupSummaryLabel(current)] },
        { heading: "匯入資料", items: [backupSummaryLabel(summariseBackup(incoming))] },
        { heading: "會被取代", items: IMPORT_REPLACES },
      ],
      note: "",
      confirmLabel: "匯入並取代",
      tone: "normal",
    };
  }

  let importInFlight = false;

  async function importProductBackup(input: HTMLInputElement): Promise<void> {
    if (importInFlight) return;
    importInFlight = true;
    try {
      const outcome = await runBackupImport({
        readSelectedFile: () => {
          const file = input.files?.[0];
          return file === undefined ? Promise.resolve(null) : file.text();
        },
        parse: (source) => parseProductBackup(
          source,
          storageEnvironment,
          "guided",
          STANDARD_BOPOMOFO_LAYOUT.id,
        ),
        confirmReplacement: (backup) => confirmDialog.confirm(importConfirmation(backup)),
      });
      if (outcome.kind === "no-file" || outcome.kind === "cancelled") return;
      if (outcome.kind === "unreadable") {
        dataStatus = actionFailed("無法讀取這份存檔。");
        updateActionStatus("data-notice", dataStatus);
        return;
      }
      applyImportedBackup(outcome.backup);
    } finally {
      importInFlight = false;
    }
  }

  function applyImportedBackup(backup: ProductBackup): void {
    selectionTuning = backup.selectionTuning;
    storageEnvironment = environmentFor(catalogs);
    syncPractisedLevels(backup.progress, true);
    product = createProductState(environment, backup.progress, performance.now());
    pilotHistory = backup.pilotHistory;
    progressHistory = backup.progressHistory;
    recoveryNotices.clear();
    inspectionAdvanceCount = 0;
    clearPreviousResult();
    try {
      saveSelectionTuning(storage, selectionTuning);
    } catch {
      // Progress persistence below provides the visible storage warning.
    }
    persistProgress();
    dataStatus = actionApplied("已匯入存檔");
    capture.value = "";
    mountPracticeRound(true);
    updateTopbar();
    renderInformationPanel();
    requireElement<HTMLButtonElement>("#choose-backup").focus({ preventScroll: true });
  }

  const RESET_CONFIRMATION: ConfirmDialogOptions = {
    title: "清除所有本機進度？",
    sections: [{
      heading: "將清除",
      items: ["練習進度", "最近紀錄", "弱點量測", "進步趨勢", "稀有度解鎖"],
    }],
    note: "已下載的存檔檔案不受影響。",
    confirmLabel: "清除全部資料",
    tone: "danger",
  };

  async function resetProgress(): Promise<void> {
    if (!await confirmDialog.confirm(RESET_CONFIRMATION)) return;
    const clearing = clearLocalRecords(storage);
    storageWarning = clearing.storageWarning;
    const progress = createFreshProgressForEnvironment(
      storageEnvironment,
      newSeed(),
      "guided",
      STANDARD_BOPOMOFO_LAYOUT.id,
    );
    syncPractisedLevels(progress);
    clearUnlockNotice();
    product = createProductState(environment, progress, performance.now());
    pilotHistory = pilotHistoryFromProgress(progress);
    progressHistory = createEmptyProgressHistory(progress.mode, progress.layoutId);
    recoveryNotices.clear();
    inspectionAdvanceCount = 0;
    clearPreviousResult();
    if (clearing.cleared) persistProgress();
    imeWarning = false;
    capture.value = "";
    requireElement<HTMLDialogElement>("#information-dialog").close();
    renderNotices();
    mountPracticeRound(true);
    updateTopbar();
  }

  function completeRoundAndAdvance(): void {
    const summary = product.summary;
    if (summary === null) return;
    const roundNumber = completedRoundCount();
    const record = createPilotRoundRecord(
      roundNumber,
      product.round,
      summary,
      product.session.traces,
    );
    pilotHistory = appendPilotRoundRecord(pilotHistory, record);
    progressHistory = appendRoundToProgressHistory({
      history: progressHistory,
      exercise: product.round.exercise,
      traces: product.session.traces,
      completedRound: roundNumber,
    });
    persistProgress();
    const opened = syncPractisedLevels(product.progress);
    if (opened !== null) {
      showUnlockNotice(
        `稀有度「${COMMONNESS_TIER_LABELS[opened]}」已解鎖，已加入選題；可在資訊面板關閉。`,
      );
    }
    product = startNextProductRound(environment, product, performance.now());
    imeWarning = false;
    capture.value = "";
    mountPracticeRound(true);
    showPreviousResult(record);
  }

  function advanceRoundForInspection(): void {
    const preservedProgress = product.progress;
    const previousUtteranceId = product.round.selection.utterance.id;
    let preview = product;
    for (let attempt = 0; attempt < 8; attempt += 1) {
      inspectionAdvanceCount += 1;
      preview = createProductState(
        environment,
        {
          ...preservedProgress,
          seed: `${preservedProgress.seed}:inspection:${inspectionAdvanceCount}`,
        },
        performance.now(),
      );
      if (preview.round.selection.utterance.id !== previousUtteranceId) break;
    }
    product = { ...preview, progress: preservedProgress };
    imeWarning = false;
    capture.value = "";
    clearPreviousResult();
    mountPracticeRound(true);
    updateTopbar();
    focusCapture(true);
  }

  function toggleInspectionUnlock(): void {
    inspectionUnlockAll = !inspectionUnlockAll;
    syncPractisedLevels(product.progress);
    showUnlockNotice(inspectionUnlockAll
      ? "檢視用：已開放全部稀有度，重新載入後回到實際解鎖狀態。"
      : "檢視用開放已關閉，回到實際解鎖狀態。");
  }

  function completeRoundForInspection(): void {
    if (product.summary !== null) return;
    const completedAt = new Date().toISOString();
    while (product.summary === null) {
      const token = inspectionNextToken(product.session);
      if (token === null) return;
      for (const actualToken of [null, token]) {
        product = applyProductInput(environment, product, {
          timestampMs: performance.now(),
          physicalCode: "InspectionComplete",
          actualToken,
          repeat: false,
          composing: false,
          modifierOnly: false,
        }, completedAt);
      }
    }
    clearPreviousResult();
    completeRoundAndAdvance();
  }

  capture.addEventListener("compositionstart", () => {
    compositionActive = true;
    imeWarning = true;
    updatePracticeState();
  }, { signal: eventScope.signal });

  capture.addEventListener("compositionend", () => {
    compositionActive = false;
    imeWarning = false;
    capture.value = "";
    updatePracticeState();
    focusCapture(true);
  }, { signal: eventScope.signal });

  capture.addEventListener("input", (event) => {
    if (!(event instanceof InputEvent) || !event.isComposing) capture.value = "";
  }, { signal: eventScope.signal });

  capture.addEventListener("keydown", (event) => {
    if (event.key === "Tab") return;
    if (requireElement<HTMLDialogElement>("#information-dialog").open) {
      event.preventDefault();
      return;
    }
    const input = keyboardEventToInput(
      event,
      STANDARD_BOPOMOFO_LAYOUT,
      performance.now(),
      compositionActive,
    );
    if (input.composing) {
      imeWarning = true;
      updatePracticeState();
      return;
    }
    if (imeWarning) {
      imeWarning = false;
      capture.value = "";
    }
    if (event.code === "Space") event.preventDefault();
    const beforeSummary = product.summary;
    const beforeTraceCount = product.session.traces.length;
    product = applyProductInput(
      environment,
      product,
      input,
      new Date().toISOString(),
    );
    const latest = product.session.traces.at(-1);
    if (
      previousResult.value !== null
      && product.session.traces.length > beforeTraceCount
      && latest?.accepted === true
    ) {
      clearPreviousResult();
    }
    if (beforeSummary === null && product.summary !== null) {
      completeRoundAndAdvance();
      return;
    }
    updatePracticeState();
    updateTopbar();
  }, { signal: eventScope.signal });

  const handleGlobalKeydown = (event: KeyboardEvent): void => {
    const inspectionAction = event.code === "F8"
      ? { matches: isInspectionAdvanceShortcut, run: advanceRoundForInspection }
      : event.code === "F9"
        ? { matches: isInspectionUnlockShortcut, run: toggleInspectionUnlock }
        : event.code === "F10"
          ? { matches: isInspectionCompleteShortcut, run: completeRoundForInspection }
          : null;
    if (inspectionAction !== null) {
      event.preventDefault();
      event.stopPropagation();
      if (
        inspectionAction.matches(event)
        && !compositionActive
        && !imeWarning
        && !requireElement<HTMLDialogElement>("#information-dialog").open
      ) {
        inspectionAction.run();
      }
      return;
    }
    if (event.code !== "Escape") return;
    const dialog = requireElement<HTMLDialogElement>("#information-dialog");
    if (dialog.open) {
      event.preventDefault();
      event.stopPropagation();
      dialog.close();
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (imeWarning) {
      imeWarning = false;
      capture.value = "";
      updatePracticeState();
      focusCapture(true);
      return;
    }
    openInformationPanel();
  };

  const handleWindowFocus = (): void => {
    focusCapture();
  };

  document.addEventListener("keydown", handleGlobalKeydown, {
    capture: true,
    signal: eventScope.signal,
  });
  window.addEventListener("focus", handleWindowFocus, { signal: eventScope.signal });

  mountShell();
  const recovered = [
    boot.progressLoadStatus === "migrated" ? PROGRESS_MIGRATION_NOTICE : "",
    boot.progressLoadStatus === "invalid" ? PROGRESS_INVALID_NOTICE : "",
    boot.recoveredPilotHistory ? PILOT_RECOVERY_NOTICE : "",
  ].filter(Boolean);
  if (recovered.length > 0) recoveryNotices.set(recovered, RECOVERY_NOTICE_MS);
  renderNotices();
  mountPracticeRound();
  updateTopbar();
  if (!loadedExistingProgress) persistProgress();
  focusCapture();

  return {
    closePanel(): void {
      const dialog = requireElement<HTMLDialogElement>("#information-dialog");
      if (dialog.open) dialog.close();
    },
    focusPractice(): void {
      focusCapture(true);
    },
    getAnalysisV2Snapshot(): AnalysisV2Snapshot {
      return {
        progress: product.progress,
        progressHistory,
        practiceSupport: storageEnvironment.practiceSupport,
      };
    },
    destroy(): void {
      eventScope.abort();
      unlockNotice.clear();
      previousResult.clear();
      recoveryNotices.clear();
      confirmDialog.destroy();
    },
  };
}
