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
  const result: Array<[TokenId, TokenId]> = [];
  const seen = new Set<string>();
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

async function openCoordination(page: Page): Promise<void> {
  await openAnalysis(page);
  await page.locator('[data-action="select-tab"][data-tab="coordination"]').click();
}

test("restores the original Analysis entrance choreography", async ({ page }) => {
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
        const frames = Array.isArray(keyframes)
          ? keyframes.map((frame) => ({
            transform: typeof frame.transform === "string" ? frame.transform : "",
            opacity: typeof frame.opacity === "number" ? frame.opacity : Number(frame.opacity),
          }))
          : [];
        const timing = typeof options === "number"
          ? { duration: options, easing: "" }
          : { duration: Number(options?.duration ?? 0), easing: options?.easing ?? "" };
        (window as typeof window & {
          __analysisKeyboardRise?: {
            frames: Array<{ transform: string; opacity: number }>;
            duration: number;
            easing: string;
          };
        }).__analysisKeyboardRise = { frames, ...timing };
      }
      return originalAnimate.call(this, keyframes, options);
    };
  });

  await page.goto("/");
  await page.locator("#open-information").click();
  await page.locator(".analysis-v2-open").click();
  await expect(page.locator("#analysis-v2")).toBeVisible();

  const captured = await page.evaluate(() => (
    window as typeof window & {
      __analysisKeyboardRise?: {
        frames: Array<{ transform: string; opacity: number }>;
        duration: number;
        easing: string;
      };
    }
  ).__analysisKeyboardRise ?? null);
  expect(captured).not.toBeNull();
  expect(captured?.duration).toBe(320);
  expect(captured?.easing).toBe("cubic-bezier(.2, .75, .25, 1)");
  expect(captured?.frames).toHaveLength(2);
  expect(captured?.frames[0]?.transform).toContain("translate(");
  expect(captured?.frames[0]?.transform).toContain("scale(");
  expect(captured?.frames[0]?.transform).toContain("perspective(520px) rotateX(19deg)");
  expect(captured?.frames[0]?.opacity).toBe(0.25);
  expect(captured?.frames[1]?.transform).toBe("perspective(520px) rotateX(19deg)");
  expect(captured?.frames[1]?.opacity).toBe(1);

  await page.waitForTimeout(200);
  const stage = await page.evaluate(() => {
    const practice = document.querySelector<HTMLElement>("#practice-stage")!;
    const topbar = document.querySelector<HTMLElement>(".topbar")!;
    const analysis = document.querySelector<HTMLElement>("#analysis-v2")!;
    const practiceStyle = getComputedStyle(practice);
    const topbarStyle = getComputedStyle(topbar);
    const analysisStyle = getComputedStyle(analysis);
    return {
      bodyOpen: document.body.classList.contains("analysis-v2-open"),
      practiceOpacity: Number(practiceStyle.opacity),
      practiceTransform: practiceStyle.transform,
      topbarOpacity: Number(topbarStyle.opacity),
      topbarTransform: topbarStyle.transform,
      analysisOpacity: Number(analysisStyle.opacity),
      analysisTransitionProperty: analysisStyle.transitionProperty,
      analysisTransitionDuration: analysisStyle.transitionDuration,
    };
  });
  expect(stage.bodyOpen).toBe(true);
  expect(stage.practiceOpacity).toBeCloseTo(0.26, 1);
  expect(stage.practiceTransform).not.toBe("none");
  expect(stage.topbarOpacity).toBeCloseTo(0.38, 1);
  expect(stage.topbarTransform).not.toBe("none");
  expect(stage.analysisOpacity).toBe(1);
  expect(stage.analysisTransitionProperty).toContain("opacity");
  expect(stage.analysisTransitionDuration).toContain("0.15s");

  await page.keyboard.press("Escape");
  await expect(page.locator("#analysis-v2")).toBeHidden();
  await expect.poll(() => page.evaluate(() => document.body.classList.contains("analysis-v2-open")))
    .toBe(false);
});

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
      keyHeight: Number.parseFloat(regularStyle.height),
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
  await openCoordination(page);

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

test("makes flylines the coordination hero instead of another report card", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installSpeedProgress(page, 24);
  await openCoordination(page);

  const analysis = page.locator("#analysis-v2");
  await expect(analysis.locator(".analysis-v2-speed-path")).toHaveCount(24);
  await expect(analysis.locator(".analysis-v2-evidence-group")).toHaveCount(4);
  await expect(analysis.locator(".analysis-v2-evidence-group[open]")).toHaveCount(0);
  await expect(analysis.locator(".analysis-v2-card")).toHaveCount(0);

  const visual = await analysis.evaluate((host) => {
    const main = host.querySelector<HTMLElement>(".analysis-v2-main")!;
    const stage = host.querySelector<HTMLElement>(".analysis-v2-speed-stage")!;
    const field = host.querySelector<HTMLElement>(".analysis-v2-speed-field")!;
    const rail = host.querySelector<HTMLElement>(".analysis-v2-evidence-rail")!;
    return {
      stageShare: stage.getBoundingClientRect().height / main.getBoundingClientRect().height,
      fieldBeforeRail: Boolean(field.compareDocumentPosition(rail) & Node.DOCUMENT_POSITION_FOLLOWING),
      salientCount: host.querySelectorAll(".analysis-v2-speed-path.salient").length,
    };
  });

  expect(visual.stageShare).toBeGreaterThan(0.5);
  expect(visual.fieldBeforeRail).toBe(true);
  expect(visual.salientCount).toBeGreaterThanOrEqual(12);
  expect(visual.salientCount).toBeLessThanOrEqual(16);
});

test("focuses a flyline as one relation field and lets selection pin it", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installSpeedProgress(page, 12);
  await openCoordination(page);

  const paths = page.locator(".analysis-v2-speed-path");
  const first = paths.first();
  await first.dispatchEvent("pointerover");
  await expect(page.locator(".analysis-v2-speed-path.is-focused")).toHaveCount(1);
  expect(await page.locator(".analysis-v2-speed-path.is-muted").count()).toBeGreaterThan(0);
  await expect(page.locator(".analysis-v2-speed-keyboard .analysis-v2-key.is-related")).toHaveCount(2);

  await first.dispatchEvent("click");
  await expect(page.locator(".analysis-v2-speed-path.selected")).toHaveCount(1);
  await expect(page.locator(".analysis-v2-speed-detail")).toHaveCount(1);
  await expect(page.locator(".analysis-v2-speed-detail dl")).toContainText("乾淨樣本");
});

test("keeps a dense flyline field visible in dark mode", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ colorScheme: "dark" });
  await installSpeedProgress(page, 24);
  await openCoordination(page);

  const styles = await page.locator(".analysis-v2-speed-path").evaluateAll((paths) => paths.map((path) => {
    const style = getComputedStyle(path);
    return { stroke: style.stroke, opacity: Number(style.strokeOpacity) };
  }));
  expect(styles).toHaveLength(24);
  expect(Math.min(...styles.map((style) => style.opacity))).toBeGreaterThan(0.2);
  expect(Math.max(...styles.map((style) => style.opacity))).toBeGreaterThan(0.6);
  expect(styles.every((style) => style.stroke !== "rgb(0, 0, 0)" && style.stroke !== "#000000"))
    .toBe(true);
});

test("keeps mobile horizontal overflow inside the flyline stage", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await installSpeedProgress(page, 18);
  await openCoordination(page);

  const visual = await page.locator("#analysis-v2").evaluate((analysis) => {
    const main = analysis.querySelector<HTMLElement>(".analysis-v2-main")!;
    const scroll = analysis.querySelector<HTMLElement>(".analysis-v2-speed-scroll")!;
    const board = analysis.querySelector<HTMLElement>(".analysis-v2-speed-board")!;
    const inspector = analysis.querySelector<HTMLElement>(".analysis-v2-speed-inspector")!;
    const regularKey = analysis.querySelector<HTMLElement>(".analysis-v2-speed-keyboard .analysis-v2-key[style*='--key-columns:4']")!;
    return {
      mainOverflow: main.scrollWidth - main.clientWidth,
      speedOverflow: scroll.scrollWidth - scroll.clientWidth,
      boardWidth: board.getBoundingClientRect().width,
      inspectorWidth: inspector.getBoundingClientRect().width,
      mainWidth: main.getBoundingClientRect().width,
      keyHeight: Number.parseFloat(getComputedStyle(regularKey).height),
    };
  });

  expect(visual.mainOverflow).toBeLessThanOrEqual(1);
  expect(visual.speedOverflow).toBeGreaterThan(100);
  expect(visual.boardWidth).toBeGreaterThan(540);
  expect(visual.inspectorWidth).toBeLessThanOrEqual(visual.mainWidth + 1);
  expect(visual.keyHeight).toBeGreaterThanOrEqual(22);
  expect(visual.keyHeight).toBeLessThanOrEqual(36);
});

test("keeps semantic confusion and strategy centered on one visual object", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openAnalysis(page);

  await page.locator('[data-action="semantic-view"][data-value="confusion"]').click();
  await expect(page.locator("#analysis-v2-panel-semantic .analysis-v2-keyboard")).toHaveCount(1);
  await expect(page.locator(".analysis-v2-confusion-table")).toHaveCount(0);

  await page.locator('[data-action="select-tab"][data-tab="strategy"]').click();
  await expect(page.locator(".analysis-v2-strategy-field")).toHaveCount(1);
  await expect(page.locator(".strategy-card")).toHaveCount(0);
  await expect(page.locator('[data-action="strategy-size"]')).toHaveCount(3);
  await page.locator('[data-action="strategy-size"][data-value="2"]').click();
  await expect(page.locator(".strategy-matrix tbody tr")).toHaveCount(2);
});
