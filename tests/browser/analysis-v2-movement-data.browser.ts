import { expect, test, type Page } from "@playwright/test";
import {
  aggregateMeasurementObservationsV2,
  coordinationAggregateKey,
  type CoordinationAggregateScope,
} from "../../src/measurement-v2/aggregate.js";
import { serializeProgressHistory } from "../../src/progress-history/serialize.js";
import {
  PROGRESS_HISTORY_SCHEMA_VERSION,
  type MotorTimingProgressHistory,
  type ProgressHistory,
} from "../../src/progress-history/types.js";
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
import {
  LOCAL_PROGRESS_HISTORY_KEY,
  LOCAL_PROGRESS_KEY,
} from "../../src/app/persistence-transaction.js";

function timingHistory(
  scope: CoordinationAggregateScope,
  values: readonly [number, number],
): MotorTimingProgressHistory<CoordinationAggregateScope> {
  return {
    scope,
    timing: [
      {
        endingSample: 5,
        completedRound: 1,
        samples: 5,
        representativeTimingMs: values[0],
      },
      {
        endingSample: 10,
        completedRound: 2,
        samples: 5,
        representativeTimingMs: values[1],
      },
    ],
    partialTiming: { samples: [] },
    totalTimingSamples: 10,
  };
}

function seededMovementState(): { progress: string; history: string } {
  const environment = createProductEnvironment({
    practice: PRACTICE_CATALOG,
    evaluation: EVALUATION_CATALOG,
    syntaxProfiles: SYNTAX_PROFILES,
  });
  const fresh = createFreshProgressForEnvironment(
    environment,
    "analysis-v2-movement-browser-data",
    "guided",
    STANDARD_BOPOMOFO_LAYOUT.id,
  );

  let syllableOrdinal = 0;
  const coordination = [
    ...Array.from({ length: 10 }, () => ({
      syllableOrdinal: syllableOrdinal++,
      bodyShape: "initial-medial-final" as const,
      timingMs: 320,
      clean: true,
    })),
    ...Array.from({ length: 10 }, () => ({
      syllableOrdinal: syllableOrdinal++,
      bodyShape: "initial-final" as const,
      timingMs: 220,
      clean: true,
    })),
    ...Array.from({ length: 10 }, () => ({
      syllableOrdinal: syllableOrdinal++,
      bodyShape: "medial-final" as const,
      timingMs: 180,
      clean: true,
    })),
    // Deliberately slower than every comparable row, but below the five-sample
    // evidence threshold. It must remain a sampling row, not rank first.
    ...Array.from({ length: 3 }, () => ({
      syllableOrdinal: syllableOrdinal++,
      bodyShape: "initial-medial" as const,
      timingMs: 500,
      clean: true,
    })),
  ];

  let revisitSequence = 1000;
  const sameHandRevisits = [
    // Adjacent same-hand timing is already represented by immediateHands and
    // must not reappear in the return-only family.
    ...Array.from({ length: 10 }, () => ({
      traceSequence: revisitSequence++,
      hand: "left" as const,
      boundary: "within-syllable" as const,
      timingMs: 90,
      oppositeHandEventsBetween: 0,
      clean: true,
    })),
    ...Array.from({ length: 10 }, () => ({
      traceSequence: revisitSequence++,
      hand: "left" as const,
      boundary: "within-syllable" as const,
      timingMs: 260,
      oppositeHandEventsBetween: 1,
      clean: true,
    })),
    ...Array.from({ length: 3 }, () => ({
      traceSequence: revisitSequence++,
      hand: "right" as const,
      boundary: "within-syllable" as const,
      timingMs: 310,
      oppositeHandEventsBetween: 1,
      clean: true,
    })),
  ];

  const measurements = aggregateMeasurementObservationsV2({
    bindings: [],
    confusions: [],
    inputOrderPositions: [],
    coordination,
    immediateTokens: [],
    immediateHands: [],
    sameHandRevisits,
    toneCommits: [],
    ambiguousErrorCount: 0,
    duplicateComponentCount: 0,
    prematureToneCount: 0,
  });
  const progress = {
    ...fresh,
    measurements,
    practiceRoundsCompleted: 2,
    curriculum: { ...fresh.curriculum, round: 2 },
  };

  const threeScope: CoordinationAggregateScope = { bodyShape: "initial-medial-final" };
  const initialFinalScope: CoordinationAggregateScope = { bodyShape: "initial-final" };
  const medialFinalScope: CoordinationAggregateScope = { bodyShape: "medial-final" };
  const samplingScope: CoordinationAggregateScope = { bodyShape: "initial-medial" };
  const history: ProgressHistory = {
    schemaVersion: PROGRESS_HISTORY_SCHEMA_VERSION,
    mode: "guided",
    layoutId: STANDARD_BOPOMOFO_LAYOUT.id,
    lastCompletedRound: 2,
    keys: {},
    motor: {
      coordination: {
        [coordinationAggregateKey(threeScope)]: timingHistory(threeScope, [350, 320]),
        [coordinationAggregateKey(initialFinalScope)]: timingHistory(initialFinalScope, [250, 220]),
        [coordinationAggregateKey(medialFinalScope)]: timingHistory(medialFinalScope, [205, 180]),
        [coordinationAggregateKey(samplingScope)]: {
          scope: samplingScope,
          timing: [],
          partialTiming: { samples: [520, 500, 480] },
          totalTimingSamples: 3,
        },
      },
      immediateHands: {},
      sameHandRevisits: {},
      toneCommits: {},
    },
  };

  return {
    progress: serializeProductProgress(progress),
    history: serializeProgressHistory(history),
  };
}

async function installMovementState(page: Page): Promise<void> {
  const state = seededMovementState();
  await page.addInitScript(({ progressKey, historyKey, progress, history }) => {
    window.localStorage.setItem(progressKey, progress);
    window.localStorage.setItem(historyKey, history);
  }, {
    progressKey: LOCAL_PROGRESS_KEY,
    historyKey: LOCAL_PROGRESS_HISTORY_KEY,
    progress: state.progress,
    history: state.history,
  });
}

test("ranks only comparable word structures and keeps populated Movement geometry readable", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installMovementState(page);
  await page.goto("/");
  await page.locator("#open-information").click();
  await page.locator(".analysis-v2-open").click();

  const analysis = page.locator("#analysis-v2");
  await analysis.locator('[data-action="coordination-view"][data-value="movement"]').click();

  const returnFamily = analysis.locator(".analysis-v2-movement-family").filter({ hasText: "同側回返" });
  await expect(returnFamily).toBeVisible();
  await expect(returnFamily.locator("header small")).toHaveText("1 可比較 · 1 樣本中");
  const returnRows = returnFamily.locator(".analysis-v2-movement-stat");
  await expect(returnRows).toHaveCount(2);
  const returnLabels = await returnRows.locator(":scope > span:first-child").allTextContents();
  expect(returnLabels).toEqual([
    "左 · 隔右側",
    "右 · 隔左側",
  ]);
  await expect(returnRows.nth(0).locator("strong")).toHaveText("260 ms");
  await expect(returnRows.nth(1)).toHaveClass(/sampling/);
  await expect(returnRows.nth(1).locator("strong")).toHaveText("—");
  expect(returnLabels.join(" ")).not.toContain("連續");

  const family = analysis.locator(".analysis-v2-movement-family").filter({ hasText: "字內結構" });
  await expect(family).toBeVisible();
  await expect(family.locator("header small")).toHaveText("3 可比較 · 1 樣本中");
  await expect(analysis.locator(".analysis-v2-movement-intro"))
    .toContainText("只有累積至少 5 個乾淨時間樣本的列才參與家族內慢→快排列");

  const rows = family.locator(".analysis-v2-movement-stat");
  await expect(rows).toHaveCount(4);
  const labels = await rows.locator(":scope > span:first-child").allTextContents();
  expect(labels).toEqual([
    "聲母＋介音＋韻母",
    "聲母＋韻母",
    "介音＋韻母",
    "聲母＋介音",
  ]);
  await expect(rows.nth(0).locator("strong")).toHaveText("320 ms");
  await expect(rows.nth(1).locator("strong")).toHaveText("220 ms");
  await expect(rows.nth(2).locator("strong")).toHaveText("180 ms");
  await expect(rows.nth(0).locator(".analysis-v2-movement-reading small")).toHaveText("· 10 個樣本");
  await expect(rows.nth(1).locator(".analysis-v2-movement-reading small")).toHaveText("· 10 個樣本");
  await expect(rows.nth(2).locator(".analysis-v2-movement-reading small")).toHaveText("· 10 個樣本");
  await expect(rows.nth(0)).not.toContainText("次觀察");
  await expect(rows.nth(3)).toHaveClass(/sampling/);
  await expect(rows.nth(3).locator("strong")).toHaveText("—");
  await expect(rows.nth(3).locator(".analysis-v2-movement-reading small"))
    .toHaveText("· 樣本中 · 3 個樣本");
  await expect(family.locator(".analysis-v2-motor-sparkline")).toHaveCount(3);

  const geometry = await family.evaluate((node) => {
    const diagram = node.querySelector<HTMLElement>(".analysis-v2-movement-diagram")!;
    const stats = node.querySelector<HTMLElement>(".analysis-v2-movement-stats")!;
    const rows = [...node.querySelectorAll<HTMLElement>(".analysis-v2-movement-stat")];
    const readings = [...node.querySelectorAll<HTMLElement>(".analysis-v2-movement-reading")];
    const familyRect = node.getBoundingClientRect();
    const diagramRect = diagram.getBoundingClientRect();
    const statsRect = stats.getBoundingClientRect();
    const rowRects = rows.map((row) => row.getBoundingClientRect());
    const readingRects = readings.map((reading) => reading.getBoundingClientRect());
    return {
      diagramBottom: diagramRect.bottom,
      statsTop: statsRect.top,
      familyLeft: familyRect.left,
      familyRight: familyRect.right,
      rows: rowRects.map((rect) => ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom })),
      readings: readingRects.map((rect) => ({ left: rect.left, right: rect.right })),
      sparklineWidths: [...node.querySelectorAll<SVGSVGElement>(".analysis-v2-motor-sparkline")]
        .map((svg) => svg.getBoundingClientRect().width),
    };
  });
  expect(geometry.statsTop).toBeGreaterThanOrEqual(geometry.diagramBottom - 1);
  for (const row of geometry.rows) {
    expect(row.left).toBeGreaterThanOrEqual(geometry.familyLeft - 1);
    expect(row.right).toBeLessThanOrEqual(geometry.familyRight + 1);
  }
  for (const reading of geometry.readings) {
    expect(reading.left).toBeGreaterThanOrEqual(geometry.familyLeft - 1);
    expect(reading.right).toBeLessThanOrEqual(geometry.familyRight + 1);
  }
  for (let index = 1; index < geometry.rows.length; index += 1) {
    expect(geometry.rows[index]!.top).toBeGreaterThanOrEqual(geometry.rows[index - 1]!.bottom - 1);
  }
  expect(geometry.sparklineWidths.every((width) => width > 60 && width <= 105)).toBe(true);
});
