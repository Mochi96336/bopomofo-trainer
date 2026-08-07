import { expect, test, type Page } from "@playwright/test";
import { tokenLabel } from "../../src/diagnostics/labels.js";
import { STANDARD_BOPOMOFO_LAYOUT } from "../../src/scheme/standard-layout.js";

/**
 * Six checks, chosen because each one fails for a reason jsdom cannot produce.
 *
 * The shim in the unit harness reproduces a dialog's bookkeeping and nothing of
 * its modality -- no top layer, no backdrop, no focus containment -- so the
 * rules about stacking, focus and layout have until now lived only in a manual
 * protocol. They live here instead. The suite is kept deliberately small: it is
 * a smoke test for the platform's half of the behaviour, not a second home for
 * assertions the unit tests already make better.
 */

const PROGRESS_KEY = "bopomofo-trainer.progress.v4";
const PHYSICAL_CODE_BY_TOKEN_LABEL = Object.fromEntries(
  Object.entries(STANDARD_BOPOMOFO_LAYOUT.bindings).map(([code, tokenId]) => [
    tokenLabel(tokenId),
    code,
  ]),
) as Readonly<Record<string, string>>;

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

/**
 * The physical key the current token wants, read the way the shell marks it.
 *
 * The keyboard hint is off by default, and turning it on is the only honest way
 * for a test to find that key rather than reimplement the layout.
 */
async function revealWantedKey(page: Page): Promise<string> {
  await openPanel(page);
  await page.locator("#toggle-keyboard-sketch").check();
  await page.locator("#information-dialog .dialog-close").click();
  await expect(dialog(page)).toHaveJSProperty("open", false);
  const code = await page.locator(".keyboard-sketch-key.current").getAttribute("data-code");
  expect(code, "the shell marks which key the current token wants").not.toBeNull();
  return code ?? "";
}

async function currentRoundCodes(page: Page): Promise<string[]> {
  const labels = await page.locator(".reading-token").allTextContents();
  return labels.map((label) => {
    const code = PHYSICAL_CODE_BY_TOKEN_LABEL[label];
    expect(code, `the standard layout maps rendered token ${label}`).toBeDefined();
    return code ?? "";
  });
}

function storedProgress(page: Page): Promise<string | null> {
  return page.evaluate((key) => window.localStorage.getItem(key), PROGRESS_KEY);
}

async function storedPracticeRounds(page: Page): Promise<number> {
  const raw = await storedProgress(page);
  if (raw === null) return 0;
  const parsed = JSON.parse(raw) as { practiceRoundsCompleted?: unknown };
  return typeof parsed.practiceRoundsCompleted === "number"
    ? parsed.practiceRoundsCompleted
    : 0;
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

test("advances the round on the key the current token wants", async ({ page }) => {
  await page.goto("/");
  const code = await revealWantedKey(page);
  const total = (await page.locator("#progress-count").textContent())?.split(" / ").at(-1);

  await page.keyboard.press(code);

  await expect(page.locator("#progress-count")).toHaveText(`1 / ${total}`);
  await expect(page.locator(".reading-token.done").first()).toBeVisible();
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

test("completes a round from a zero-delay physical-key burst", async ({ page }) => {
  await page.goto("/");
  const codes = await currentRoundCodes(page);

  for (const code of codes) {
    await page.keyboard.press(code, { delay: 0 });
  }

  await expect.poll(() => storedPracticeRounds(page)).toBe(1);
  await expect(page.locator("#progress-count")).toHaveText(/^0 \/ \d+$/);
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

    const nextLabel = document.querySelector<HTMLElement>(".reading-token.current")?.textContent ?? "";
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
    codeByLabel: PHYSICAL_CODE_BY_TOKEN_LABEL,
  });

  expect(result.targets.every((target) => target === "keyboard-capture")).toBe(true);
  expect(result.progress).toMatch(/^1 \/ \d+$/);
  await expect.poll(() => storedPracticeRounds(page)).toBe(1);
});

// Escape is the panel's only keyboard route in and out, and closing it has to
// put the learner back on the capture surface -- otherwise the next keystroke
// goes nowhere. Focus after a native dialog closes is the platform's to decide,
// which is exactly why this cannot be asserted in jsdom.
test("opens and closes the panel with Escape and returns focus to practice", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#keyboard-capture")).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveJSProperty("open", true);

  await page.keyboard.press("Escape");
  await expect(dialog(page)).toHaveJSProperty("open", false);
  await expect(page.locator("#keyboard-capture")).toBeFocused();
});

// Two dialogs in the top layer at once: Escape belongs to the upper one alone.
// The shell owns Escape globally -- it is how the panel opens and closes -- and
// that handler cancels the default, so without the interception the confirmation
// installs, the browser never gets to close the dialog the learner is looking at.
// Removing `stopImmediatePropagation` from the confirmation was confirmed to
// leave the confirmation stuck open, which is what this catches.
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

// The whole round trip through the file system, which is the one path where a
// learner can lose everything if it is wrong. F10 finishes a round so there is
// earned progress to lose in the first place.
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