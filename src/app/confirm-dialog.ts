import { escapeHtml } from "./html.js";

/**
 * One shared confirmation for the two actions that can destroy local progress.
 *
 * `window.confirm()` could only carry a sentence, which is why importing a
 * backup said no more than that it would replace things. This can name what
 * goes and show the two generations side by side, and it does that without
 * becoming a modal framework: two answers, no input, no nesting, no wizard.
 *
 * Containment is the platform's. `showModal()` puts the dialog in the top layer,
 * where the browser already handles the backdrop, the inertness of everything
 * behind it, and keeping Tab inside -- all of it more correctly than a
 * hand-rolled focus trap, and with no dependency. What is handled here is only
 * what the platform leaves open: which surface Escape belongs to when a dialog
 * is stacked over the information panel, and where focus returns afterwards.
 */

const CONFIRM_TITLE_ID = "confirm-dialog-title";

export interface ConfirmDialogSection {
  readonly heading: string;
  readonly items: readonly string[];
}

export interface ConfirmDialogOptions {
  readonly title: string;
  readonly sections: readonly ConfirmDialogSection[];
  /** Shown below the sections. Empty when there is nothing to add. */
  readonly note: string;
  readonly confirmLabel: string;
  readonly tone: "normal" | "danger";
}

export interface ConfirmDialogController {
  /** Resolves true only when the learner accepted. */
  confirm(options: ConfirmDialogOptions): Promise<boolean>;
  destroy(): void;
}

/**
 * Cancel is written first on purpose. It is the form's default submit button, so
 * Enter answers with the reversible choice, and it is what receives focus when
 * the dialog opens.
 */
export function confirmDialogMarkup(options: ConfirmDialogOptions): string {
  const sections = options.sections.map((section) => `<section class="confirm-section">
        <h3>${escapeHtml(section.heading)}</h3>
        <ul class="confirm-items">${section.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
      </section>`).join("");
  const note = options.note === ""
    ? ""
    : `<p class="confirm-note">${escapeHtml(options.note)}</p>`;
  return `<form method="dialog" class="confirm-form">
      <h2 id="${CONFIRM_TITLE_ID}" class="confirm-title">${escapeHtml(options.title)}</h2>
      <div class="confirm-sections">${sections}</div>
      ${note}
      <div class="confirm-actions">
        <button class="confirm-cancel" value="cancel">取消</button>
        <button class="confirm-accept${options.tone === "danger" ? " danger" : ""}" value="accept">${escapeHtml(options.confirmLabel)}</button>
      </div>
    </form>`;
}

export function createConfirmDialog(parent: HTMLElement): ConfirmDialogController {
  const dialog = document.createElement("dialog");
  dialog.id = "confirm-dialog";
  dialog.className = "confirm-dialog";
  dialog.setAttribute("aria-labelledby", CONFIRM_TITLE_ID);
  parent.append(dialog);

  let settle: ((confirmed: boolean) => void) | null = null;
  let opener: HTMLElement | null = null;

  /**
   * Escape has to reach the topmost surface and no other. The shell's own
   * handler listens on `document` in the capture phase and closes the
   * information panel, and a confirmation stacked over that panel would
   * otherwise take the panel with it.
   *
   * Capture order runs window before document, so stopping propagation here
   * keeps the event from ever reaching that handler. The default is deliberately
   * left alone: closing the top dialog is precisely what Escape should do, and
   * the browser already does it.
   */
  const interceptEscape = (event: KeyboardEvent): void => {
    if (!dialog.open || event.key !== "Escape") return;
    event.stopImmediatePropagation();
  };

  // Every way out arrives here -- either button, Escape, or a caller tearing the
  // dialog down -- so the answer is delivered exactly once however it was given.
  // Focus returns before the answer does: the caller may replace the panel this
  // was opened from, and its choice of where focus lands has to be the one that
  // survives.
  dialog.addEventListener("close", () => {
    window.removeEventListener("keydown", interceptEscape, { capture: true });
    const resolve = settle;
    const returnTo = opener;
    settle = null;
    opener = null;
    if (returnTo?.isConnected === true) returnTo.focus({ preventScroll: true });
    resolve?.(dialog.returnValue === "accept");
  });

  return {
    confirm(options: ConfirmDialogOptions): Promise<boolean> {
      // One dialog cannot answer two questions at once. The shell already
      // refuses to start a second import while one is running, so this is
      // unreachable by design; declining is the safe direction for both of the
      // actions it serves, so it fails closed rather than throwing into a
      // click handler.
      if (dialog.open) return Promise.resolve(false);
      opener = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
      // The previous answer would otherwise still be here to be read as this
      // one's.
      dialog.returnValue = "";
      dialog.innerHTML = confirmDialogMarkup(options);
      const answer = new Promise<boolean>((resolve) => { settle = resolve; });
      window.addEventListener("keydown", interceptEscape, { capture: true });
      dialog.showModal();
      dialog.querySelector<HTMLButtonElement>(".confirm-cancel")
        ?.focus({ preventScroll: true });
      return answer;
    },
    destroy(): void {
      window.removeEventListener("keydown", interceptEscape, { capture: true });
      // Closing rather than removing outright, so a pending caller is answered
      // instead of waiting on a promise that can no longer settle.
      if (dialog.open) dialog.close();
      dialog.remove();
    },
  };
}
