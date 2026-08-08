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
  const result: Array<[TokenId, TokenId]> = [["zhuyin:ㄅ", "zhuyin:ㄆ"]];
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
  return result.slice(0, count);
}

function seededSpeedProgress(edgeCount: number): string {
  const environment = createProductEnvironment({
    practice: PRACTICE_CATALOG,
    evaluation: EVALUATION_CATALOG,
    syntaxProfiles: SYNTAX_PROFILES,
  });
  const fresh = createFreshProgressForEnvironment(
    environment,
    "analysis-v2-hierarchy-browser-data",
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

async function installSpeedProgress(page: Page, edgeCount: number): Promise<void> {
  const source = seededSpeedProgress(edgeCount);
  await page.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, value);
  }, { key: PROGRESS_KEY, value: source });
}

test("keeps the protected 760px keyboard inside a centered 1080px visual stage", async ({ page }) => {
  await page.setViewportSize({ width: 2000, height: 1100 });
  await openAnalysis(page);

  const metrics = await page.locator("#analysis-v2").evaluate((host) => {
    const domain = host.querySelector<HTMLElement>(".analysis-v2-domain")!;
    const stage = host.querySelector<HTMLElement>(".analysis-v2-semantic-stage")!;
    const keyboard = host.querySelector<HTMLElement>(".analysis-v2-keyboard")!;
    const lead = host.querySelector<HTMLElement>(".analysis-v2-hero-readout > strong")!;
    const title = host.querySelector<HTMLElement>(".analysis-v2-domain-head h3")!;
    return {
      domainWidth: domain.getBoundingClientRect().width,
      stageWidth: stage.getBoundingClientRect().width,
      keyboardWidth: keyboard.getBoundingClientRect().width,
      keyboardShare: keyboard.getBoundingClientRect().width / stage.getBoundingClientRect().width,
      leadFont: Number.parseFloat(getComputedStyle(lead).fontSize),
      titleFont: Number.parseFloat(getComputedStyle(title).fontSize),
    };
  });

  expect(metrics.domainWidth).toBeLessThanOrEqual(1080.5);
  expect(metrics.stageWidth).toBeLessThanOrEqual(1080.5);
  expect(metrics.keyboardWidth).toBeLessThanOrEqual(760.5);
  expect(metrics.keyboardShare).toBeGreaterThan(0.68);
  expect(metrics.keyboardShare).toBeLessThan(0.73);
  expect(metrics.leadFont).toBeGreaterThan(metrics.titleFont * 1.7);
});

test("uses ink for the dense flyline field and reserves accent for three slow/focused paths", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installSpeedProgress(page, 24);
  await openAnalysis(page);
  await page.locator('[data-action="select-tab"][data-tab="coordination"]').click();

  const analysis = page.locator("#analysis-v2");
  await expect(analysis.locator(".analysis-v2-speed-path")).toHaveCount(24);
  await expect(analysis.locator(".analysis-v2-speed-path.is-slow")).toHaveCount(3);
  await expect(analysis.locator(".analysis-v2-speed-readout")).toContainText("ms");
  await expect(analysis.locator(".analysis-v2-speed-inspector")).toHaveCount(0);
  await expect(analysis.locator(".analysis-v2-speed-stage")).not.toHaveClass(/has-selection/);
  await expect(analysis.locator(".analysis-v2-speed-legend")).toContainText("紅色只標較慢或選取");
  await expect(analysis.locator(".analysis-v2-speed-legend i")).toHaveCount(0);

  const palette = await analysis.evaluate((host) => {
    const background = host.querySelector<SVGPathElement>(
      ".analysis-v2-speed-path:not(.salient):not(.is-slow)",
    )!;
    const salient = host.querySelector<SVGPathElement>(
      ".analysis-v2-speed-path.salient:not(.is-slow)",
    )!;
    const slow = host.querySelector<SVGPathElement>(".analysis-v2-speed-path.is-slow")!;
    return {
      backgroundStroke: getComputedStyle(background).stroke,
      salientStroke: getComputedStyle(salient).stroke,
      slowStroke: getComputedStyle(slow).stroke,
      backgroundOpacity: Number(getComputedStyle(background).strokeOpacity),
      slowOpacity: Number(getComputedStyle(slow).strokeOpacity),
    };
  });
  expect(palette.backgroundStroke).not.toBe(palette.slowStroke);
  expect(palette.salientStroke).not.toBe(palette.slowStroke);
  expect(palette.backgroundOpacity).toBeGreaterThan(0.8);
  expect(palette.slowOpacity).toBeGreaterThan(0.7);

  const chosen = analysis.locator(".analysis-v2-speed-path").first();
  const hitPoint = await chosen.evaluate((path) => {
    const rect = path.getBoundingClientRect();
    for (let y = rect.top; y <= rect.bottom; y += 0.5) {
      for (let x = rect.left; x <= rect.right; x += 0.5) {
        if (document.elementFromPoint(x, y) === path) return { x, y };
      }
    }
    throw new Error("rendered flyline exposes no real pointer-hit point");
  });
  await page.mouse.click(hitPoint.x, hitPoint.y);
  await expect(analysis.locator(".analysis-v2-speed-stage")).toHaveClass(/has-selection/);
  await expect(analysis.locator(".analysis-v2-speed-inspector")).toHaveCount(1);
  await expect(analysis.locator(".analysis-v2-speed-inspector")).toContainText("ms");
  await expect(chosen).toBeFocused();

  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  const dark = await analysis.evaluate((host) => {
    const background = host.querySelector<SVGPathElement>(
      ".analysis-v2-speed-path:not(.salient):not(.is-slow)",
    )!;
    const slow = host.querySelector<SVGPathElement>(".analysis-v2-speed-path.is-slow")!;
    return {
      backgroundStroke: getComputedStyle(background).stroke,
      slowStroke: getComputedStyle(slow).stroke,
    };
  });
  expect(dark.backgroundStroke).not.toBe(dark.slowStroke);
});
