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
import { practiceCurrentTargetText } from "./practice-accessibility.js";
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
import { createExpiringValue } from "./expiring-value.js";
import { loadAppState } from "./load-app-state.js";
import { renderTrendSection } from "./practice-sparkline.js";
import { weakBindingsMarkup, weakestBindings } from "./weak-bindings.js";

/** Long enough to read a sentence that appeared while the learner was typing. */
const UNLOCK_NOTICE_MS = 6000;
/** Short: the next round is already on screen behind it. */
const PREVIOUS_RESULT_MS = 1400;

type VisualState = "done" | "current" | "upcoming";

function requireElement<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (element === null) throw new Error(`Missing required element: ${selector}`);
  return element;
}

const root = requireElement<HTMLDivElement>("#app");
const capture = requireElement<HTMLTextAreaElement>("#keyboard-capture");
const catalogs = {
  practice: PRACTICE_CATALOG,
  evaluation: EVALUATION_CATALOG,
  syntaxProfiles: SYNTAX_PROFILES,
} as const;
let selectionTuning: SelectionTuning = DEFAULT_SELECTION_TUNING;
try {
  selectionTuning = loadSelectionTuning(localStorage);
} catch {
  // Storage may be blocked; defaults still provide a complete local session.
}
let theme: Theme = DEFAULT_THEME;
try {
  theme = loadTheme(localStorage);
} catch {
  // Storage may be blocked; defaults still provide a complete local session.
}
applyTheme(theme);

function environmentFor(source: ProductCatalogs): ProductEnvironment {
  return createProductEnvironment(source, policyForSelectionTuning(selectionTuning));
}

/**
 * Stored progress, pilot history and backups are validated against the whole
 * catalog, never the practised subset: their records point at entries that were
 * drawn before the learner narrowed the levels, and reading them through the
 * narrowed catalog would reject that history as invalid.
 */
let storageEnvironment = environmentFor(catalogs);
// Play draws from the practised levels only. Until progress is loaded there is
// nothing to unlock from, so it starts as the whole catalog.
let environment = storageEnvironment;
let unlockedTiers: readonly CommonnessTier[] = COMMONNESS_TIERS;
let practisedTiers: readonly CommonnessTier[] = COMMONNESS_TIERS;
// Hidden local-review override (F9). Deliberately not persisted: it opens the
// levels for looking at, and nothing about it should survive as earned progress.
let inspectionUnlockAll = false;

function newSeed(): string {
  return globalThis.crypto?.randomUUID?.() ?? `local-${Date.now().toString(36)}`;
}

const boot = loadAppState({
  storage: localStorage,
  environment: storageEnvironment,
  mode: "guided",
  layoutId: STANDARD_BOPOMOFO_LAYOUT.id,
  newSeed,
});
const initialProgress = boot.progress;
const loadedExistingProgress = boot.loadedExistingProgress;
let storageWarning = boot.storageWarning;
let recoveredFromInvalidState = boot.recoveredFromInvalidState;
let recoveredPilotHistory = boot.recoveredPilotHistory;
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
// What just happened in a panel section, as opposed to what that section
// lastingly says. Cleared when the panel closes: each belongs to the visit that
// produced it, and none of them describes a condition that outlives it. The
// storage warning is not among them -- it is a lasting condition and lives in
// the global notice region.
let tuningStatus: PanelActionStatus = NO_ACTION_STATUS;
let rarityStatus: PanelActionStatus = NO_ACTION_STATUS;
let dataStatus: PanelActionStatus = NO_ACTION_STATUS;

// Declared with the rest of the module state rather than beside the functions
// that use them: both read a hoisted render function, so keeping them here
// removes any ordering hazard if a top-level call is ever added above.
const unlockNotice = createExpiringValue<string>(window, () => renderNotices());
const previousResult = createExpiringValue<PilotRoundRecord>(window, () => updateTopbar());
// Outside `#app`, so replacing the shell's markup cannot take the dialog with
// it, and alongside the analysis host rather than inside the panel it stacks
// over.
const confirmDialog = createConfirmDialog(document.body);

/**
 * Recomputes which levels are unlocked and which are practised, rebuilding the
 * practice environment only when the practised set actually changes: rebuilding
 * indexes the catalog, which is far too much work to repeat after every round
 * just to arrive at the same pool.
 *
 * Returns the level that just unlocked, so the caller can say so.
 */
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

interface KeyboardSketchKey {
  readonly code: string;
  readonly units?: number;
}

const KEYBOARD_SKETCH_ROWS: readonly (readonly KeyboardSketchKey[])[] = [
  [
    { code: "Backquote" }, { code: "Digit1" }, { code: "Digit2" },
    { code: "Digit3" }, { code: "Digit4" }, { code: "Digit5" },
    { code: "Digit6" }, { code: "Digit7" }, { code: "Digit8" },
    { code: "Digit9" }, { code: "Digit0" }, { code: "Minus" },
    { code: "Equal" }, { code: "Backspace", units: 2 },
  ],
  [
    { code: "Tab", units: 1.5 }, { code: "KeyQ" }, { code: "KeyW" },
    { code: "KeyE" }, { code: "KeyR" }, { code: "KeyT" }, { code: "KeyY" },
    { code: "KeyU" }, { code: "KeyI" }, { code: "KeyO" }, { code: "KeyP" },
    { code: "BracketLeft" }, { code: "BracketRight" }, { code: "Backslash", units: 1.5 },
  ],
  [
    { code: "CapsLock", units: 1.75 }, { code: "KeyA" }, { code: "KeyS" },
    { code: "KeyD" }, { code: "KeyF" }, { code: "KeyG" }, { code: "KeyH" },
    { code: "KeyJ" }, { code: "KeyK" }, { code: "KeyL" },
    { code: "Semicolon" }, { code: "Quote" }, { code: "Enter", units: 2.25 },
  ],
  [
    { code: "ShiftLeft", units: 2.25 }, { code: "KeyZ" }, { code: "KeyX" },
    { code: "KeyC" }, { code: "KeyV" }, { code: "KeyB" }, { code: "KeyN" },
    { code: "KeyM" }, { code: "Comma" }, { code: "Period" }, { code: "Slash" },
    { code: "ShiftRight", units: 2.75 },
  ],
  [
    { code: "ControlLeft", units: 1.5 }, { code: "MetaLeft", units: 1.25 },
    { code: "AltLeft", units: 1.25 }, { code: "Space", units: 7 },
    { code: "AltRight", units: 1.25 }, { code: "MetaRight", units: 1.25 },
    { code: "ControlRight", units: 1.5 },
  ],
];

function keyboardSketchMarkup(): string {
  return KEYBOARD_SKETCH_ROWS.map((row) => `<div class="keyboard-sketch-row">
    ${row.map((key) => `<span class="keyboard-sketch-key${key.units === undefined ? "" : " wide"}" data-code="${key.code}" style="--key-columns:${Math.round((key.units ?? 1) * 4)}"></span>`).join("")}
  </div>`).join("");
}

function completedRoundCount(): number {
  return product.progress.practiceRoundsCompleted;
}

function currentRoundNumber(): number {
  return completedRoundCount() + 1;
}

function currentProgressPercent(): number {
  if (product.session.targets.length === 0) return 100;
  return Math.round(
    (product.session.position / product.session.targets.length) * 100,
  );
}

function utteranceText(): string {
  const punctuation = product.round.selection.utterance.punctuation ?? "";
  return `${continuousExerciseText(product.round.exercise)}${punctuation}`;
}

function mappedRoundCounts(): { readonly attempts: number; readonly errors: number } {
  let attempts = 0;
  let errors = 0;
  for (const trace of product.session.traces) {
    if (trace.outcome !== "correct" && trace.outcome !== "incorrect") continue;
    attempts += 1;
    if (trace.outcome === "incorrect") errors += 1;
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

/**
 * The other notices in this region describe a lasting condition, so they stay.
 * This one announces something that just happened, so it retires on its own
 * rather than sitting in the corner for the rest of the session. Opening the
 * information panel also retires it, because that is where it was pointing.
 */
function showUnlockNotice(message: string): void {
  unlockNotice.set(message, UNLOCK_NOTICE_MS);
}

function renderNotices(): void {
  const notices = [
    unlockNotice.value ?? "",
    recoveredFromInvalidState
      ? "舊版或無效的本機進度已刪除，已從新的進度世代重新開始。"
      : "",
    recoveredPilotHistory
      ? "舊版或無效的 Pilot 歷史已刪除；目前世代可由有效完成摘要補齊。"
      : "",
    storageWarning,
  ].filter(Boolean);
  requireElement<HTMLElement>("#notice-region").innerHTML = notices.map((notice) =>
    `<div class="notice${notice === storageWarning && storageWarning ? " warning" : ""}">${escapeHtml(notice)}</div>`
  ).join("");
}

function practiceEntryMarkup(): string {
  const entries = buildPracticeEntries(product.round.exercise);
  const punctuation = product.round.selection.utterance.punctuation ?? "";
  return entries.map((entry, entryIndex) => {
    const glyphs = entry.glyphs.map((glyph) => {
      const reading = glyph.tokens.map((tokenId, tokenIndex) => {
        const position = glyph.tokenStart + tokenIndex;
        return `<span class="reading-token upcoming" data-position="${position}">${escapeHtml(tokenLabel(tokenId))}</span>`;
      }).join("");
      return `<span class="practice-glyph upcoming" data-token-start="${glyph.tokenStart}" data-token-end="${glyph.tokenEnd}">
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

  if (!animateRound) return;
  stage.classList.remove("round-enter");
  void stage.offsetWidth;
  stage.classList.add("round-enter");
  stage.addEventListener("animationend", () => {
    stage.classList.remove("round-enter");
  }, { once: true });
}

function glyphVisualState(tokenStart: number, tokenEnd: number): VisualState {
  if (product.session.position >= tokenEnd) return "done";
  if (product.session.position >= tokenStart) return "current";
  return "upcoming";
}

function tokenVisualState(position: number): VisualState {
  if (position < product.session.position) return "done";
  if (position === product.session.position) return "current";
  return "upcoming";
}

function applyVisualState(element: HTMLElement, state: VisualState): void {
  element.classList.remove("done", "current", "upcoming");
  element.classList.add(state);
  if (state === "current") element.setAttribute("aria-current", "true");
  else element.removeAttribute("aria-current");
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
  if (latest?.outcome === "incorrect") {
    const actual = latest.actualToken === null ? "未映射鍵" : tokenLabel(latest.actualToken);
    feedback.classList.add("error");
    feedback.setAttribute("aria-live", "assertive");
    feedback.textContent = `按到 ${actual}，應為 ${tokenLabel(latest.expectedToken)}`;
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

  for (const glyph of stage.querySelectorAll<HTMLElement>(".practice-glyph")) {
    const tokenStart = Number(glyph.dataset.tokenStart);
    const tokenEnd = Number(glyph.dataset.tokenEnd);
    applyVisualState(glyph, glyphVisualState(tokenStart, tokenEnd));
  }

  for (const token of stage.querySelectorAll<HTMLElement>(".reading-token")) {
    const position = Number(token.dataset.position);
    const state = tokenVisualState(position);
    applyVisualState(token, state);
    const hasError = state === "current"
      && latest?.position === position
      && latest.outcome === "incorrect";
    token.classList.toggle("error", hasError);
  }

  requireElement<HTMLElement>("#progress-fill").style.width = `${currentProgressPercent()}%`;
  requireElement<HTMLElement>("#progress-count").textContent =
    `${product.session.position} / ${product.session.targets.length}`;
  const target = product.session.targets[product.session.position];
  const currentTarget = requireElement<HTMLElement>("#practice-current-target");
  const announcement = target === undefined
    ? ""
    : practiceCurrentTargetText({
      roundNumber: currentRoundNumber(),
      position: product.session.position + 1,
      total: product.session.targets.length,
      tokenLabel: tokenLabel(target.tokenId),
      physicalKeyLabel: physicalKeyLabel(reverseBindings.get(target.tokenId) ?? ""),
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
  const target = product.session.targets[product.session.position];
  if (target === undefined) return;
  const physicalCode = reverseBindings.get(target.tokenId);
  if (physicalCode === undefined) return;
  const key = keyboard.querySelector<HTMLElement>(
    `.keyboard-sketch-key[data-code="${physicalCode}"]`,
  );
  if (key === null) return;
  key.classList.add("current");
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

// The information panel links to licence files that live in the repository, not
// in the deployed bundle, so they resolve against GitHub rather than the site.
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

/**
 * The rarest level in the current sentence; `null` when none is known.
 *
 * The rarest word, not the most common one: selection is already weighted
 * towards common words, so nearly every sentence contains a top-tier word and
 * that reading would sit at one mark almost always. The rarest word is what
 * actually varies, and it is what makes a sentence hard.
 */
function roundRarestCommonnessTier(): CommonnessTier | null {
  const tiers = product.round.exercise.entries
    .map((entry) => catalogEntryCommonnessTier(entry, COMMONNESS_TIER_THRESHOLDS))
    .filter((tier): tier is CommonnessTier => tier !== null);
  if (tiers.length === 0) return null;
  return tiers.reduce((rarest, tier) => (tier > rarest ? tier : rarest));
}

// One reading beside the round status, which is where a level is legible
// without a legend on the practice stage.
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

/**
 * One round mark per level, numbered in the same order as the level reading on
 * the practice stage. A locked mark says what it is waiting for rather than only
 * that it is closed, and the last lit mark cannot be switched off because a pool
 * with no levels in it has no sentence to draw.
 */
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
  // Label, marks and count share one line: four marks and a pair of numbers do
  // not fill a row each, and reading them together is the whole point. The reply
  // to a press sits under the count rather than over it, so changing a level
  // never costs the learner the progress they changed it against.
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
        saveSelectionTuning(localStorage, selectionTuning);
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

/**
 * Writes a status into a region that is already on the page. The element is
 * never added or removed, so the text change is what gets announced and the
 * controls above it do not move when a reply arrives.
 */
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
    <section class="panel-section" data-legacy-weak-section="true">
      <div class="panel-heading"><h3>較弱按鍵</h3></div>
      ${weakBindingsMarkup(weakestBindings(product.progress.curriculum.bindings), reverseBindings)}
    </section>

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
      saveTheme(localStorage, theme);
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
}

function openInformationPanel(): void {
  const dialog = requireElement<HTMLDialogElement>("#information-dialog");
  if (dialog.open) return;
  // The unlock notice points here, so opening the panel retires it early.
  if (unlockNotice.value !== null) {
    clearUnlockNotice();
    renderNotices();
  }
  // Nothing to blank on the way in. The count has its own element, so a status
  // never took its place, and closing the panel already retired the statuses
  // from the last visit.
  renderInformationPanel();
  dialog.showModal();
  requireElement<HTMLButtonElement>(".dialog-close").focus({ preventScroll: true });
}

function persistProgress(): void {
  try {
    saveLocalProductProgress(localStorage, product.progress);
    saveLocalPilotHistory(localStorage, pilotHistory);
    saveLocalProgressHistory(localStorage, progressHistory);
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
    if (input !== null) syncRangeFill(input);
  });
  input?.addEventListener("change", () => {
    selectionTuning = { ...selectionTuning, [key]: Number(input.value) / 100 };
    environment = practiceEnvironment();
    try {
      saveSelectionTuning(localStorage, selectionTuning);
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

/** What importing replaces, in the order the panel presents it. */
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
    // Replacing is not deleting: the learner chose a file to arrive, and the
    // sentence on the button already says what happens to what is here.
    tone: "normal",
  };
}

/**
 * One import at a time. The confirmation is asynchronous now, so a second file
 * picked while the first is still being read would leave two applications of two
 * different generations racing into the same state.
 */
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

    // Declining leaves the picker reusable without help here: the shell clears
    // the file input on every change, so the same file can be chosen again.
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
  // The imported tuning carries its own selection influences, so both
  // environments are rebuilt even when the practised levels come out the same.
  storageEnvironment = environmentFor(catalogs);
  syncPractisedLevels(backup.progress, true);
  product = createProductState(environment, backup.progress, performance.now());
  pilotHistory = backup.pilotHistory;
  progressHistory = backup.progressHistory;
  recoveredFromInvalidState = false;
  recoveredPilotHistory = false;
  inspectionAdvanceCount = 0;
  clearPreviousResult();
  try {
    saveSelectionTuning(localStorage, selectionTuning);
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
    // Automatic evaluation rounds were removed, so this no longer mentions
    // them; it does name the progress trend and the levels that were unlocked,
    // both of which go with the measurements they were earned from.
    items: ["練習進度", "最近紀錄", "弱點量測", "進步趨勢", "稀有度解鎖"],
  }],
  // The one thing a learner can still fall back on, and the only reassurance
  // worth the line. What the site itself keeps is not a plausible worry.
  note: "已下載的存檔檔案不受影響。",
  confirmLabel: "清除全部資料",
  tone: "danger",
};

async function resetProgress(): Promise<void> {
  if (!await confirmDialog.confirm(RESET_CONFIRMATION)) return;

  const clearing = clearLocalRecords(localStorage);
  storageWarning = clearing.storageWarning;

  const progress = createFreshProgressForEnvironment(
    storageEnvironment,
    newSeed(),
    "guided",
    STANDARD_BOPOMOFO_LAYOUT.id,
  );
  // Cleared measurements mean nothing is unlocked any more, so practice returns
  // to the most common level exactly as it does for a first run.
  syncPractisedLevels(progress);
  clearUnlockNotice();
  product = createProductState(environment, progress, performance.now());
  pilotHistory = pilotHistoryFromProgress(progress);
  progressHistory = createEmptyProgressHistory(progress.mode, progress.layoutId);
  recoveredFromInvalidState = false;
  recoveredPilotHistory = false;
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
    environment.measurementPolicy,
  );
  pilotHistory = appendPilotRoundRecord(pilotHistory, record);
  // History is folded exactly here: once, after the round is finalized and the
  // measurement decisions for it are settled. Opening diagnostics, reloading,
  // or re-importing a backup never re-enters this path, and the append itself
  // ignores rounds it has already seen.
  progressHistory = appendRoundToProgressHistory({
    history: progressHistory,
    exercise: product.round.exercise,
    traces: product.session.traces,
    measurementPolicy: environment.measurementPolicy,
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

  // Selection is deterministic by seed. Vary only the temporary selection
  // seed and retry a few times so F8 normally shows a genuinely different
  // prompt without recording a fake completion or modifying learner state.
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

/**
 * Opens every commonness level for this page, or closes the override again.
 *
 * Nothing is written: the learner's measurements, unlock progress and level
 * preference are untouched, so reloading returns to what was actually earned.
 * The preference still applies, so a level switched off stays off.
 */
function toggleInspectionUnlock(): void {
  inspectionUnlockAll = !inspectionUnlockAll;
  syncPractisedLevels(product.progress);
  showUnlockNotice(inspectionUnlockAll
    ? "檢視用：已開放全部稀有度，重新載入後回到實際解鎖狀態。"
    : "檢視用開放已關閉，回到實際解鎖狀態。");
}

/**
 * Types the rest of the current sentence correctly and finishes the round.
 *
 * Each input is preceded by an unmapped guard input, which is exactly the
 * interaction-noise case the measurement policy already excludes timing for: a
 * machine typing at machine speed must not leave 0 ms best times behind. The
 * correctness observations are real and do count -- the round is recorded as a
 * clean one -- so this inflates accuracy and the practised-key counters. Use F9
 * to look at rarer vocabulary; this key is for driving the round flow.
 */
function completeRoundForInspection(): void {
  if (product.summary !== null) return;
  const completedAt = new Date().toISOString();
  while (product.summary === null) {
    const target = product.session.targets[product.session.position];
    if (target === undefined) return;
    for (const actualToken of [null, target.tokenId]) {
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
});

capture.addEventListener("compositionend", () => {
  compositionActive = false;
  imeWarning = false;
  capture.value = "";
  updatePracticeState();
  focusCapture(true);
});

capture.addEventListener("input", (event) => {
  if (!(event instanceof InputEvent) || !event.isComposing) capture.value = "";
});

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
    && latest?.outcome === "correct"
  ) {
    clearPreviousResult();
  }
  if (beforeSummary === null && product.summary !== null) {
    completeRoundAndAdvance();
    return;
  }
  updatePracticeState();
  updateTopbar();
});

document.addEventListener("keydown", (event) => {
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
}, { capture: true });

window.addEventListener("focus", () => focusCapture());

mountShell();
renderNotices();
mountPracticeRound();
updateTopbar();
if (!loadedExistingProgress) persistProgress();
focusCapture();
