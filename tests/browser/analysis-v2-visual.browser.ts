import { expect, test, type Page } from "@playwright/test";
import { aggregateMeasurementObservationsV2 } from "../../src/measurement-v2/aggregate.js";
import {
  createFreshProgressForEnvironment,
  createProductEnvironment,
} from "../../src/product/session.js";
import { serializeProductProgress } from "../../src/product/progress.js";
import { STANDARD_BOPOMOFO_LAYOUT } from "../../src/scheme/standard-layout.js";
import {
  EVALUATION_CATALOG,
  PRACTICE_CATALOG,
  SYNTAX_PROFILES,
} from "../../src/app/generated/catalog.js";

const PROGRESS_KEY = "bopomofo-trainer.progress.v4";

async function openAnalysis(page: Page): Promise<void> {
  await page.goto("/");
  await page.locator("#open-information").click();
  await page.locator(".analysis-v2-open").click();
  await expect(page.locator("#analysis-v2")).toBeVisible();
}

function seededSpeedProgress(): string {
  const environment = createProductEnvironment({
    practice: PRACTICE_CATALOG,
    evaluation: EVALUATION_CATALOG,
    syntaxProfiles: SYNTAX_PROFILES,
  });
  const fresh = createFreshProgressForEnvironment(
    environment,
    "analysis-v2-geometry-browser-data",
    "guided",
    STANDARD_BOPOMOFO_LAYOUT.id,
  );
  let sequence = 0;
  const measurements = aggregateMeasurementObservationsV2({
    bindings: [],
    confusions: [],
    inputOrderPositions: [],
    coordination: [],
    immediateTokens: Array.from({ length: 5 }, (_, index) => ({
      traceSequence: sequence++,
      fromToken: "zhuyin:ㄅ",
      toToken: "zhuyin:ㄆ",
      boundary: "within-syllable" as const,
      timingMs: 100 + index * 4,
      clean: true,
    })),
    immediateHands: [],
    sameHandRevisits: [],
    toneCommits: [],
    ambiguousErrorCount: 0,
    duplicateComponentCount: 0,
    prematureToneCount: 0,
  });
  return serializeProductProgress({ ...fresh, measurements });
}

async function installSpeedProgress(page: Page): Promise<void> {
  const progress = seededSpeedProgress();
  await page.addInitScript(({ key, source }) => {
    window.localStorage.setItem(key, source);
  }, { key: PROGRESS_KEY, source: progress });
}

test("keeps the original analysis keyboard visual contract", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openAnalysis(page);

  const visual = await page.locator("#analysis-v2").evaluate((analysis) => {
    const keyboard = analysis.querySelector<HTMLElement>(".analysis-v2-keyboard")!;
    const regularKey = analysis.querySelector<HTMLElement>(".analysis-v2-key[style*='--key-columns:4']")!;
    const wideKey = analysis.querySelector<HTMLElement>(".analysis-v2-key[style*='--key-columns:6']")!;
    const keyMetric = analysis.querySelector<HTMLElement>(".analysis-v2-key small")!;
    const fKey = analysis.querySelectorAll<HTMLElement>(".analysis-v2-keyboard-row")[2]!
      .querySelectorAll<HTMLElement>(".analysis-v2-key")[4]!;
    const keyboardStyle = getComputedStyle(keyboard);
    const regularStyle = getComputedStyle(regularKey);
    const wideStyle = getComputedStyle(wideKey);
    const notchStyle = getComputedStyle(fKey, "::after");
    return {
      keyboardWidth: keyboard.getBoundingClientRect().width,
      transform: keyboardStyle.transform,
      transformOrigin: keyboardStyle.transformOrigin,
      keyHeight: regularKey.getBoundingClientRect().height,
      regularRadius: regularStyle.borderTopLeftRadius,
      wideRadius: wideStyle.borderTopLeftRadius,
      metricDisplay: getComputedStyle(keyMetric).display,
      notchContent: notchStyle.content,
      notchHeight: notchStyle.height,
    };
  });

  expect(visual.keyboardWidth).toBeLessThanOrEqual(760.5);
  expect(visual.transform).not.toBe("none");
  expect(visual.transformOrigin).not.toBe("");
  expect(visual.keyHeight).toBeGreaterThanOrEqual(22);
  expect(visual.keyHeight).toBeLessThanOrEqual(36);
  expect(visual.regularRadius).not.toBe("5px");
  expect(Number.parseFloat(visual.wideRadius)).toBeGreaterThan(100);
  expect(visual.metricDisplay).toBe("none");
  expect(visual.notchContent).not.toBe("none");
  expect(visual.notchHeight).toBe("2px");
});

test("uses the dialog as a full analysis workspace instead of an outer card", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openAnalysis(page);

  const visual = await page.locator(".analysis-v2-modal").evaluate((modal) => {
    const analysis = modal.querySelector<HTMLElement>("#analysis-v2")!;
    const bounds = analysis.getBoundingClientRect();
    const style = getComputedStyle(analysis);
    return {
      width: bounds.width,
      height: bounds.height,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      border: style.borderTopWidth,
      radius: style.borderTopLeftRadius,
      shadow: style.boxShadow,
    };
  });

  expect(Math.abs(visual.width - visual.viewportWidth)).toBeLessThanOrEqual(1);
  expect(Math.abs(visual.height - visual.viewportHeight)).toBeLessThanOrEqual(1);
  expect(visual.border).toBe("0px");
  expect(visual.radius).toBe("0px");
  expect(visual.shadow).toBe("none");
});

test("keeps real speed-path endpoints on their labelled keys at desktop width", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installSpeedProgress(page);
  await openAnalysis(page);
  await page.locator('[data-action="select-tab"][data-tab="coordination"]').click();

  const analysis = page.locator("#analysis-v2");
  await expect(analysis.locator(".analysis-v2-speed-path")).toHaveCount(1);

  const geometry = await analysis.evaluate((host) => {
    const keyboard = host.querySelector<HTMLElement>(".analysis-v2-speed-keyboard")!;
    const svg = host.querySelector<SVGSVGElement>(".analysis-v2-speed-svg")!;
    const path = host.querySelector<SVGPathElement>(".analysis-v2-speed-path")!;
    const keys = [...keyboard.querySelectorAll<HTMLElement>(".analysis-v2-key.mapped")];
    const keyFor = (label: string): HTMLElement => {
      const key = keys.find((candidate) => candidate.textContent?.trim() === label);
      if (key === undefined) throw new Error(`missing speed key ${label}`);
      return key;
    };
    const center = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    };
    const screenPoint = (point: DOMPoint) => {
      const matrix = path.getScreenCTM();
      if (matrix === null) throw new Error("speed path has no screen CTM");
      return point.matrixTransform(matrix);
    };
    const start = screenPoint(path.getPointAtLength(0));
    const end = screenPoint(path.getPointAtLength(path.getTotalLength()));
    const from = center(keyFor("ㄅ"));
    const to = center(keyFor("ㄆ"));
    const distance = (left: { x: number; y: number }, right: { x: number; y: number }) =>
      Math.hypot(left.x - right.x, left.y - right.y);
    const keyboardBox = keyboard.getBoundingClientRect();
    const svgBox = svg.getBoundingClientRect();
    return {
      keyboardWidth: keyboardBox.width,
      svgWidth: svgBox.width,
      fromDistance: distance(start, from),
      toDistance: distance(end, to),
    };
  });

  expect(Math.abs(geometry.keyboardWidth - geometry.svgWidth)).toBeLessThanOrEqual(2);
  expect(geometry.fromDistance).toBeLessThan(5);
  expect(geometry.toDistance).toBeLessThan(5);
});

test("stacks speed copy on phones without changing the keyboard", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAnalysis(page);
  await page.locator('[data-action="select-tab"][data-tab="coordination"]').click();

  const visual = await page.locator("#analysis-v2").evaluate((analysis) => {
    const titleLine = analysis.querySelector<HTMLElement>(".analysis-v2-speed-card .analysis-v2-card-title-line")!;
    const copy = titleLine.querySelector<HTMLElement>("div")!;
    const speedCard = analysis.querySelector<HTMLElement>(".analysis-v2-speed-card")!;
    const speedKeyboard = analysis.querySelector<HTMLElement>(".analysis-v2-speed-keyboard")!;
    const regularKey = speedKeyboard.querySelector<HTMLElement>(".analysis-v2-key[style*='--key-columns:4']")!;
    return {
      titleDirection: getComputedStyle(titleLine).flexDirection,
      copyWidthRatio: copy.getBoundingClientRect().width / speedCard.getBoundingClientRect().width,
      keyboardTransform: getComputedStyle(speedKeyboard).transform,
      keyHeight: regularKey.getBoundingClientRect().height,
    };
  });

  expect(visual.titleDirection).toBe("column");
  expect(visual.copyWidthRatio).toBeGreaterThan(0.8);
  expect(visual.keyboardTransform).not.toBe("none");
  expect(visual.keyHeight).toBeGreaterThanOrEqual(22);
  expect(visual.keyHeight).toBeLessThanOrEqual(36);
});
