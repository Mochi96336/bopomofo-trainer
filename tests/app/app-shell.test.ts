// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { LOCAL_SELECTION_TUNING_KEY } from "../../src/app/selection-tuning.js";
import {
  LOCAL_PROGRESS_KEY,
  type StorageLike,
} from "../../src/app/persistence-transaction.js";
import {
  createMemoryStorage,
  createUnwritableStorage,
  mountApp,
  pressKey,
  type MountedApp,
} from "./app-harness.js";

/**
 * The behavioural half of what used to be asserted by reading `main.ts` as
 * text. Those checks could only describe the shape of the source -- that a call
 * appeared inside a function, that one string came before another -- so they
 * went red on a rename and stayed green on a regression. The shell is built
 * here instead and driven the way a learner drives it.
 */

let mounted: MountedApp | null = null;

function mount(storage?: StorageLike): MountedApp {
  mounted = mountApp(storage === undefined ? {} : { storage });
  return mounted;
}

afterEach(() => {
  mounted?.destroy();
  mounted = null;
});

/** Records traffic per key, so what was saved and cleared is observable. */
function createRecordingStorage(): StorageLike & {
  readonly writes: string[];
  readonly removals: string[];
} {
  const backing = createMemoryStorage();
  const writes: string[] = [];
  const removals: string[] = [];
  return {
    writes,
    removals,
    getItem: (key) => backing.getItem(key),
    setItem: (key, value) => {
      writes.push(key);
      backing.setItem(key, value);
    },
    removeItem: (key) => {
      removals.push(key);
      backing.removeItem(key);
    },
  };
}

/**
 * The physical key the current token wants, read the way the shell marks it.
 *
 * The keyboard hint is off by default, and turning it on is the only honest way
 * for a test to find that key rather than reimplement the layout.
 */
function revealWantedKey(app: MountedApp): string {
  app.openPanel();
  app.find<HTMLInputElement>("#toggle-keyboard-sketch").click();
  app.dialog.close();
  const code = app.find<HTMLElement>(".keyboard-sketch-key.current").dataset.code;
  if (code === undefined) throw new Error("expected a marked key for the current token");
  return code;
}

function setRange(input: HTMLInputElement, value: string, event: "input" | "change"): void {
  input.value = value;
  input.dispatchEvent(new Event(event, { bubbles: true }));
}

describe("practice shell mounting", () => {
  it("mounts a round with a target and a capture surface", () => {
    const app = mount();
    expect(app.find("#practice-stage").querySelectorAll(".practice-glyph").length)
      .toBeGreaterThan(0);
    expect(app.find("#progress-count").textContent).toMatch(/^0 \/ \d+$/);
  });

  it("builds a second instance over the same document", () => {
    const first = mount();
    const targets = first.find("#progress-count").textContent;
    first.destroy();
    const second = mount();
    expect(second.find("#progress-count").textContent).toBe(targets);
  });

  // A destroyed instance still holding the document listener would answer keys
  // meant for its replacement, which is the failure this whole split exists to
  // make testable in the first place.
  it("stops answering global keys once destroyed", () => {
    const app = mount();
    app.app.destroy();
    document.dispatchEvent(new KeyboardEvent("keydown", {
      code: "Escape",
      bubbles: true,
      cancelable: true,
    }));
    expect(document.querySelector<HTMLDialogElement>("#information-dialog")?.open)
      .not.toBe(true);
  });

  // The global listener above is only half of what an instance holds. The rest
  // sits on the capture textarea, which lives outside `#app` and therefore
  // survives everything a remount replaces. Tearing the document down after
  // `destroy()` would take those listeners with it whether they were released or
  // not, so this keeps the document standing and asks the element itself.
  it("stops answering keys on the capture it was built over once destroyed", () => {
    const app = mount();
    const code = revealWantedKey(app);
    const position = app.find("#progress-count").textContent;
    const stage = app.find("#practice-stage").innerHTML;
    const stored = app.storage.getItem(LOCAL_PROGRESS_KEY);

    app.destroy({ keepDocument: true });
    pressKey(app.capture, { code });

    expect(app.find("#progress-count").textContent).toBe(position);
    expect(app.find("#practice-stage").innerHTML).toBe(stage);
    expect(app.storage.getItem(LOCAL_PROGRESS_KEY)).toBe(stored);
  });

  // The other direction: releasing the capture must not leave it unusable for
  // the instance that comes next. This one meets the very elements the first was
  // built over, which a remount that lays down fresh markup never does.
  it("hands the same capture to a second instance built over it", () => {
    const storage = createMemoryStorage();
    const first = mountApp({ storage });
    first.destroy({ keepDocument: true });

    const second = mountApp({ storage, reuseDocument: true });
    mounted = second;
    expect(second.capture).toBe(first.capture);

    const code = revealWantedKey(second);
    const total = second.find("#progress-count").textContent?.split(" / ").at(-1);
    pressKey(second.capture, { code });

    expect(second.find("#progress-count").textContent).toBe(`1 / ${total}`);
  });
});

describe("diagnostics over a degraded session", () => {
  // Diagnostics used to read module-level mirrors of what had last reached
  // storage. With every write refused nothing was ever mirrored, so the panel
  // described an empty session while practice carried on in memory -- two
  // answers about one session, from a product that promises the session
  // continues. It is handed the shell's live state now.
  it("describes the running session when storage refuses every write", () => {
    const app = mountApp({ storage: createUnwritableStorage(), diagnostics: true });
    mounted = app;
    // Finishes a round, so there are real measurements that no write preserved.
    document.dispatchEvent(new KeyboardEvent("keydown", {
      code: "F10",
      bubbles: true,
      cancelable: true,
    }));
    app.openPanel();

    const meta = app.find(".diagnostic-summary-signals div small").textContent;
    expect(meta).not.toBe("尚無按鍵資料");
    expect(meta).toMatch(/\d+ 次$/);
  });
});

describe("recovery notices", () => {
  // Invalid stored progress is dropped at boot, and the notice explaining why
  // retires on its own. The browser layer used to do this by matching notice
  // text against its own copy of these sentences; the shell owns both now.
  it("shows a recovery notice and retires it without help", () => {
    vi.useFakeTimers();
    try {
      const app = mount(createMemoryStorage({
        [LOCAL_PROGRESS_KEY]: JSON.stringify({ generation: "from-an-older-build" }),
      }));
      const region = app.find("#notice-region");
      expect(region.textContent).toContain("已刪除");

      vi.advanceTimersByTime(6000);
      expect(region.textContent).not.toContain("已刪除");
    } finally {
      vi.useRealTimers();
    }
  });

  // The storage warning is the counter-case: a lasting condition, so no timer
  // retires it.
  it("does not retire the storage warning on the same timer", () => {
    vi.useFakeTimers();
    try {
      const app = mount(createUnwritableStorage());
      vi.advanceTimersByTime(30_000);
      expect(app.find("#notice-region").textContent).toContain("localStorage");
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("round mounting callback", () => {
  // What replaced the browser layer's MutationObserver on the practice stage.
  it("reports every mounted round, including the first", () => {
    const stages: HTMLElement[] = [];
    document.body.innerHTML = "";
    const app = mountApp({ onRoundMounted: (stage) => void stages.push(stage) });
    mounted = app;
    expect(stages).toHaveLength(1);
    expect(stages[0]?.id).toBe("practice-stage");
    // The entries must be in the document by the time it is told, or there is
    // nothing to measure.
    expect(stages[0]?.querySelectorAll(".practice-entry").length).toBeGreaterThan(0);
  });
});

describe("capture keyboard handling", () => {
  // Tab has to stay the browser's, or the information panel cannot be navigated
  // from the keyboard once it is open.
  it("leaves Tab alone even while the information panel is open", () => {
    const app = mount();
    app.openPanel();
    expect(app.dialog.open).toBe(true);
    const event = pressKey(app.capture, { code: "Tab", key: "Tab" });
    expect(event.defaultPrevented).toBe(false);
  });

  it("swallows other keys while the panel is open rather than practising them", () => {
    const app = mount();
    const before = app.find("#progress-count").textContent;
    app.openPanel();
    const event = pressKey(app.capture, { code: "KeyA", key: "a" });
    expect(event.defaultPrevented).toBe(true);
    expect(app.find("#progress-count").textContent).toBe(before);
  });

  it("advances the round on the correct key and reports the position", () => {
    const app = mount();
    const total = app.find("#progress-count").textContent?.split(" / ").at(-1);

    // The keyboard hint is off by default, and turning it on is how the shell
    // marks which physical key the current token wants -- which is also the only
    // honest way for a test to find that key rather than reimplement the layout.
    app.openPanel();
    app.find<HTMLInputElement>("#toggle-keyboard-sketch").click();
    app.dialog.close();
    expect(app.find<HTMLElement>("#keyboard-sketch").hidden).toBe(false);

    const code = app.find<HTMLElement>(".keyboard-sketch-key.current").dataset.code;
    expect(code).toBeDefined();
    pressKey(app.capture, { code: code ?? "" });

    expect(app.find("#progress-count").textContent).toBe(`1 / ${total}`);
    expect(app.find<HTMLElement>(".reading-token.done")).not.toBeNull();
  });

  it("says which key was pressed when it was the wrong one", () => {
    const app = mount();
    app.openPanel();
    app.find<HTMLInputElement>("#toggle-keyboard-sketch").click();
    app.dialog.close();
    const wanted = app.find<HTMLElement>(".keyboard-sketch-key.current").dataset.code;

    const wrong = [...document.querySelectorAll<HTMLElement>(".keyboard-sketch-key")]
      .map((key) => key.dataset.code)
      .find((code) => code !== undefined && code !== wanted && code.startsWith("Key"));
    if (wrong === undefined) throw new Error("expected another mapped key");
    pressKey(app.capture, { code: wrong });

    expect(app.find("#practice-feedback").textContent).toContain("應為");
    expect(app.find("#progress-count").textContent).toMatch(/^0 \//);
  });
});

describe("window focus", () => {
  // The handler must not be `focusCapture` itself: a focus listener is called
  // with the event, the event would arrive as the `force` argument and read as
  // true, and focus would be taken from whatever the learner was using.
  it("does not steal focus from another control", () => {
    const app = mount();
    const button = app.find<HTMLButtonElement>("#open-information");
    button.focus();
    window.dispatchEvent(new Event("focus"));
    expect(document.activeElement).toBe(button);
  });
});

describe("information panel status regions", () => {
  it("keeps the unlock count and the action status as separate elements", () => {
    const app = mount();
    app.openPanel();
    const progress = app.find<HTMLElement>(".rarity-progress");
    const status = app.find<HTMLElement>("#rarity-action-status");
    expect(progress).not.toBe(status);
    expect(progress.textContent?.trim()).not.toBe("");
    expect(status.textContent?.trim()).toBe("");
  });

  // The defect this replaces: a reply to a press was written where the unlock
  // count lived, so changing a level cost the learner the progress they changed
  // it against.
  it("keeps the unlock count readable after a level is changed", () => {
    const app = mount();
    // The review override opens every level, which is what makes more than one
    // toggle pressable on a fresh generation.
    document.dispatchEvent(new KeyboardEvent("keydown", {
      code: "F9",
      key: "F9",
      bubbles: true,
      cancelable: true,
    }));
    app.openPanel();
    const before = app.find<HTMLElement>(".rarity-progress").textContent;
    const toggle = document.querySelector<HTMLButtonElement>(
      "[data-rarity-tier]:not(:disabled)",
    );
    if (toggle === null) throw new Error("expected a pressable rarity toggle");
    toggle.click();
    expect(app.find<HTMLElement>(".rarity-progress").textContent).toBe(before);
    expect(app.find<HTMLElement>("#rarity-action-status").textContent?.trim())
      .not.toBe("");
  });

  it("retires a status with the visit that produced it", () => {
    const app = mount();
    app.openPanel();
    setRange(app.find<HTMLInputElement>("#error-influence"), "150", "change");
    expect(app.find<HTMLElement>("#tuning-notice").textContent?.trim()).not.toBe("");

    app.dialog.close();
    app.openPanel();
    expect(app.find<HTMLElement>("#tuning-notice").textContent?.trim()).toBe("");
  });

  // The storage warning describes a lasting condition, so it lives in the global
  // notice region where no panel visit retires it.
  it("leaves the storage warning standing when panel statuses are retired", () => {
    const app = mount(createUnwritableStorage());
    expect(app.find("#notice-region").textContent).toContain("localStorage");

    app.openPanel();
    setRange(app.find<HTMLInputElement>("#error-influence"), "150", "change");
    expect(app.find<HTMLElement>("#tuning-notice").textContent).toContain("無法保存");

    app.dialog.close();
    expect(app.find("#notice-region").textContent).toContain("localStorage");
  });
});

describe("clearing local progress", () => {
  /**
   * Types exactly one sentence correctly, so there is progress worth losing.
   *
   * The keyboard hint is turned on because the key each token wants is marked
   * there; completion is read off the topbar, which starts reporting a previous
   * sentence the moment one is finished.
   */
  function practiseOneRound(app: MountedApp): void {
    app.openPanel();
    app.find<HTMLInputElement>("#toggle-keyboard-sketch").click();
    app.dialog.close();
    for (let guard = 0; guard < 200; guard += 1) {
      if (app.find("#round-status").textContent?.includes("上一句") === true) return;
      const code = document.querySelector<HTMLElement>(".keyboard-sketch-key.current")
        ?.dataset.code;
      if (code === undefined) break;
      pressKey(app.capture, { code });
    }
    throw new Error("no round completed");
  }

  it("asks before clearing, and names what goes", () => {
    const app = mount();
    app.openPanel();
    app.find<HTMLButtonElement>("#reset-progress").click();

    const confirm = app.confirmDialog;
    expect(confirm.open).toBe(true);
    expect(confirm.getAttribute("aria-labelledby")).toBe("confirm-dialog-title");
    expect(confirm.querySelector("#confirm-dialog-title")?.textContent)
      .toBe("清除所有本機進度？");
    expect(confirm.textContent).toContain("清除所有本機進度？");
    expect(confirm.textContent).toContain("練習進度");
    // The one reassurance worth the line.
    expect(confirm.textContent).toContain("已下載的存檔檔案不受影響。");
  });

  it("keeps the progress when the learner declines", async () => {
    const app = mount();
    practiseOneRound(app);
    const rounds = app.find("#round-status").textContent;

    app.openPanel();
    app.find<HTMLButtonElement>("#reset-progress").click();
    await app.answerConfirm("cancel");

    expect(app.confirmDialog.open).toBe(false);
    // Still open, because declining is not an outcome worth closing the panel for.
    expect(app.dialog.open).toBe(true);
    expect(app.find("#round-status").textContent).toBe(rounds);
  });

  it("clears the progress and the stored records when the learner accepts", async () => {
    const storage = createRecordingStorage();
    const app = mount(storage);
    practiseOneRound(app);
    expect(storage.getItem(LOCAL_PROGRESS_KEY)).not.toBeNull();

    app.openPanel();
    app.find<HTMLButtonElement>("#reset-progress").click();
    await app.answerConfirm("accept");

    // Back to a first run: round one, and the panel closed behind the action.
    expect(app.dialog.open).toBe(false);
    expect(app.find("#round-status").textContent).toContain("1");
    expect(app.find("#progress-count").textContent).toMatch(/^0 \//);
    expect(storage.removals).toContain(LOCAL_PROGRESS_KEY);
  });

  /**
   * Escape belongs to the topmost surface and no other. Closing the top dialog
   * is the platform's job and is not reproduced here; what is asserted is the
   * half that is application code -- the confirmation's window-level capture
   * listener stops the event before the shell's document-level handler can take
   * the information panel down with it.
   */
  it("keeps Escape from reaching the panel the confirmation stacks over", () => {
    const app = mount();
    app.openPanel();
    app.find<HTMLButtonElement>("#reset-progress").click();
    expect(app.confirmDialog.open).toBe(true);

    app.find<HTMLButtonElement>("#confirm-dialog .confirm-cancel").dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        code: "Escape",
        bubbles: true,
        cancelable: true,
      }),
    );

    expect(app.dialog.open).toBe(true);
  });

  // The confirmation is the only thing standing between a click and the
  // learner's history, so a refusal to answer must not be read as an answer.
  it("does not clear anything while the confirmation is unanswered", () => {
    const storage = createRecordingStorage();
    const app = mount(storage);
    practiseOneRound(app);

    app.openPanel();
    app.find<HTMLButtonElement>("#reset-progress").click();

    expect(storage.removals).not.toContain(LOCAL_PROGRESS_KEY);
    expect(app.find("#progress-count").textContent).not.toMatch(/^0 \/ 0$/);
  });
});

describe("opening analysis from the panel", () => {
  function mountWithDiagnostics(): MountedApp {
    mounted = mountApp({ diagnostics: true });
    return mounted;
  }

  // The diagnostics layer reaches the shell only through the handles the two
  // exchange, so this is the composition `browser.ts` performs, driven.
  it("replaces the weak-keys section with the richer summary", () => {
    const app = mountWithDiagnostics();
    app.openPanel();
    // The enhancement claims the section by rewriting it and dropping the marker
    // the shell left for it, so the marker's absence is the evidence it ran.
    expect(document.querySelector('[data-legacy-weak-section="true"]')).toBeNull();
    const section = app.find<HTMLElement>(".diagnostic-summary-section");
    expect(section.textContent).toContain("弱點診斷");
    expect(section.querySelector(".diagnostic-open-analysis")).not.toBeNull();
  });

  /**
   * Analysis replaces the information panel rather than nesting under it, so
   * the panel has to be closed and focus anchored on practice before the
   * analysis controller captures where to return to. Getting that order wrong
   * leaves the return target pointing at a control inside a panel that is no
   * longer open.
   */
  it("closes the panel and anchors focus on practice before opening", () => {
    const app = mountWithDiagnostics();
    app.openPanel();
    expect(app.dialog.open).toBe(true);

    app.find<HTMLButtonElement>(".diagnostic-open-analysis").click();

    expect(app.dialog.open).toBe(false);
    expect(app.find<HTMLElement>("#diagnostic-analysis").hidden).toBe(false);
    expect(document.activeElement).toBe(app.capture);
  });

  /**
   * The consequence of the order, and what makes the check above more than a
   * restatement of it. The analysis remembers where it was opened from and
   * hands control back there: opened from practice it returns to practice, but
   * had it been opened while the panel was still up it would have recorded the
   * panel instead and put it back on screen on the way out.
   */
  it("returns to practice on close rather than reopening the panel", () => {
    vi.useFakeTimers();
    try {
      const app = mountWithDiagnostics();
      app.openPanel();
      app.find<HTMLButtonElement>(".diagnostic-open-analysis").click();

      app.find<HTMLButtonElement>('#diagnostic-analysis [data-action="close-analysis"]').click();
      vi.advanceTimersByTime(1000);

      expect(app.dialog.open).toBe(false);
      expect(app.find<HTMLElement>("#diagnostic-analysis").hidden).toBe(true);
      expect(document.activeElement).toBe(app.capture);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("selection tuning controls", () => {
  // Rebuilding the panel from the slider's own handler would replace the slider
  // mid-drag, so the status is written into the region already on the page.
  it("does not replace the slider when it reports a change", () => {
    const app = mount();
    app.openPanel();
    const slider = app.find<HTMLInputElement>("#error-influence");
    slider.focus();
    setRange(slider, "150", "change");
    expect(app.find<HTMLInputElement>("#error-influence")).toBe(slider);
    expect(document.activeElement).toBe(slider);
  });

  it("saves on change and not on every intermediate value", () => {
    const storage = createRecordingStorage();
    const app = mount(storage);
    app.openPanel();
    const slider = app.find<HTMLInputElement>("#error-influence");

    storage.writes.length = 0;
    setRange(slider, "75", "input");
    setRange(slider, "125", "input");
    expect(storage.writes).not.toContain(LOCAL_SELECTION_TUNING_KEY);
    expect(app.find<HTMLOutputElement>("#error-influence-value").value).toBe("125%");

    setRange(slider, "150", "change");
    expect(storage.writes).toContain(LOCAL_SELECTION_TUNING_KEY);
  });
});
