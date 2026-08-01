// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { LOCAL_SELECTION_TUNING_KEY } from "../../src/app/selection-tuning.js";
import type { StorageLike } from "../../src/app/persistence-transaction.js";
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

/** Counts writes per key, so "saved on change, not on input" is observable. */
function createRecordingStorage(): StorageLike & { readonly writes: string[] } {
  const backing = createMemoryStorage();
  const writes: string[] = [];
  return {
    writes,
    getItem: (key) => backing.getItem(key),
    setItem: (key, value) => {
      writes.push(key);
      backing.setItem(key, value);
    },
    removeItem: (key) => backing.removeItem(key),
  };
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
