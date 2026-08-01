import { createApp, type App } from "../../src/app/create-app.js";
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
 * jsdom 30 reflects a dialog's `open` attribute but ships none of its methods,
 * so the shell's panel cannot be opened without this. Only the observable
 * contract is reproduced -- open state, a return value, and the `close` event
 * the shell listens on -- not the top layer or the backdrop, neither of which
 * anything here asserts.
 */
function installDialogSupport(): void {
  const proto = window.HTMLDialogElement.prototype;
  if (typeof proto.showModal === "function") return;
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
    if (returnValue !== undefined) this.returnValue = returnValue;
    if (!this.open) return;
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
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
  openPanel(): void;
  destroy(): void;
}

export interface MountOptions {
  readonly storage?: StorageLike;
  readonly onRoundMounted?: (stage: HTMLElement) => void;
}

export function mountApp(options: MountOptions = {}): MountedApp {
  installDialogSupport();
  document.body.innerHTML = SHELL_MARKUP;
  const storage = options.storage ?? createMemoryStorage();
  const root = document.querySelector<HTMLElement>("#app");
  const capture = document.querySelector<HTMLTextAreaElement>("#keyboard-capture");
  if (root === null || capture === null) throw new Error("test shell did not mount");

  let seed = 0;
  const app = createApp({
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
  });

  const find = <T extends Element>(selector: string): T => {
    const element = document.querySelector<T>(selector);
    if (element === null) throw new Error(`Missing element in test shell: ${selector}`);
    return element;
  };

  return {
    app,
    root,
    capture,
    storage,
    find,
    get dialog(): HTMLDialogElement {
      return find<HTMLDialogElement>("#information-dialog");
    },
    openPanel(): void {
      find<HTMLButtonElement>("#open-information").click();
    },
    destroy(): void {
      app.destroy();
      document.body.innerHTML = "";
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
