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

test("keeps the protected 760px keyboard primary while annotations stay below it", async ({ page }) => {
  await page.setViewportSize({ width: 2000, height: 1100 });
  await openAnalysis(page);
  const analysis = page.locator("#analysis-v2");
  await analysis.locator('[data-tab="semantic"]').click();

  const metrics = await analysis.evaluate((host) => {
    const domain = host.querySelector<HTMLElement>(".analysis-v2-domain")!;
    const stage = host.querySelector<HTMLElement>(".analysis-v2-semantic-stage")!;
    const keyboard = host.querySelector<HTMLElement>(".analysis-v2-keyboard")!;
    const lead = host.querySelector<HTMLElement>(".analysis-v2-hero-readout")!;
    const leadStrong = lead.querySelector<HTMLElement>("strong")!;
    const keyboardRect = keyboard.getBoundingClientRect();
    const leadRect = lead.getBoundingClientRect();
    return {
      domainWidth: domain.getBoundingClientRect().width,
      stageWidth: stage.getBoundingClientRect().width,
      keyboardWidth: keyboardRect.width,
      keyboardShare: keyboardRect.width / stage.getBoundingClientRect().width,
      leadFont: Number.parseFloat(getComputedStyle(leadStrong).fontSize),
      leadBelowKeyboard: leadRect.top >= keyboardRect.bottom,
    };
  });

  expect(metrics.domainWidth).toBeLessThanOrEqual(1080.5);
  expect(metrics.stageWidth).toBeLessThanOrEqual(1080.5);
  expect(metrics.keyboardWidth).toBeLessThanOrEqual(760.5);
  expect(metrics.keyboardShare).toBeGreaterThan(0.68);
  expect(metrics.keyboardShare).toBeLessThan(0.73);
  expect(metrics.leadFont).toBeLessThanOrEqual(20);
  expect(metrics.leadBelowKeyboard).toBe(true);
});

test("keeps Semantic and Coordination keyboards at one fixed screen position", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installSpeedProgress(page, 24);
  await openAnalysis(page);
  const analysis = page.locator("#analysis-v2");

  const coordinationBoard = analysis.locator(".analysis-v2-speed-board");
  const coordinationBefore = await coordinationBoard.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { top: rect.top, width: (node as HTMLElement).offsetWidth };
  });
  await analysis.locator(".analysis-v2-speed-path").first().evaluate((node) => {
    node.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  const coordinationAfter = await coordinationBoard.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { top: rect.top, width: (node as HTMLElement).offsetWidth };
  });
  expect(Math.abs(coordinationAfter.top - coordinationBefore.top)).toBeLessThan(0.5);
  expect(coordinationAfter.width).toBe(coordinationBefore.width);

  await analysis.locator('[data-tab="semantic"]').click();
  const semanticBoard = analysis.locator(".analysis-v2-keyboard");
  const semanticBefore = await semanticBoard.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { top: rect.top, width: (node as HTMLElement).offsetWidth };
  });
  expect(Math.abs(semanticBefore.top - coordinationBefore.top)).toBeLessThan(0.5);
  expect(semanticBefore.width).toBe(coordinationBefore.width);

  await analysis.locator('[data-action="select-key"]').first().click();
  const semanticAfter = await semanticBoard.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { top: rect.top, width: (node as HTMLElement).offsetWidth };
  });
  expect(Math.abs(semanticAfter.top - semanticBefore.top)).toBeLessThan(0.5);
  expect(semanticAfter.width).toBe(semanticBefore.width);
});

test("uses neutral ink for the dense flyline field instead of error-red semantics", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installSpeedProgress(page, 24);
  await openAnalysis(page);

  const analysis = page.locator("#analysis-v2");
  await expect(analysis.locator('[data-tab="coordination"]')).toHaveAttribute("aria-selected", "true");
  await expect(analysis.locator(".analysis-v2-speed-path")).toHaveCount(24);
  await expect(analysis.locator(".analysis-v2-speed-path.is-slow")).toHaveCount(3);
  await expect(analysis.locator(".analysis-v2-speed-readout")).toContainText("ms");
  await expect(analysis.locator(".analysis-v2-speed-inspector")).toHaveCount(0);
  await expect(analysis.locator(".analysis-v2-speed-stage")).not.toHaveClass(/has-selection/);
  await expect(analysis.locator(".analysis-v2-speed-legend")).toContainText("深色標記較慢或目前選取");
  await expect(analysis.locator(".analysis-v2-speed-legend i")).toHaveCount(0);

  const readPalette = () => analysis.evaluate((host) => {
    const background = host.querySelector<SVGPathElement>(
      ".analysis-v2-speed-path:not(.salient):not(.is-slow)",
    )!;
    const salient = host.querySelector<SVGPathElement>(
      ".analysis-v2-speed-path.salient:not(.is-slow)",
    )!;
    const slow = host.querySelector<SVGPathElement>(".analysis-v2-speed-path.is-slow")!;
    const probe = document.createElementNS("http://www.w3.org/2000/svg", "path");
    host.append(probe);
    probe.style.stroke = "var(--ink)";
    const ink = getComputedStyle(probe).stroke;
    probe.style.stroke = "var(--accent)";
    const accent = getComputedStyle(probe).stroke;
    probe.remove();
    return {
      backgroundOpacity: Number(getComputedStyle(background).strokeOpacity),
      salientOpacity: Number(getComputedStyle(salient).strokeOpacity),
      slowStroke: getComputedStyle(slow).stroke,
      slowOpacity: Number(getComputedStyle(slow).strokeOpacity),
      ink,
      accent,
    };
  });

  const palette = await readPalette();
  expect(palette.backgroundOpacity).toBeLessThan(palette.salientOpacity);
  expect(palette.salientOpacity).toBeLessThan(palette.slowOpacity);
  expect(palette.slowOpacity).toBe(1);
  expect(palette.slowStroke).toBe(palette.ink);
  expect(palette.slowStroke).not.toBe(palette.accent);

  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  const dark = await readPalette();
  expect(dark.backgroundOpacity).toBeLessThan(dark.slowOpacity);
  expect(dark.slowOpacity).toBe(1);
  expect(dark.slowStroke).toBe(dark.ink);
  expect(dark.slowStroke).not.toBe(dark.accent);

  const chosen = analysis.locator(".analysis-v2-speed-path").first();
  await chosen.evaluate((node) => node.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  await expect(analysis.locator(".analysis-v2-speed-stage")).toHaveClass(/has-selection/);
  await expect(analysis.locator(".analysis-v2-speed-inspector")).toHaveCount(1);
  await expect(analysis.locator(".analysis-v2-speed-inspector")).toContainText("ms");
});
