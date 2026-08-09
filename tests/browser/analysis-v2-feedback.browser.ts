import { expect, test, type Locator, type Page } from "@playwright/test";
import type { TokenId } from "../../src/core/model.js";
import { aggregateMeasurementObservationsV2 } from "../../src/measurement-v2/aggregate.js";
import { serializeProductProgress } from "../../src/product/progress.js";
import {
  createFreshProgressForEnvironment,
  createProductEnvironment,
} from "../../src/product/session.js";
import { STANDARD_BOPOMOFO_LAYOUT } from "../../src/scheme/standard-layout.js";
import {
  EVALUATION_CATALOG,
  PRACTICE_CATALOG,
  SYNTAX_PROFILES,
} from "../../src/app/generated/catalog.js";

const PROGRESS_KEY = "bopomofo-trainer.progress.v4";

async function openAnalysis(page: Page): Promise<Locator> {
  await page.goto("/");
  await page.locator("#open-information").click();
  await page.locator(".analysis-v2-open").click();
  const analysis = page.locator("#analysis-v2");
  await expect(analysis).toBeVisible();
  await page.waitForTimeout(340);
  return analysis;
}

function physicalCodeFor(tokenId: TokenId): string {
  return Object.entries(STANDARD_BOPOMOFO_LAYOUT.bindings)
    .find(([, candidate]) => candidate === tokenId)?.[0] ?? "Space";
}

function seededSemanticLeadProgress(): string {
  const environment = createProductEnvironment({
    practice: PRACTICE_CATALOG,
    evaluation: EVALUATION_CATALOG,
    syntaxProfiles: SYNTAX_PROFILES,
  });
  const fresh = createFreshProgressForEnvironment(
    environment,
    "analysis-v2-feedback-semantic-data",
    "guided",
    STANDARD_BOPOMOFO_LAYOUT.id,
  );
  let sequence = 0;
  const tokens = ["zhuyin:ㄅ", "zhuyin:ㄆ", "zhuyin:ㄇ", "zhuyin:ㄈ"] as const;
  const bindings = tokens.flatMap((tokenId, tokenIndex) => {
    const errorCount = 4 - tokenIndex;
    return Array.from({ length: 8 }, (_, sampleIndex) => {
      const correct = sampleIndex >= errorCount;
      return {
        traceSequence: sequence++,
        scope: {
          mode: "guided" as const,
          layoutId: STANDARD_BOPOMOFO_LAYOUT.id,
          tokenId,
        },
        physicalCode: physicalCodeFor(tokenId),
        correct,
        timingMs: correct ? 120 + tokenIndex * 10 + sampleIndex : null,
      };
    });
  });
  const measurements = aggregateMeasurementObservationsV2({
    bindings,
    confusions: [],
    inputOrderPositions: [],
    coordination: [],
    immediateTokens: [],
    immediateHands: [],
    sameHandRevisits: [],
    toneCommits: [],
    ambiguousErrorCount: 0,
    duplicateComponentCount: 0,
    prematureToneCount: 0,
  });
  return serializeProductProgress({ ...fresh, measurements });
}

async function installSemanticLeadProgress(page: Page): Promise<void> {
  const source = seededSemanticLeadProgress();
  await page.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, value);
  }, { key: PROGRESS_KEY, value: source });
}

test("keeps the Analysis title away from the viewport edge and header hairline", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const analysis = await openAnalysis(page);
  const geometry = await analysis.evaluate((host) => {
    const header = host.querySelector<HTMLElement>(".analysis-v2-header")!;
    const title = header.querySelector<HTMLElement>("h2")!;
    const headerRect = header.getBoundingClientRect();
    const titleRect = title.getBoundingClientRect();
    return {
      leftInset: titleRect.left - headerRect.left,
      lineGap: headerRect.bottom - titleRect.bottom,
    };
  });
  expect(geometry.leftInset).toBeGreaterThanOrEqual(24);
  expect(geometry.lineGap).toBeGreaterThanOrEqual(8);
});

test("does not expose a desktop horizontal scroller while the keyboard enters", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const analysis = await openAnalysis(page);
  const overflow = await analysis.locator(".analysis-v2-speed-scroll")
    .evaluate((element) => getComputedStyle(element).overflowX);
  expect(overflow).toBe("clip");
});

test("keeps the wide flyline hit target fully invisible", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const analysis = await openAnalysis(page);
  const hitStyle = await analysis.evaluate((host) => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.classList.add("analysis-v2-speed-hit");
    path.setAttribute("d", "M0,0 L20,20");
    svg.append(path);
    host.append(svg);
    const style = getComputedStyle(path);
    const result = {
      strokeOpacity: style.strokeOpacity,
      strokeWidth: style.strokeWidth,
      pointerEvents: style.pointerEvents,
    };
    svg.remove();
    return result;
  });
  expect(Number(hitStyle.strokeOpacity)).toBe(0);
  expect(Number.parseFloat(hitStyle.strokeWidth)).toBe(10);
  expect(hitStyle.pointerEvents).toBe("stroke");
});

test("keeps empty-state explanation out of the keyboard object", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const analysis = await openAnalysis(page);
  await expect(analysis.locator(".analysis-v2-speed-empty")).toBeHidden();
  await expect(analysis.locator(".analysis-v2-hero-readout")).toContainText("仍在累積");
});

test("swaps Coordination family details inside reserved space", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const analysis = await openAnalysis(page);
  const main = analysis.locator(".analysis-v2-main");
  const rail = analysis.locator(".analysis-v2-evidence-rail");
  const before = await rail.boundingBox();
  const scrollHeightBefore = await main.evaluate((element) => element.scrollHeight);

  await analysis.locator('[data-action="evidence-family"][data-family="hands"]').click();
  await expect(analysis.locator("#analysis-v2-evidence-detail")).toBeVisible();

  const after = await rail.boundingBox();
  const scrollHeightAfter = await main.evaluate((element) => element.scrollHeight);
  expect(before).not.toBeNull();
  expect(after).not.toBeNull();
  expect(Math.abs((after?.height ?? 0) - (before?.height ?? 0))).toBeLessThanOrEqual(1);
  expect(Math.abs(scrollHeightAfter - scrollHeightBefore)).toBeLessThanOrEqual(1);
});

test("opens data rules without increasing the page height", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const analysis = await openAnalysis(page);
  const main = analysis.locator(".analysis-v2-main");
  const method = analysis.locator(".analysis-v2-method");
  const heightBefore = await method.evaluate((element) => element.getBoundingClientRect().height);
  const scrollHeightBefore = await main.evaluate((element) => element.scrollHeight);

  await method.locator("summary").click();
  await expect(method).toHaveAttribute("open", "");

  const heightAfter = await method.evaluate((element) => element.getBoundingClientRect().height);
  const scrollHeightAfter = await main.evaluate((element) => element.scrollHeight);
  expect(Math.abs(heightAfter - heightBefore)).toBeLessThanOrEqual(1);
  expect(Math.abs(scrollHeightAfter - scrollHeightBefore)).toBeLessThanOrEqual(1);
});

test("gives Semantic a second summary level instead of ending at the lead keys", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const analysis = await openAnalysis(page);
  await analysis.locator('[data-tab="semantic"]').click();
  const rail = analysis.locator(".analysis-v2-semantic-rail");
  await expect(rail).toBeVisible();
  await expect(rail.locator(":scope > div")).toHaveCount(2);
  await expect(rail).toContainText("按鍵資料");
  await expect(rail).toContainText("誤按資料");
});

test("uses the same three Semantic leads in the readout and on the keyboard", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installSemanticLeadProgress(page);
  const analysis = await openAnalysis(page);
  await analysis.locator('[data-tab="semantic"]').click();

  const readoutSymbols = await analysis.locator(".analysis-v2-semantic-symbols")
    .textContent();
  const readoutCount = [...(readoutSymbols ?? "").replaceAll("　", "")].length;
  const salient = analysis.locator('[data-action="select-key"].is-salient');
  await expect(salient).toHaveCount(3);
  expect(readoutCount).toBe(3);

  const leadTokens = await salient.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-token")));
  expect(leadTokens).toEqual(["zhuyin:ㄅ", "zhuyin:ㄆ", "zhuyin:ㄇ"]);
});

test("removes the generic Semantic lead once a key is selected", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const analysis = await openAnalysis(page);
  await analysis.locator('[data-tab="semantic"]').click();
  const readout = analysis.locator(".analysis-v2-semantic-readout");
  await expect(readout).toBeVisible();

  await analysis.locator('[data-action="select-key"]').first().click();
  await expect(analysis.locator(".analysis-v2-semantic-stage")).toHaveClass(/has-selection/);
  await expect(readout).toBeHidden();
  await expect(analysis.locator(".analysis-v2-inspector")).toBeVisible();
});

test("keeps the Strategy readout below the matrix instead of colliding with cells", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const analysis = await openAnalysis(page);
  await analysis.locator('[data-tab="strategy"]').click();
  await analysis.locator('[data-action="strategy-size"][data-value="3"]').click();

  const geometry = await analysis.evaluate((host) => {
    const matrix = host.querySelector<HTMLElement>(".strategy-matrix")!;
    const readout = host.querySelector<HTMLElement>(".analysis-v2-strategy-readout")!;
    const matrixRect = matrix.getBoundingClientRect();
    const readoutRect = readout.getBoundingClientRect();
    return {
      matrixBottom: matrixRect.bottom,
      readoutTop: readoutRect.top,
    };
  });
  expect(geometry.readoutTop - geometry.matrixBottom).toBeGreaterThanOrEqual(18);
});
