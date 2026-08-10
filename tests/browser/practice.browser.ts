import { expect, test, type Page } from "@playwright/test";
import { tokenLabel } from "../../src/diagnostics/labels.js";
import { STANDARD_BOPOMOFO_LAYOUT } from "../../src/scheme/standard-layout.js";

const PROGRESS_KEY = "bopomofo-trainer.progress.v4";
const CODE_BY_TOKEN_LABEL = new Map(
  Object.entries(STANDARD_BOPOMOFO_LAYOUT.bindings).map(([code, token]) => [tokenLabel(token), code]),
);

function dialog(page: Page) {
  return page.locator("#information-dialog");
}

function confirmation(page: Page) {
  return page.locator("#confirm-dialog");
}

async function openPanel(page: Page): Promise<void> {
  await page.locator("#open-information").click();
  await expect(dialog(page)).toHaveJSProperty("open", true);
}

async function revealWantedKey(page: Page): Promise<string> {
  await openPanel(page);
  await page.locator("#toggle-keyboard-sketch").check();
  await page.locator("#information-dialog .dialog-close").click();
  await expect(dialog(page)).toHaveJSProperty("open", false);
  const code = await page.locator(".keyboard-sketch-key.current").first().getAttribute("data-code");
  expect(code, "the shell marks at least one acceptable current key").not.toBeNull();
  return code ?? "";
}

function storedProgress(page: Page): Promise<string | null> {
  return page.evaluate((key) => window.localStorage.getItem(key), PROGRESS_KEY);
}

function codeForLabel(label: string): string {
  const code = CODE_BY_TOKEN_LABEL.get(label.trim());
  if (code === undefined) throw new Error(`no standard-layout key for token label ${label}`);
  return code;
}

async function currentRoundCodes(page: Page): Promise<string[]> {
  const labels = await page.locator(".reading-token").allTextContents();
  return labels.map(codeForLabel);
}

async function currentPendingBodyLabels(page: Page): Promise<string[]> {
  return page.locator(".practice-glyph.current .reading-token.pending").allTextContents();
}

async function currentToneCode(page: Page): Promise<string> {
  const label = await page.locator(".practice-glyph.current .reading-token.commit-ready").textContent();
  if (label === null) throw new Error("expected current syllable tone to be commit-ready");
  return codeForLabel(label);
}

async function completeCurrentSyllableInReverse(page: Page): Promise<void> {
  const labels = await currentPendingBodyLabels(page);
  for (const label of [...labels].reverse()) {
    await page.keyboard.press(codeForLabel(label), { delay: 0 });
  }
  await expect(page.locator(".practice-glyph.current .reading-token.pending")).toHaveCount(0);
  await expect(page.locator(".practice-glyph.current .reading-token.commit-ready")).toHaveCount(1);
  await page.keyboard.press(await currentToneCode(page), { delay: 0 });
}

async function completedRoundCount(page: Page): Promise<number> {
  return page.evaluate((key) => {
    const source = window.localStorage.getItem(key);
    if (source === null) return 0;
    return Number((JSON.parse(source) as { practiceRoundsCompleted?: number }).practiceRoundsCompleted ?? 0);
  }, PROGRESS_KEY);
}

test("loads the practice page with a round and a clean console", async ({ page }) => {
  const problems: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") problems.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));

  await page.goto("/");
  await expect(page.locator(".practice-glyph").first()).toBeVisible();
  await expect(page.locator("#progress-count")).toHaveText(/^0 \/ \d+$/);
  expect(problems).toEqual([]);
});

test("advances the round on any key the current syllable accepts", async ({ page }) => {
  await page.goto("/");
  const code = await revealWantedKey(page);
  const total = (await page.locator("#progress-count").textContent())?.split(" / ").at(-1);

  await page.keyboard.press(code);

  await expect(page.locator("#progress-count")).toHaveText(`1 / ${total}`);
  await expect(page.locator(".reading-token.done").first()).toBeVisible();
});

test("accepts body components in reverse canonical order before tone commit", async ({ page }) => {
  await page.goto("/");

  // Walk to a multi-component syllable if the first one is a one-key body.
  for (let guard = 0; guard < 20; guard += 1) {
    const labels = await currentPendingBodyLabels(page);
    if (labels.length >= 2) {
      const firstCanonical = labels[0]!;
      const lastCanonical = labels.at(-1)!;
      const before = await page.locator("#progress-count").textContent();

      await page.keyboard.press(codeForLabel(lastCanonical), { delay: 0 });
      await expect(page.locator(".practice-glyph.current .reading-token.done").filter({ hasText: lastCanonical }))
        .toHaveCount(1);
      await expect(page.locator("#practice-feedback")).not.toHaveClass(/error/);
      expect(await page.locator("#progress-count").textContent()).not.toBe(before);

      const stillPending = await currentPendingBodyLabels(page);
      expect(stillPending).toContain(firstCanonical);
      await expect(page.locator(".practice-glyph.current .reading-token.commit-locked")).toHaveCount(1);

      for (const label of [...stillPending].reverse()) {
        await page.keyboard.press(codeForLabel(label), { delay: 0 });
      }
      await expect(page.locator(".practice-glyph.current .reading-token.pending")).toHaveCount(0);
      await expect(page.locator(".practice-glyph.current .reading-token.commit-ready")).toHaveCount(1);
      return;
    }
    await completeCurrentSyllableInReverse(page);
  }
  throw new Error("expected a multi-component syllable within the first 20 syllables");
});

test("accepts overlapping keydown events without dropping the second key", async ({ page }) => {
  await page.goto("/");
  const codes = await currentRoundCodes(page);
  expect(codes.length).toBeGreaterThanOrEqual(2);
  expect(codes[0]).not.toBe(codes[1]);

  await page.keyboard.down(codes[0] ?? "");
  await page.keyboard.down(codes[1] ?? "");
  await page.keyboard.up(codes[0] ?? "");
  await page.keyboard.up(codes[1] ?? "");

  await expect(page.locator("#progress-count")).toHaveText(/^2 \/ \d+$/);
});

test("completes a full round with zero-delay reverse-body input", async ({ page }) => {
  await page.goto("/");
  const before = await completedRoundCount(page);

  for (let guard = 0; guard < 80 && await completedRoundCount(page) === before; guard += 1) {
    await completeCurrentSyllableInReverse(page);
  }

  await expect.poll(() => completedRoundCount(page)).toBe(before + 1);
  await expect(page.locator("#progress-count")).toHaveText(/^0 \/ \d+$/);
  await expect(page.locator("#keyboard-capture")).toBeFocused();
});

test("keeps practice focus through a synchronous round-boundary burst", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#keyboard-capture")).toBeFocused();
  const firstRoundCodes = await currentRoundCodes(page);

  const result = await page.evaluate(({ codes, codeByLabel }) => {
    const targets: string[] = [];
    const dispatch = (code: string): void => {
      const target = document.activeElement;
      if (!(target instanceof HTMLElement)) {
        throw new Error("practice has no active HTMLElement");
      }
      targets.push(target.id || target.tagName);
      target.dispatchEvent(new KeyboardEvent("keydown", {
        code,
        key: code === "Space" ? " " : code,
        bubbles: true,
        cancelable: true,
        composed: true,
        repeat: false,
      }));
    };

    for (const code of codes) dispatch(code);

    const nextLabel = document.querySelector<HTMLElement>(".reading-token.current")?.textContent?.trim() ?? "";
    const nextCode = codeByLabel[nextLabel];
    if (nextCode === undefined) {
      throw new Error(`next rendered token has no physical key: ${nextLabel}`);
    }
    dispatch(nextCode);

    return {
      targets,
      progress: document.querySelector<HTMLElement>("#progress-count")?.textContent ?? "",
    };
  }, {
    codes: firstRoundCodes,
    codeByLabel: Object.fromEntries(CODE_BY_TOKEN_LABEL),
  });

  expect(result.targets.every((target) => target === "keyboard-capture")).toBe(true);
  expect(result.progress).toMatch(/^1 \/ \d+$/);
  await expect.poll(() => completedRoundCount(page)).toBe(1);
});

test("opens and closes the panel with Escape and returns focus to practice", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#keyboard-capture")).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveJSProperty("open", true);

  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveJSProperty("open", false);
  await expect(page.locator("#keyboard-capture")).toBeFocused();
});

test("closes only the top dialog when a confirmation stacks over the panel", async ({ page }) => {
  await page.goto("/");
  await openPanel(page);
  await page.locator("#reset-progress").click();
  await expect(confirmation(page)).toHaveJSProperty("open", true);

  await page.keyboard.press("Escape");

  await expect(confirmation(page)).toHaveJSProperty("open", false);
  await expect(dialog(page)).toHaveJSProperty("open", true);
});

test("fits the narrowest supported viewport without scrolling sideways", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.goto("/");
  await expect(page.locator(".practice-glyph").first()).toBeVisible();

  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));

  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
});

test("restores progress through export, clear and import", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.keyboard.press("F10");
  await expect.poll(() => storedProgress(page)).not.toBeNull();
  const earned = await storedProgress(page);

  await openPanel(page);
  const download = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#download-backup").click(),
  ]).then(([event]) => event);
  const backup = testInfo.outputPath("backup.json");
  await download.saveAs(backup);

  await page.locator("#reset-progress").click();
  await page.locator("#confirm-dialog .confirm-accept").click();
  await expect.poll(() => storedProgress(page)).not.toBe(earned);

  await page.locator("#import-backup").setInputFiles(backup);
  await page.locator("#confirm-dialog .confirm-accept").click();

  await expect.poll(() => storedProgress(page)).toBe(earned);
});
