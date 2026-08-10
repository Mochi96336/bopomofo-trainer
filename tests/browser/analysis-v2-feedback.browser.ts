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
  const confusionSpecs = [
    ["zhuyin:ㄅ", "zhuyin:ㄆ", 6],
    ["zhuyin:ㄅ", "zhuyin:ㄇ", 2],
    ["zhuyin:ㄆ", "zhuyin:ㄈ", 5],
    ["zhuyin:ㄇ", "zhuyin:ㄈ", 3],
    ["zhuyin:ㄈ", "zhuyin:ㄅ", 1],
  ] as const;
  const confusions = confusionSpecs.flatMap(([expectedToken, actualToken, count]) =>
    Array.from({ length: count }, () => ({
      traceSequence: sequence++,
      mode: "guided" as const,
      layoutId: STANDARD_BOPOMOFO_LAYOUT.id,
      expectedToken,
      actualToken,
      physicalCode: physicalCodeFor(actualToken),
    })));
  const measurements = aggregateMeasurementObservationsV2({
    bindings,
    confusions,
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

test("keeps the Analysis title inset while joining the active tab to the header divider", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const analysis = await openAnalysis(page);
  const geometry = await analysis.evaluate((host) => {
    const header = host.querySelector<HTMLElement>(".analysis-v2-header")!;
    const title = header.querySelector<HTMLElement>("h2")!;
    const activeTab = header.querySelector<HTMLElement>('.analysis-v2-tabs button[aria-selected="true"]')!;
    const headerRect = header.getBoundingClientRect();
    const titleRect = title.getBoundingClientRect();
    const activeRect = activeTab.getBoundingClientRect();
    const indicator = getComputedStyle(activeTab, "::after");
    const indicatorBottom = activeRect.bottom - Number.parseFloat(indicator.bottom);
    return {
      leftInset: titleRect.left - headerRect.left,
      lineGap: headerRect.bottom - titleRect.bottom,
      indicatorDividerGap: Math.abs(headerRect.bottom - indicatorBottom),
    };
  });
  expect(geometry.leftInset).toBeGreaterThanOrEqual(24);
  expect(geometry.lineGap).toBeGreaterThanOrEqual(8);
  expect(geometry.indicatorDividerGap).toBeLessThanOrEqual(1.5);
});

test("does not expose a desktop horizontal scroller while the keyboard enters", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const analysis = await openAnalysis(page);
  const overflow = await analysis.locator(".analysis-v2-speed-scroll")
    .evaluate((element) => getComputedStyle(element).overflowX);
  expect(overflow).toBe("clip");
});

test("fits the full Coordination keyboard on a phone instead of hiding its right side", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const analysis = await openAnalysis(page);
  const fit = await analysis.evaluate((host) => {
    const main = host.querySelector<HTMLElement>(".analysis-v2-main")!;
    const board = host.querySelector<HTMLElement>(".analysis-v2-speed-board")!;
    const mainRect = main.getBoundingClientRect();
    const boardRect = board.getBoundingClientRect();
    return {
      left: boardRect.left - mainRect.left,
      right: mainRect.right - boardRect.right,
      overflowX: getComputedStyle(host.querySelector<HTMLElement>(".analysis-v2-speed-scroll")!).overflowX,
    };
  });
  expect(fit.left).toBeGreaterThanOrEqual(-1);
  expect(fit.right).toBeGreaterThanOrEqual(-1);
  expect(fit.overflowX).toBe("clip");
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

test("moves aggregate Coordination families into a separate compact Movement view", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const analysis = await openAnalysis(page);

  await expect(analysis.locator(".analysis-v2-speed-board")).toBeVisible();
  await expect(analysis.locator(".analysis-v2-movement-view")).toHaveCount(0);
  await expect(analysis.locator('[data-action="coordination-view"]')).toHaveText(["鍵間", "動作"]);

  await analysis.locator('[data-action="coordination-view"][data-value="movement"]').click();
  const movement = analysis.locator(".analysis-v2-movement-view");
  await expect(movement).toBeVisible();
  await expect(movement.locator(".analysis-v2-movement-family")).toHaveCount(4);
  await expect(movement).toContainText("手別轉換");
  await expect(movement).toContainText("同側回返");
  await expect(movement).toContainText("字內結構");
  await expect(movement).toContainText("聲調收尾");
  await expect(movement.locator(".analysis-v2-word-structure")).toContainText("聲母");
  await expect(movement.locator(".analysis-v2-word-structure")).toContainText("介音");
  await expect(movement.locator(".analysis-v2-word-structure")).toContainText("韻母");
  await expect(movement.locator("table")).toHaveCount(0);
  await expect(movement.locator(".analysis-v2-motor-sparkline")).toHaveCount(0);
});

test("opens data rules upward without lengthening the page", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const analysis = await openAnalysis(page);
  const method = analysis.locator(".analysis-v2-method");
  const before = await analysis.evaluate((host) => {
    const main = host.querySelector<HTMLElement>(".analysis-v2-main")!;
    const methodNode = host.querySelector<HTMLElement>(".analysis-v2-method")!;
    return {
      scrollHeight: main.scrollHeight,
      methodHeight: methodNode.getBoundingClientRect().height,
    };
  });

  await method.locator("summary").click();
  await expect(method).toHaveAttribute("open", "");

  const after = await analysis.evaluate((host) => {
    const main = host.querySelector<HTMLElement>(".analysis-v2-main")!;
    const methodNode = host.querySelector<HTMLElement>(".analysis-v2-method")!;
    const summary = methodNode.querySelector<HTMLElement>("summary")!;
    const popup = methodNode.querySelector<HTMLElement>("p")!;
    return {
      scrollHeight: main.scrollHeight,
      methodHeight: methodNode.getBoundingClientRect().height,
      overflowY: getComputedStyle(methodNode).overflowY,
      popupPosition: getComputedStyle(popup).position,
      popupBottom: popup.getBoundingClientRect().bottom,
      summaryTop: summary.getBoundingClientRect().top,
    };
  });
  expect(Math.abs(after.methodHeight - before.methodHeight)).toBeLessThanOrEqual(1);
  expect(Math.abs(after.scrollHeight - before.scrollHeight)).toBeLessThanOrEqual(1);
  expect(after.overflowY).toBe("visible");
  expect(after.popupPosition).toBe("absolute");
  expect(after.popupBottom).toBeLessThan(after.summaryTop);
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

test("maps all observed Semantic keys onto a continuous keyboard gradient", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installSemanticLeadProgress(page);
  const analysis = await openAnalysis(page);
  await analysis.locator('[data-tab="semantic"]').click();

  const readoutSymbols = await analysis.locator(".analysis-v2-semantic-symbols").textContent();
  const readoutCount = [...(readoutSymbols ?? "").replaceAll("　", "")].length;
  expect(readoutCount).toBe(3);

  const keys = analysis.locator('[data-action="select-key"].has-data');
  await expect(keys).toHaveCount(4);
  const strengths = await Promise.all(
    ["zhuyin:ㄅ", "zhuyin:ㄆ", "zhuyin:ㄇ", "zhuyin:ㄈ"].map((token) =>
      analysis.locator(`[data-action="select-key"][data-token="${token}"]`)
        .evaluate((element) => Number.parseFloat(
          (element as HTMLElement).style.getPropertyValue("--analysis-strength"),
        ))),
  );
  expect(strengths[0]).toBeGreaterThan(strengths[1]!);
  expect(strengths[1]).toBeGreaterThan(strengths[2]!);
  expect(strengths[2]).toBeGreaterThan(strengths[3]!);
});

test("restores compact observed confusion flylines over the full Semantic gradient", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installSemanticLeadProgress(page);
  const analysis = await openAnalysis(page);
  await analysis.locator('[data-tab="semantic"]').click();
  await analysis.locator('[data-action="semantic-view"][data-value="confusion"]').click();

  const flylines = analysis.locator(".analysis-v2-confusion-path");
  await expect(analysis.locator(".analysis-v2-confusion-svg")).toBeVisible();
  expect(await flylines.count()).toBeGreaterThan(0);
  expect(await flylines.count()).toBeLessThanOrEqual(8);
  await expect(analysis.locator(".analysis-v2-confusion-path.is-accent")).toHaveCount(0);
  await expect(analysis.locator('[data-action="select-key"].has-data')).toHaveCount(4);

  await analysis.locator('[data-action="select-key"][data-token="zhuyin:ㄅ"]').click();
  await expect(analysis.locator(".analysis-v2-confusion-path.is-accent")).toHaveCount(1);
  expect(await analysis.locator(".analysis-v2-confusion-path").count()).toBe(2);
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
