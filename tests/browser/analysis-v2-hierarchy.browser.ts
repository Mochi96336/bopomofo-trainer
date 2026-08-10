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

test("keeps a medium keyboard while using desktop space to separate the reading", async ({ page }) => {
  await page.setViewportSize({ width: 2000, height: 1100 });
  await openAnalysis(page);
  const analysis = page.locator("#analysis-v2");
  await analysis.locator('[data-tab="semantic"]').click();

  const metrics = await analysis.evaluate((host) => {
    const domain = host.querySelector<HTMLElement>(".analysis-v2-domain")!;
    const stage = host.querySelector<HTMLElement>(".analysis-v2-primary-stage")!;
    const keyboard = host.querySelector<HTMLElement>(".analysis-v2-keyboard")!;
    const lead = host.querySelector<HTMLElement>(".analysis-v2-hero-readout")!;
    const leadStrong = lead.querySelector<HTMLElement>("strong")!;
    const keyboardRect = keyboard.getBoundingClientRect();
    const leadRect = lead.getBoundingClientRect();
    return {
      domainWidth: domain.getBoundingClientRect().width,
      stageWidth: stage.getBoundingClientRect().width,
      stageHeight: stage.getBoundingClientRect().height,
      keyboardWidth: keyboardRect.width,
      keyboardShare: keyboardRect.width / stage.getBoundingClientRect().width,
      leadFont: Number.parseFloat(getComputedStyle(leadStrong).fontSize),
      leadGap: leadRect.top - keyboardRect.bottom,
    };
  });

  expect(metrics.domainWidth).toBeLessThanOrEqual(1180.5);
  expect(metrics.stageWidth).toBeLessThanOrEqual(1180.5);
  expect(metrics.stageHeight).toBeLessThanOrEqual(540.5);
  expect(metrics.keyboardWidth).toBeGreaterThanOrEqual(759);
  expect(metrics.keyboardWidth).toBeLessThanOrEqual(760.5);
  expect(metrics.keyboardShare).toBeGreaterThan(0.63);
  expect(metrics.keyboardShare).toBeLessThan(0.66);
  expect(metrics.leadFont).toBeGreaterThanOrEqual(24);
  expect(metrics.leadFont).toBeLessThanOrEqual(29.5);
  expect(metrics.leadGap).toBeGreaterThanOrEqual(45);
  expect(metrics.leadGap).toBeLessThanOrEqual(280);
});

test("keeps Semantic and Coordination keyboards at one fixed screen position and scale", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installSpeedProgress(page, 24);
  await openAnalysis(page);
  const analysis = page.locator("#analysis-v2");

  const coordinationBoard = analysis.locator(".analysis-v2-speed-board");
  const coordinationBefore = await coordinationBoard.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { top: rect.top, left: rect.left, right: rect.right, width: (node as HTMLElement).offsetWidth };
  });
  const canvasBefore = await analysis.locator(".analysis-v2-main").evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { left: rect.left, right: rect.right };
  });
  const boardCenter = (coordinationBefore.left + coordinationBefore.right) / 2;
  const canvasCenter = (canvasBefore.left + canvasBefore.right) / 2;
  expect(Math.abs(boardCenter - canvasCenter)).toBeLessThan(1);

  await analysis.locator(".analysis-v2-speed-path").first().evaluate((node) => {
    node.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  const coordinationAfter = await coordinationBoard.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { top: rect.top, width: (node as HTMLElement).offsetWidth };
  });
  expect(Math.abs(coordinationAfter.top - coordinationBefore.top)).toBeLessThan(0.5);
  expect(coordinationAfter.width).toBe(coordinationBefore.width);
  expect(coordinationBefore.width).toBe(760);

  await analysis.locator('[data-tab="semantic"]').click();
  const semanticBoard = analysis.locator(".analysis-v2-keyboard");
  const semanticBefore = await semanticBoard.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { top: rect.top, left: rect.left, right: rect.right, width: (node as HTMLElement).offsetWidth };
  });
  expect(Math.abs(semanticBefore.top - coordinationBefore.top)).toBeLessThan(0.5);
  expect(semanticBefore.width).toBe(coordinationBefore.width);
  expect(Math.abs(((semanticBefore.left + semanticBefore.right) / 2) - canvasCenter)).toBeLessThan(1);

  await analysis.locator('[data-action="select-key"]').first().click();
  const semanticAfter = await semanticBoard.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { top: rect.top, width: (node as HTMLElement).offsetWidth };
  });
  expect(Math.abs(semanticAfter.top - semanticBefore.top)).toBeLessThan(0.5);
  expect(semanticAfter.width).toBe(semanticBefore.width);
});

test("uses continuous red flyline intensity and never turns Analysis text red on hover", async ({ page }) => {
  await page.setViewportSize({ width: 1064, height: 665 });
  await installSpeedProgress(page, 24);
  await openAnalysis(page);

  const analysis = page.locator("#analysis-v2");
  await expect(analysis.locator('[data-tab="coordination"]')).toHaveAttribute("aria-selected", "true");
  await expect(analysis.locator(".analysis-v2-speed-path")).toHaveCount(24);
  await expect(analysis.locator(".analysis-v2-speed-path.is-accent")).toHaveCount(1);
  await expect(analysis.locator(".analysis-v2-speed-readout")).toContainText("ms");
  await expect(analysis.locator(".analysis-v2-speed-readout")).toContainText("24 條可比較");
  await expect(analysis.locator(".analysis-v2-speed-caption")).toHaveCount(0);

  const palette = await analysis.evaluate((host) => {
    const stage = host.querySelector<HTMLElement>(".analysis-v2-primary-stage")!;
    const board = host.querySelector<HTMLElement>(".analysis-v2-speed-board")!;
    const readout = host.querySelector<HTMLElement>(".analysis-v2-speed-readout")!;
    const paths = [...host.querySelectorAll<SVGPathElement>(".analysis-v2-speed-path")];
    const fastest = paths[0]!;
    const slowest = paths.at(-1)!;
    const probe = document.createElement("span");
    host.append(probe);
    probe.style.color = "var(--accent)";
    const accent = getComputedStyle(probe).color;
    probe.style.color = "var(--danger)";
    const danger = getComputedStyle(probe).color;
    probe.remove();
    const boardRect = board.getBoundingClientRect();
    const readoutRect = readout.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    return {
      accent,
      danger,
      fastestStroke: getComputedStyle(fastest).stroke,
      slowestStroke: getComputedStyle(slowest).stroke,
      fastestOpacity: Number.parseFloat(fastest.style.getPropertyValue("--relation-opacity")),
      slowestOpacity: Number.parseFloat(slowest.style.getPropertyValue("--relation-opacity")),
      stageHeight: stageRect.height,
      boardTopInsideStage: boardRect.top - stageRect.top,
      readoutGap: readoutRect.top - boardRect.bottom,
    };
  });
  expect(palette.fastestStroke).not.toBe(palette.slowestStroke);
  expect(palette.fastestStroke).not.toBe(palette.accent);
  expect(palette.slowestStroke).not.toBe(palette.accent);
  expect(Number.isFinite(palette.fastestOpacity)).toBe(true);
  expect(Number.isFinite(palette.slowestOpacity)).toBe(true);
  expect(palette.slowestOpacity).toBeGreaterThan(palette.fastestOpacity);
  expect(palette.stageHeight).toBeLessThanOrEqual(470.5);
  expect(palette.boardTopInsideStage).toBeGreaterThan(8);
  expect(palette.readoutGap).toBeGreaterThanOrEqual(45);
  expect(palette.readoutGap).toBeLessThanOrEqual(190);

  await analysis.evaluate((host) => {
    const visual = host.querySelector<SVGPathElement>(".analysis-v2-speed-path:not(.is-accent)")!;
    const id = visual.dataset.speedId;
    const hit = [...host.querySelectorAll<SVGPathElement>(".analysis-v2-speed-hit")]
      .find((candidate) => candidate.dataset.speedId === id)!;
    hit.dispatchEvent(new PointerEvent("pointerover", { bubbles: true }));
  });
  await expect(analysis.locator(".analysis-v2-speed-path.is-accent")).toHaveCount(1);

  await analysis.locator('[data-action="coordination-view"]').first().hover();
  await analysis.locator('[data-tab="semantic"]').hover();
  const redText = await analysis.evaluate((host) => {
    const probe = document.createElement("span");
    host.append(probe);
    probe.style.color = "var(--accent)";
    const accent = getComputedStyle(probe).color;
    probe.style.color = "var(--danger)";
    const danger = getComputedStyle(probe).color;
    probe.remove();
    return [...host.querySelectorAll<HTMLElement>("*")]
      .filter((node) => node.children.length === 0 && (node.textContent?.trim().length ?? 0) > 0)
      .filter((node) => {
        const style = getComputedStyle(node);
        return style.display !== "none" && style.visibility !== "hidden"
          && (style.color === accent || style.color === danger);
      })
      .map((node) => node.textContent?.trim() ?? "");
  });
  expect(redText).toEqual([]);

  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  await expect(analysis.locator(".analysis-v2-speed-path.is-accent")).toHaveCount(1);
  const darkPalette = await analysis.evaluate((host) => {
    const path = host.querySelector<SVGPathElement>(".analysis-v2-speed-path:not(.is-accent)")!;
    const probe = document.createElementNS("http://www.w3.org/2000/svg", "path");
    host.append(probe);
    probe.style.stroke = "var(--accent)";
    const accent = getComputedStyle(probe).stroke;
    const actual = getComputedStyle(path).stroke;
    probe.remove();
    return { actual, accent };
  });
  expect(darkPalette.actual).not.toBe(darkPalette.accent);
});