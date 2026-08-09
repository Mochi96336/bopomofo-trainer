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
    "analysis-v2-self-audit-browser-data",
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

test("keeps the medium keyboard width stable when a semantic inspector opens", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openAnalysis(page);

  const analysis = page.locator("#analysis-v2");
  await analysis.locator('[data-tab="semantic"]').click();
  const keyboard = analysis.locator(".analysis-v2-keyboard");
  const before = await keyboard.evaluate((node) => (node as HTMLElement).offsetWidth);
  await analysis.locator('[data-action="select-key"]').first().click();
  const after = await keyboard.evaluate((node) => (node as HTMLElement).offsetWidth);

  expect(before).toBe(760);
  expect(after).toBe(before);
  await expect(analysis.locator(".analysis-v2-semantic-stage")).toHaveClass(/has-selection/);
});

test("keeps flyline width stable on selection and exposes a wider pointer target", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installSpeedProgress(page, 24);
  await openAnalysis(page);
  const analysis = page.locator("#analysis-v2");

  const board = analysis.locator(".analysis-v2-speed-board");
  const before = await board.evaluate((node) => (node as HTMLElement).offsetWidth);
  const hit = analysis.locator(".analysis-v2-speed-hit").first();
  const hitStyle = await hit.evaluate((node) => ({
    strokeWidth: getComputedStyle(node).strokeWidth,
    pointerEvents: getComputedStyle(node).pointerEvents,
  }));
  expect(Number.parseFloat(hitStyle.strokeWidth)).toBeGreaterThanOrEqual(10);
  expect(hitStyle.pointerEvents).toBe("stroke");

  await analysis.locator(".analysis-v2-speed-path").first().evaluate((node) => {
    node.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  const after = await board.evaluate((node) => (node as HTMLElement).offsetWidth);
  expect(before).toBe(760);
  expect(after).toBe(before);
  await expect(analysis.locator(".analysis-v2-speed-stage")).toHaveClass(/has-selection/);
  await expect(analysis.locator(".analysis-v2-speed-inspector")).toHaveCount(0);
});

test("keeps dense speed ranking in the path view and restores compact Movement diagrams", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const requestedEdges = 40;
  const seededEdges = speedPairs(requestedEdges).length;
  expect(seededEdges).toBeGreaterThan(36);
  await installSpeedProgress(page, requestedEdges);
  await openAnalysis(page);
  const analysis = page.locator("#analysis-v2");

  await expect(analysis.locator(".analysis-v2-speed-path")).toHaveCount(36);
  await expect(analysis.locator(".analysis-v2-speed-caption"))
    .toContainText(`36 / ${seededEdges} 條可比較`);
  await expect(analysis.locator(".analysis-v2-speed-readout"))
    .toContainText("僅在畫面中的同類實際鍵間轉換中比較");
  await expect(analysis.locator(".analysis-v2-movement-view")).toHaveCount(0);

  await analysis.locator('[data-action="coordination-view"][data-value="movement"]').click();
  await expect(analysis.locator(".analysis-v2-speed-path")).toHaveCount(0);
  const families = analysis.locator(".analysis-v2-movement-family");
  await expect(families).toHaveCount(4);
  await expect(analysis.locator(".analysis-v2-movement-view table")).toHaveCount(0);
  const diagrams = await families.evaluateAll((nodes) => nodes.map((node) =>
    getComputedStyle(node, "::before").content.replaceAll('"', "")));
  expect(diagrams).toEqual([
    "左   ⇄   右",
    "左   →   右   →   左",
    "①   ─   ②   ─   ③",
    "注音   →   ˊ",
  ]);
});
