import { expect, test, type Page } from "@playwright/test";
import type { TokenId } from "../../src/core/model.js";
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
  await page.waitForTimeout(340);
}

function speedPairs(count: number): readonly [TokenId, TokenId][] {
  const tokens = [...new Set(Object.values(STANDARD_BOPOMOFO_LAYOUT.bindings)
    .filter((token): token is TokenId => token !== undefined && token.startsWith("zhuyin:")))];
  const primary: [TokenId, TokenId] = ["zhuyin:ㄅ", "zhuyin:ㄆ"];
  const result: Array<[TokenId, TokenId]> = count > 0 ? [primary] : [];
  const seen = new Set(result.map(([from, to]) => `${from}>${to}`));
  for (let index = 0; result.length < count && index < tokens.length * tokens.length; index += 1) {
    const from = tokens[index % tokens.length]!;
    const to = tokens[(index * 7 + 5) % tokens.length]!;
    if (from === to) continue;
    const id = `${from}>${to}`;
    if (seen.has(id)) continue;
    seen.add(id);
    result.push([from, to]);
  }
  if (result.length < count) throw new Error(`could only build ${result.length} speed pairs`);
  return result;
}

function seededSpeedProgress(edgeCount = 1): string {
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
  const immediateTokens = speedPairs(edgeCount).flatMap(([fromToken, toToken], edgeIndex) =>
    Array.from({ length: 5 + (edgeIndex % 8) }, (_, sampleIndex) => ({
      traceSequence: sequence++,
      fromToken,
      toToken,
      boundary: "within-syllable" as const,
      timingMs: 92 + edgeIndex * 7 + sampleIndex * 3,
      clean: true,
    })));
  const measurements = aggregateMeasurementObservationsV2({
    bindings: [],
    confusions: [],
    inputOrderPositions: [],
    coordination: [],
    immediateTokens,
    immediateHands: [],
    sameHandRevisits: [],
    toneCommits: [],
    ambiguousErrorCount: 0,
    duplicateComponentCount: 0,
    prematureToneCount: 0,
  });
  return serializeProductProgress({ ...fresh, measurements });
}

async function installSpeedProgress(page: Page, edgeCount = 1): Promise<void> {
  const progress = seededSpeedProgress(edgeCount);
  await page.addInitScript(({ key, source }) => {
    window.localStorage.setItem(key, source);
  }, { key: PROGRESS_KEY, source: progress });
}

async function measureHiddenPracticeKeyboard(page: Page): Promise<{ x: number; y: number }> {
  return page.locator("#keyboard-sketch").evaluate((sketch) => {
    const element = sketch as HTMLElement;
    const wasHidden = element.hidden;
    const visibility = element.style.visibility;
    if (wasHidden) {
      element.hidden = false;
      element.style.visibility = "hidden";
    }
    const board = element.querySelector<HTMLElement>(".keyboard-sketch-board") ?? element;
    const rect = board.getBoundingClientRect();
    if (wasHidden) {
      element.hidden = true;
      element.style.visibility = visibility;
    }
    return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  });
}

test("translates the analysis keyboard from the main-page keyboard origin without scaling it", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.addInitScript(() => {
    const originalAnimate = Element.prototype.animate;
    Element.prototype.animate = function instrumentedAnimate(
      keyframes: Keyframe[] | PropertyIndexedKeyframes | null,
      options?: number | KeyframeAnimationOptions,
    ): Animation {
      if (this instanceof HTMLElement
        && (this.classList.contains("analysis-v2-keyboard")
          || this.classList.contains("analysis-v2-speed-board"))) {
        const rect = this.getBoundingClientRect();
        const frames = Array.isArray(keyframes)
          ? keyframes.map((frame) => ({
            translate: typeof frame.translate === "string" ? frame.translate : "",
            transform: typeof frame.transform === "string" ? frame.transform : "",
            opacity: typeof frame.opacity === "number" ? frame.opacity : Number(frame.opacity),
          }))
          : [];
        const timing = typeof options === "number"
          ? { duration: options, easing: "" }
          : { duration: Number(options?.duration ?? 0), easing: options?.easing ?? "" };
        (window as typeof window & {
          __analysisKeyboardRise?: {
            frames: Array<{ translate: string; transform: string; opacity: number }>;
            duration: number;
            easing: string;
            target: { x: number; y: number };
            baseTransform: string;
          };
        }).__analysisKeyboardRise = {
          frames,
          ...timing,
          target: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
          baseTransform: getComputedStyle(this).transform,
        };
      }
      return originalAnimate.call(this, keyframes, options);
    };
  });

  await page.goto("/");
  const origin = await measureHiddenPracticeKeyboard(page);
  await page.locator("#open-information").click();
  await page.locator(".analysis-v2-open").click();
  await expect(page.locator("#analysis-v2")).toBeVisible();

  const captured = await page.evaluate(() => (
    window as typeof window & {
      __analysisKeyboardRise?: {
        frames: Array<{ translate: string; transform: string; opacity: number }>;
        duration: number;
        easing: string;
        target: { x: number; y: number };
        baseTransform: string;
      };
    }
  ).__analysisKeyboardRise ?? null);
  expect(captured).not.toBeNull();
  expect(captured?.duration).toBe(320);
  expect(captured?.easing).toBe("cubic-bezier(.2, .75, .25, 1)");
  expect(captured?.frames).toHaveLength(2);
  expect(captured?.baseTransform).not.toBe("none");
  expect(captured?.frames[0]?.transform).toBe("");
  expect(captured?.frames[1]?.transform).toBe("");
  expect(captured?.frames[0]?.translate).not.toBe("");
  expect(captured?.frames[1]?.translate).toBe("0px 0px");
  expect(captured?.frames[0]?.opacity).toBe(0.25);
  expect(captured?.frames[1]?.opacity).toBe(1);

  const match = captured?.frames[0]?.translate.match(/(-?[\d.]+)px\s+(-?[\d.]+)px/);
  expect(match).not.toBeNull();
  const dx = Number(match?.[1]);
  const dy = Number(match?.[2]);
  expect(Math.abs((captured?.target.x ?? 0) + dx - origin.x)).toBeLessThan(0.5);
  expect(Math.abs((captured?.target.y ?? 0) + dy - origin.y)).toBeLessThan(0.5);

  await page.keyboard.press("Escape");
  await expect(page.locator("#analysis-v2")).toBeHidden();
  await expect.poll(() => page.evaluate(() => document.body.classList.contains("analysis-v2-open")))
    .toBe(false);
});

test("keeps the original semantic keyboard visual contract", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openAnalysis(page);
  const analysis = page.locator("#analysis-v2");
  await analysis.locator('[data-tab="semantic"]').click();

  const visual = await analysis.evaluate((host) => {
    const keyboard = host.querySelector<HTMLElement>(".analysis-v2-keyboard")!;
    const regularKey = host.querySelector<HTMLElement>(".analysis-v2-key[style*='--key-columns:4']")!;
    const wideKey = host.querySelector<HTMLElement>(".analysis-v2-key[style*='--key-columns:6']")!;
    const keyMetric = host.querySelector<HTMLElement>(".analysis-v2-key small")!;
    const fKey = host.querySelectorAll<HTMLElement>(".analysis-v2-keyboard-row")[2]!
      .querySelectorAll<HTMLElement>(".analysis-v2-key")[4]!;
    const keyboardStyle = getComputedStyle(keyboard);
    const regularStyle = getComputedStyle(regularKey);
    const wideStyle = getComputedStyle(wideKey);
    const notchStyle = getComputedStyle(fKey, "::after");
    return {
      keyboardWidth: keyboard.offsetWidth,
      transform: keyboardStyle.transform,
      transformOrigin: keyboardStyle.transformOrigin,
      keyHeight: Number.parseFloat(regularStyle.height),
      regularRadius: regularStyle.borderTopLeftRadius,
      wideRadius: wideStyle.borderTopLeftRadius,
      metricDisplay: getComputedStyle(keyMetric).display,
      notchContent: notchStyle.content,
      notchHeight: notchStyle.height,
    };
  });

  expect(visual.keyboardWidth).toBe(760);
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

test("keeps real speed-path endpoints on their labelled keys", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installSpeedProgress(page);
  await openAnalysis(page);
  const analysis = page.locator("#analysis-v2");
  await expect(analysis.locator(".analysis-v2-speed-path")).toHaveCount(1);

  const geometry = await analysis.evaluate((host) => {
    const board = host.querySelector<HTMLElement>(".analysis-v2-speed-board")!;
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
    const productionTransform = getComputedStyle(board).transform;
    board.style.transform = "none";
    const start = screenPoint(path.getPointAtLength(0));
    const end = screenPoint(path.getPointAtLength(path.getTotalLength()));
    const from = center(keyFor("ㄅ"));
    const to = center(keyFor("ㄆ"));
    const keyboardBox = keyboard.getBoundingClientRect();
    const svgBox = svg.getBoundingClientRect();
    board.style.removeProperty("transform");
    const distance = (left: { x: number; y: number }, right: { x: number; y: number }) =>
      Math.hypot(left.x - right.x, left.y - right.y);
    return {
      productionTransform,
      keyboardWidth: keyboardBox.width,
      svgWidth: svgBox.width,
      fromDistance: distance(start, from),
      toDistance: distance(end, to),
    };
  });

  expect(geometry.productionTransform).not.toBe("none");
  expect(Math.abs(geometry.keyboardWidth - geometry.svgWidth)).toBeLessThanOrEqual(2);
  expect(geometry.fromDistance).toBeLessThan(5);
  expect(geometry.toDistance).toBeLessThan(5);
});

test("keeps Strategy's matrix compact inside the shared primary stage", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openAnalysis(page);
  const analysis = page.locator("#analysis-v2");

  await analysis.locator('[data-tab="semantic"]').click();
  await analysis.locator('[data-action="semantic-view"][data-value="confusion"]').click();
  await expect(analysis.locator(".analysis-v2-keyboard")).toHaveCount(1);
  await expect(analysis.locator(".analysis-v2-confusion-table")).toHaveCount(0);

  await analysis.locator('[data-tab="strategy"]').click();
  await expect(analysis.locator(".strategy-matrix")).toHaveCount(1);
  await expect(analysis.locator('[data-action="strategy-size"]')).toHaveText(["2 個注音", "3 個注音"]);
  const widths = await analysis.evaluate((host) => ({
    stage: host.querySelector<HTMLElement>(".analysis-v2-strategy-stage")!.getBoundingClientRect().width,
    object: host.querySelector<HTMLElement>(".analysis-v2-strategy-object")!.getBoundingClientRect().width,
    field: host.querySelector<HTMLElement>(".analysis-v2-strategy-field")!.getBoundingClientRect().width,
  }));
  expect(widths.stage).toBeLessThanOrEqual(1080.5);
  expect(widths.object).toBeLessThanOrEqual(560.5);
  expect(widths.field).toBeLessThanOrEqual(560.5);
});

test("keeps the single expanded evidence table compact inside the workspace", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installSpeedProgress(page, 12);
  await openAnalysis(page);
  const analysis = page.locator("#analysis-v2");
  await analysis.locator('[data-action="evidence-family"][data-family="hands"]').click();
  await expect(analysis.locator("#analysis-v2-evidence-detail")).toBeVisible();
  const widths = await analysis.locator("#analysis-v2-evidence-detail").evaluate((detail) => {
    const body = detail.querySelector<HTMLElement>(".analysis-v2-evidence-body")!;
    const table = detail.querySelector<HTMLElement>(".analysis-v2-motor-table")!;
    return {
      body: body.getBoundingClientRect().width,
      table: table.getBoundingClientRect().width,
      workspace: document.querySelector<HTMLElement>("#analysis-v2")!.getBoundingClientRect().width,
    };
  });
  expect(widths.body).toBeLessThanOrEqual(760.5);
  expect(widths.table).toBeLessThan(widths.workspace * 0.8);
});
