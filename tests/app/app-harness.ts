import { createApp, type App } from "../../src/app/create-app.js";
import { mountAnalysisV2Integration } from "../../src/app/analysis-v2-integration.js";
import type { StorageLike } from "../../src/app/persistence-transaction.js";

/**
 * Builds a running shell over the test document.
 *
 * The body markup is the part of `index.html` the app requires: the capture
 * textarea and the live target region live outside `#app`, because mounting the
 * shell replaces `#app`'s markup wholesale and would take them with it.
 */
const SHELL_MARKUP = `
  <p id="practice-input-instructions" class="visually-hidden"></p>
  <p id="practice-current-target" class="visually-hidden" role="status" aria-live="polite" aria-atomic="true"></p>
  <textarea id="keyboard-capture" class="keyboard-capture"></textarea>
  <div id="app"></div>`;

/**
 * jsdom ships no `matchMedia`, and code that asks it whether motion should be
 * reduced throws rather than getting an answer. The stub reports "no preference
 * expressed", which is the same answer a default browser gives, so animated
 * paths run here exactly as they do for most learners.
 */
export function installMatchMedia(matches = false): void {
  if (typeof window.matchMedia === "function") return;
  window.matchMedia = (query: string): MediaQueryList => ({
    matches,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  });
}

/**
 * jsdom 30 reflects a dialog's `open` attribute but ships none of its methods,
 * so the shell's panel cannot be opened without this.
 *
 * What is reproduced is the bookkeeping a dialog does and the application can
 * observe: open state, the return value a submit button writes, and the `close`
 * event. What is deliberately NOT reproduced is everything that makes a modal
 * modal -- the top layer, the backdrop, inertness of the content behind it, and
 * focus containment. Those are the platform's, a shim can only pretend to have
 * them, and a test that asserted them here would pass for the wrong reason. Any
 * rule about them stays pinned to the source or to the manual protocol; see the
 * containment block in `confirm-dialog.test.ts`.
 */
let dialogSupportInstalled = false;

function installDialogSupport(): void {
  if (dialogSupportInstalled) return;
  dialogSupportInstalled = true;

  const proto = window.HTMLDialogElement.prototype;
  Object.defineProperty(proto, "returnValue", {
    value: "",
    writable: true,
    configurable: true,
  });
  const open = function (this: HTMLDialogElement): void {
    this.open = true;
  };
  proto.show = open;
  proto.showModal = open;
  proto.close = function (this: HTMLDialogElement, returnValue?: string): void {
    if (!this.open) return;
    if (returnValue !== undefined) this.returnValue = returnValue;
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };

  // A submit button in `<form method="dialog">` closes the dialog with its own
  // value as the return value. That is how both confirmations deliver their
  // answer, and it is application-visible bookkeeping rather than modality, so
  // reproducing it does not fake anything the platform alone provides. Buttons
  // that opt out with `type="button"` -- the panel's own close control -- submit
  // nothing, exactly as in a browser.
  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof window.HTMLButtonElement) || target.type !== "submit") return;
    const form = target.closest("form");
    if (form?.getAttribute("method") !== "dialog") return;
    // A dialog form never navigates, so the submission jsdom would otherwise
    // attempt -- and log as unimplemented -- is not a thing a browser does here.
    event.preventDefault();
    form.closest("dialog")?.close(target.value);
  });
}

export function createMemoryStorage(seed: Record<string, string> = {}): StorageLike {
  const entries = new Map(Object.entries(seed));
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => void entries.set(key, value),
    removeItem: (key) => void entries.delete(key),
  };
}

/** A storage that reads back but refuses every write, as a blocked one does. */
export function createUnwritableStorage(): StorageLike {
  const backing = createMemoryStorage();
  return {
    getItem: (key) => backing.getItem(key),
    setItem: () => {
      throw new Error("storage is full");
    },
    removeItem: (key) => backing.removeItem(key),
  };
}

export interface MountedApp {
  readonly app: App;
  readonly root: HTMLElement;
  readonly capture: HTMLTextAreaElement;
  readonly storage: StorageLike;
  /** Fails loudly rather than returning null: every caller needs the element. */
  find<T extends Element>(selector: string): T;
  readonly dialog: HTMLDialogElement;
  /** The stacked confirmation, present from the moment an action asks. */
  readonly confirmDialog: HTMLDialogElement;
  openPanel(): void;
  /**
   * Answers the open confirmation and settles the action it was blocking.
   *
   * The answer travels back through a promise, so the caller has to be awaited
   * before the effect of accepting is on the page.
   */
  answerConfirm(choice: "accept" | "cancel"): Promise<void>;
  /**
   * Tears the instance down, and by default clears the document after it.
   *
   * `keepDocument` leaves the markup -- and with it the same capture textarea --
   * standing, which is the only way a test can ask whether a destroyed instance
   * really let go of the element it was listening on. Wiping the body is
   * otherwise indistinguishable from a correct teardown, because the listeners
   * go with the element whether they were removed or not.
   */
  destroy(options?: { readonly keepDocument?: boolean }): void;
}

export interface MountOptions {
  readonly storage?: StorageLike;
  readonly onRoundMounted?: (stage: HTMLElement) => void;
  /**
   * Composes Analysis V2 over the shell exactly as `browser.ts` does.
   *
   * The two only meet through the handles they exchange, so wiring them the
   * same way here is what makes that meeting assertable rather than something
   * only the real page performs.
   */
  readonly diagnostics?: boolean;
  /**
   * Builds over the markup already in the document instead of laying down fresh
   * markup, so a second instance meets the very elements the first one did.
   *
   * Pairs with `destroy({ keepDocument: true })`. Only a remount on the same
   * capture textarea can show that two instances are not both answering it.
   */
  readonly reuseDocument?: boolean;
}

export function mountApp(options: MountOptions = {}): MountedApp {
  installDialogSupport();
  installMatchMedia();
  if (options.reuseDocument !== true) document.body.innerHTML = SHELL_MARKUP;
  const storage = options.storage ?? createMemoryStorage();
  const root = document.querySelector<HTMLElement>("#app");
  const capture = document.querySelector<HTMLTextAreaElement>("#keyboard-capture");
  if (root === null || capture === null) throw new Error("test shell did not mount");

  let seed = 0;
  let app: App | null = null;
  const analysisV2 = options.diagnostics === true
    ? mountAnalysisV2Integration({
      closePanel: () => app?.closePanel(),
      focusPractice: () => app?.focusPractice(),
      getSnapshot: () => app?.getAnalysisV2Snapshot() ?? null,
      storage: createMemoryStorage(),
    })
    : null;

  app = createApp({
    root,
    capture,
    storage,
    // Fixed rather than random: selection is deterministic by seed, so a stable
    // seed is what makes a round assertable.
    newSeed: () => `test-seed-${(seed += 1)}`,
    // Spread rather than passed as `undefined`: the project builds with
    // `exactOptionalPropertyTypes`, where an absent property and one set to
    // `undefined` are not the same thing.
    ...options.onRoundMounted === undefined
      ? {}
      : { onRoundMounted: options.onRoundMounted },
    ...analysisV2 === null
      ? {}
      : { onPanelRendered: (content: HTMLElement) => analysisV2.panelRendered(content) },
  });
  const mountedApp = app;

  const find = <T extends Element>(selector: string): T => {
    const element = document.querySelector<T>(selector);
    if (element === null) throw new Error(`Missing element in test shell: ${selector}`);
    return element;
  };

  return {
    app: mountedApp,
    root,
    capture,
    storage,
    find,
    get dialog(): HTMLDialogElement {
      return find<HTMLDialogElement>("#information-dialog");
    },
    get confirmDialog(): HTMLDialogElement {
      return find<HTMLDialogElement>("#confirm-dialog");
    },
    openPanel(): void {
      find<HTMLButtonElement>("#open-information").click();
    },
    async answerConfirm(choice: "accept" | "cancel"): Promise<void> {
      const dialog = find<HTMLDialogElement>("#confirm-dialog");
      if (!dialog.open) throw new Error("no confirmation is open to answer");
      find<HTMLButtonElement>(`#confirm-dialog .confirm-${choice}`).click();
      // Two turns: one for the `confirm` promise to resolve, one for the action
      // that was awaiting it to run to completion.
      await Promise.resolve();
      await Promise.resolve();
    },
    destroy(options: { readonly keepDocument?: boolean } = {}): void {
      analysisV2?.destroy();
      mountedApp.destroy();
      if (options.keepDocument !== true) document.body.innerHTML = "";
    },
  };
}

/** Types one physical key into the capture textarea, as the shell listens for it. */
export function pressKey(
  capture: HTMLTextAreaElement,
  init: KeyboardEventInit & { readonly code: string },
): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { bubbles: true, cancelable: true, ...init });
  capture.dispatchEvent(event);
  return event;
}
