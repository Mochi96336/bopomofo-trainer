import { expect, test, type Page } from "@playwright/test";
import {
  aggregateMeasurementObservationsV2,
} from "../../src/measurement-v2/aggregate.js";
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

function seededAnalysisProgress(): string {
  const environment = createProductEnvironment({
    practice: PRACTICE_CATALOG,
    evaluation: EVALUATION_CATALOG,
    syntaxProfiles: SYNTAX_PROFILES,
  });
  const fresh = createFreshProgressForEnvironment(
    environment,
    "analysis-v2-browser-data",
    "guided",
    STANDARD_BOPOMOFO_LAYOUT.id,
  );
  let sequence = 0;
  const measurements = aggregateMeasurementObservationsV2({
    bindings: [
      {
        traceSequence: sequence++,
        scope: { mode: "guided", layoutId: STANDARD_BOPOMOFO_LAYOUT.id, tokenId: "zhuyin:ㄅ" },
        physicalCode: "Digit1",
        correct: false,
        timingMs: null,
      },
      ...Array.from({ length: 8 }, (_, index) => ({
        traceSequence: sequence++,
        scope: { mode: "guided" as const, layoutId: STANDARD_BOPOMOFO_LAYOUT.id, tokenId: "zhuyin:ㄆ" },
        physicalCode: "KeyQ",
        correct: index >= 4,
        timingMs: index === 0 ? null : 120 + index,
      })),
    ],
    confusions: [
      {
        traceSequence: sequence++,
        mode: "guided",
        layoutId: STANDARD_BOPOMOFO_LAYOUT.id,
        expectedToken: "zhuyin:ㄅ",
        actualToken: "zhuyin:ㄆ",
        physicalCode: "KeyQ",
      },
      ...Array.from({ length: 3 }, () => ({
        traceSequence: sequence++,
        mode: "guided" as const,
        layoutId: STANDARD_BOPOMOFO_LAYOUT.id,
        expectedToken: "zhuyin:ㄆ",
        actualToken: "zhuyin:ㄇ",
        physicalCode: "KeyA",
      })),
    ],
    inputOrderPositions: [
      { syllableOrdinal: 0, bodySize: 2, canonicalBodyIndex: 0, acceptedBodyIndex: 1 },
      { syllableOrdinal: 0, bodySize: 2, canonicalBodyIndex: 1, acceptedBodyIndex: 0 },
      { syllableOrdinal: 1, bodySize: 3, canonicalBodyIndex: 0, acceptedBodyIndex: 1 },
    ],
    coordination: [],
    immediateTokens: [
      ...Array.from({ length: 5 }, (_, index) => ({
        traceSequence: sequence++,
        fromToken: "zhuyin:ㄅ",
        toToken: "zhuyin:ㄆ",
        boundary: "within-syllable" as const,
        timingMs: 100 + index * 4,
        clean: true,
      })),
      ...Array.from({ length: 4 }, (_, index) => ({
        traceSequence: sequence++,
        fromToken: "zhuyin:ㄆ",
        toToken: "zhuyin:ㄇ",
        boundary: "within-syllable" as const,
        timingMs: 140 + index * 4,
        clean: true,
      })),
    ],
    immediateHands: [],
    sameHandRevisits: [],
    toneCommits: [],
    ambiguousErrorCount: 0,
    duplicateComponentCount: 0,
    prematureToneCount: 0,
  });
  return serializeProductProgress({
    ...fresh,
    measurements,
  });
}

async function installAnalysisProgress(page: Page): Promise<void> {
  const progress = seededAnalysisProgress();
  await page.addInitScript(({ key, source }) => {
    window.localStorage.setItem(key, source);
  }, { key: PROGRESS_KEY, source: progress });
}

test("renders the information-panel Analysis V2 summary as a structured three-column entry point", async ({ page }) => {
  await page.goto("/");
  await page.locator("#open-information").click();

  const summary = page.locator(".analysis-v2-summary");
  await expect(summary).toBeVisible();
  await expect(summary.locator(".analysis-v2-summary-heading h3")).toHaveText("分析");
  const layout = await summary.evaluate((element) => {
    const signals = element.querySelector<HTMLElement>(".analysis-v2-summary-signals")!;
    const cells = [...signals.children] as HTMLElement[];
    const open = element.querySelector<HTMLElement>(".analysis-v2-open")!;
    return {
      summaryDisplay: getComputedStyle(element).display,
      signalsDisplay: getComputedStyle(signals).display,
      columns: getComputedStyle(signals).gridTemplateColumns.split(" ").filter(Boolean).length,
      strongDisplays: cells.map((cell) => getComputedStyle(cell.querySelector("strong")!).display),
      secondBorder: getComputedStyle(cells[1]!).borderLeftWidth,
      arrow: getComputedStyle(open, "::after").content,
    };
  });
  expect(layout.summaryDisplay).toBe("grid");
  expect(layout.signalsDisplay).toBe("grid");
  expect(layout.columns).toBe(3);
  expect(layout.strongDisplays).toEqual(["block", "block", "block"]);
  expect(layout.secondBorder).not.toBe("0px");
  expect(layout.arrow).toContain("→");
});

test("renders evidence thresholds through the production Analysis V2 mount", async ({ page }) => {
  await installAnalysisProgress(page);
  await page.goto("/");
  await page.locator("#open-information").click();
  await page.locator(".analysis-v2-open").click();

  const analysis = page.locator("#analysis-v2");
  await expect(analysis.locator('[data-tab="coordination"]')).toHaveAttribute("aria-selected", "true");
  await analysis.locator('[data-tab="semantic"]').click();
  const insufficient = analysis.locator('[data-action="select-key"][data-token="zhuyin:ㄅ"]');
  const sufficient = analysis.locator('[data-action="select-key"][data-token="zhuyin:ㄆ"]');
  await expect(insufficient).toHaveClass(/insufficient/);
  await expect(sufficient).toHaveClass(/sufficient/);
  expect(await insufficient.evaluate((element) =>
    getComputedStyle(element).getPropertyValue("--analysis-strength").trim(),
  )).toBe("0");
  expect(Number(await sufficient.evaluate((element) =>
    getComputedStyle(element).getPropertyValue("--analysis-strength").trim(),
  ))).toBeGreaterThan(0);

  await analysis.locator('[data-action="semantic-view"][data-value="confusion"]').click();
  await expect(analysis.locator(".confusion-matrix")).toHaveCount(0);
  await expect(analysis.locator(".analysis-v2-confusion-table")).toHaveCount(0);
  await expect(analysis.locator(".analysis-v2-keyboard")).toHaveCount(1);

  await analysis.locator('[data-action="select-key"][data-token="zhuyin:ㄅ"]').click();
  await expect(analysis.locator(".analysis-v2-confusion-list li")).toHaveCount(1);
  await expect(analysis.locator(".analysis-v2-confusion-list")).toContainText("樣本不足");
  await analysis.locator('[data-action="select-key"][data-token="zhuyin:ㄆ"]').click();
  await expect(analysis.locator(".analysis-v2-confusion-list li")).toHaveCount(1);
  await expect(analysis.locator(".analysis-v2-confusion-list")).toContainText("初步");

  await analysis.locator('[data-tab="coordination"]').click();
  await expect(analysis.locator(".analysis-v2-speed-path")).toHaveCount(1);
  await expect(analysis.locator(".analysis-v2-speed-caption")).toContainText("1 條可比較");
  await expect(analysis.locator(".analysis-v2-speed-readout")).toContainText("5 個乾淨樣本");
  await expect(analysis.locator(".analysis-v2-movement-view")).toHaveCount(0);
  await expect(analysis.locator('[data-action="coordination-view"][data-value="paths"]'))
    .toHaveAttribute("aria-pressed", "true");
});

test("opens Analysis V2 on flylines without reviving the legacy transition network", async ({ page }) => {
  await page.goto("/");
  await page.locator("#open-information").click();
  await page.locator(".analysis-v2-open").click();
  await expect(page.locator(".analysis-v2-modal")).toBeVisible();
  await expect(page.locator("#analysis-v2")).toBeVisible();

  const analysis = page.locator("#analysis-v2");
  const tabs = analysis.locator('[role="tab"]');
  await expect(tabs).toHaveText(["協調", "語意", "策略"]);
  await expect(analysis.locator('[data-tab="coordination"]')).toHaveAttribute("aria-selected", "true");
  await expect(analysis.locator(".analysis-v2-speed-field")).toBeVisible();
  for (let index = 0; index < 3; index += 1) {
    const panelId = await tabs.nth(index).getAttribute("aria-controls");
    expect(panelId).not.toBeNull();
    await expect(page.locator(`#${panelId}`)).toHaveCount(1);
  }
  await expect(analysis.locator('[data-action="toggle-network"]')).toHaveCount(0);
  await expect(analysis.locator(".diagnostic-relationship-svg")).toHaveCount(0);

  await analysis.locator('[data-action="coordination-view"][data-value="movement"]').click();
  const movement = analysis.locator(".analysis-v2-movement-view");
  await expect(movement).toBeVisible();
  await expect(movement.locator(".analysis-v2-movement-family")).toHaveCount(4);
  await expect(movement).toContainText("手別轉換");
  await expect(movement).toContainText("不代表偵測到實際使用哪隻手");
  await expect(movement.locator("table")).toHaveCount(0);

  await analysis.locator('[data-tab="strategy"]').click();
  await expect(analysis.locator('[data-tab="strategy"]')).toHaveAttribute("aria-selected", "true");
  await expect(analysis.locator(".strategy-matrix")).toHaveCount(1);
  await expect(analysis.locator('[data-action="strategy-size"]')).toHaveText([
    "2 個注音",
    "3 個注音",
  ]);
  await expect(analysis.locator(".analysis-v2-strategy-segments"))
    .toHaveAttribute("aria-label", "音節內注音成分數，不含聲調");
  const method = analysis.locator(".analysis-v2-method");
  await expect(method.locator("summary")).toHaveText("資料規則");
  await method.locator("summary").click();
  await expect(method).toContainText("1 個注音沒有順序差異");
});

test("fits Analysis V2 and the full flyline keyboard at a narrow phone viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.locator("#open-information").click();
  await page.locator(".analysis-v2-open").click();

  const modal = page.locator(".analysis-v2-modal");
  const analysis = page.locator("#analysis-v2");
  await expect(modal).toBeVisible();
  await expect(analysis).toBeVisible();

  const viewportContainment = await modal.evaluate((element) => {
    const bounds = element.getBoundingClientRect();
    return {
      viewportWidth: window.innerWidth,
      documentWidth: document.documentElement.scrollWidth,
      viewportHeight: window.innerHeight,
      left: bounds.left,
      right: bounds.right,
      top: bounds.top,
      bottom: bounds.bottom,
    };
  });
  expect(viewportContainment.documentWidth).toBeLessThanOrEqual(viewportContainment.viewportWidth);
  expect(viewportContainment.left).toBeGreaterThanOrEqual(0);
  expect(viewportContainment.top).toBeGreaterThanOrEqual(0);
  expect(viewportContainment.right).toBeLessThanOrEqual(viewportContainment.viewportWidth);
  expect(viewportContainment.bottom).toBeLessThanOrEqual(viewportContainment.viewportHeight);

  const speedField = analysis.locator(".analysis-v2-speed-field");
  const speedScroll = analysis.locator(".analysis-v2-speed-scroll");
  await expect(speedField).toBeVisible();
  const overflow = await analysis.evaluate((host) => {
    const main = host.querySelector<HTMLElement>(".analysis-v2-main")!;
    const field = host.querySelector<HTMLElement>(".analysis-v2-speed-field")!;
    const scroller = host.querySelector<HTMLElement>(".analysis-v2-speed-scroll")!;
    const board = host.querySelector<HTMLElement>(".analysis-v2-speed-board")!;
    const caption = host.querySelector<HTMLElement>(".analysis-v2-speed-caption")!;
    const readout = host.querySelector<HTMLElement>(".analysis-v2-speed-readout")!;
    const mainRect = main.getBoundingClientRect();
    const boardRect = board.getBoundingClientRect();
    return {
      mainClient: main.clientWidth,
      mainScroll: main.scrollWidth,
      fieldClient: field.clientWidth,
      fieldScroll: field.scrollWidth,
      scrollerClient: scroller.clientWidth,
      scrollerScroll: scroller.scrollWidth,
      boardLeft: boardRect.left,
      boardRight: boardRect.right,
      mainLeft: mainRect.left,
      mainRight: mainRect.right,
      captionRight: caption.getBoundingClientRect().right,
      readoutRight: readout.getBoundingClientRect().right,
      fieldRight: field.getBoundingClientRect().right,
    };
  });
  expect(overflow.mainScroll).toBeLessThanOrEqual(overflow.mainClient + 1);
  expect(overflow.fieldScroll).toBeLessThanOrEqual(overflow.fieldClient + 1);
  // 3D key-plane rounding can report a two-pixel transformed overflow even
  // though the board bounds remain fully contained and overflow is clipped.
  expect(overflow.scrollerScroll).toBeLessThanOrEqual(overflow.scrollerClient + 2);
  expect(overflow.boardLeft).toBeGreaterThanOrEqual(overflow.mainLeft - 1);
  expect(overflow.boardRight).toBeLessThanOrEqual(overflow.mainRight + 1);
  expect(overflow.captionRight).toBeLessThanOrEqual(overflow.fieldRight + 1);
  expect(overflow.readoutRight).toBeLessThanOrEqual(overflow.fieldRight + 1);
  await expect(speedScroll).toHaveAttribute("tabindex", "0");

  await expect(analysis.locator('[role="tab"]')).toHaveCount(3);
  await expect(analysis.locator(".analysis-v2-close")).toBeVisible();
});
