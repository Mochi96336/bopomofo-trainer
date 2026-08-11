import { expect, test, type Locator, type Page } from "@playwright/test";
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

async function openSemantic(page: Page): Promise<Locator> {
  await page.goto("/");
  await page.locator("#open-information").click();
  await page.locator(".analysis-v2-open").click();
  const analysis = page.locator("#analysis-v2");
  await expect(analysis).toBeVisible();
  await page.waitForTimeout(340);
  await analysis.locator('[data-tab="semantic"]').click();
  return analysis;
}

function seededStrategyProgress(): string {
  const environment = createProductEnvironment({
    practice: PRACTICE_CATALOG,
    evaluation: EVALUATION_CATALOG,
    syntaxProfiles: SYNTAX_PROFILES,
  });
  const fresh = createFreshProgressForEnvironment(
    environment,
    "analysis-v2-feedback-strategy-data",
    "guided",
    STANDARD_BOPOMOFO_LAYOUT.id,
  );
  let syllableOrdinal = 0;
  const positions: Array<{
    syllableOrdinal: number;
    bodySize: number;
    canonicalBodyIndex: number;
    acceptedBodyIndex: number;
  }> = [];
  const add = (canonicalBodyIndex: number, acceptedBodyIndex: number, count: number): void => {
    for (let index = 0; index < count; index += 1) {
      positions.push({
        syllableOrdinal: syllableOrdinal++,
        bodySize: 3,
        canonicalBodyIndex,
        acceptedBodyIndex,
      });
    }
  };

  add(0, 0, 12);
  add(1, 1, 10);
  add(1, 2, 2);
  add(2, 2, 12);

  const measurements = aggregateMeasurementObservationsV2({
    bindings: [],
    confusions: [],
    inputOrderPositions: positions,
    inputOrderPermutations: [
      ...Array.from({ length: 10 }, (_, index) => ({
        syllableOrdinal: 100 + index,
        permutation: "first-middle-last" as const,
      })),
      ...Array.from({ length: 2 }, (_, index) => ({
        syllableOrdinal: 200 + index,
        permutation: "middle-last-first" as const,
      })),
    ],
    inputOrderTrajectories: [
      ...Array.from({ length: 10 }, (_, index) => ({
        syllableOrdinal: 100 + index,
        bodySize: 3 as const,
        permutation: "first-middle-last" as const,
        elapsedMs: [0, 110 + index * 2, 230 + index * 3] as const,
      })),
      ...Array.from({ length: 2 }, (_, index) => ({
        syllableOrdinal: 200 + index,
        bodySize: 3 as const,
        permutation: "middle-last-first" as const,
        elapsedMs: [0, 145 + index * 4, 315 + index * 5] as const,
      })),
    ],
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

async function openPopulatedStrategy(page: Page): Promise<Locator> {
  const source = seededStrategyProgress();
  await page.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, value);
  }, { key: PROGRESS_KEY, value: source });
  await page.goto("/");
  await page.locator("#open-information").click();
  await page.locator(".analysis-v2-open").click();
  const analysis = page.locator("#analysis-v2");
  await expect(analysis).toBeVisible();
  await page.waitForTimeout(340);
  await analysis.locator('[data-tab="strategy"]').click();
  await analysis.locator('[data-action="strategy-size"][data-value="3"]').click();
  return analysis;
}

test("uses current-key accent only for the explicitly selected Semantic key", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const analysis = await openSemantic(page);
  const key = analysis.locator('[data-action="select-key"]').first();
  await key.click();

  const palette = await key.evaluate((node) => {
    const host = node.closest<HTMLElement>(".analysis-v2")!;
    const probe = document.createElement("span");
    host.append(probe);
    probe.style.borderColor = "var(--key-current-border)";
    probe.style.backgroundColor = "var(--key-current-bg)";
    const expectedBorder = getComputedStyle(probe).borderColor;
    const expectedBackground = getComputedStyle(probe).backgroundColor;
    probe.remove();
    const actual = getComputedStyle(node);
    return {
      expectedBorder,
      expectedBackground,
      border: actual.borderColor,
      background: actual.backgroundColor,
      color: actual.color,
    };
  });

  expect(palette.border).toBe(palette.expectedBorder);
  expect(palette.background).toBe(palette.expectedBackground);
  expect(palette.color).not.toBe(palette.border);
});

test("keeps aggregate movement families out of the default Coordination viewport", async ({ page }) => {
  // This test owns the normal-height default-view contract. Compact-height flow
  // behavior is covered separately at and below the 700px fallback boundary.
  await page.setViewportSize({ width: 1064, height: 720 });
  await page.goto("/");
  await page.locator("#open-information").click();
  await page.locator(".analysis-v2-open").click();
  const analysis = page.locator("#analysis-v2");
  await expect(analysis).toBeVisible();
  await page.waitForTimeout(340);

  await expect(analysis.locator(".analysis-v2-speed-board")).toBeVisible();
  await expect(analysis.locator(".analysis-v2-movement-view")).toHaveCount(0);
  const overflow = await analysis.locator(".analysis-v2-main").evaluate((main) => ({
    scrollHeight: main.scrollHeight,
    clientHeight: main.clientHeight,
  }));
  expect(overflow.scrollHeight - overflow.clientHeight).toBeLessThanOrEqual(2);

  await analysis.locator('[data-action="coordination-view"][data-value="movement"]').click();
  await expect(analysis.locator(".analysis-v2-movement-view")).toBeVisible();
  await expect(analysis.locator(".analysis-v2-speed-board")).toHaveCount(0);
});

test("keeps a populated whole-word Strategy lead below the trajectory field", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const analysis = await openPopulatedStrategy(page);
  const readout = analysis.locator(".analysis-v2-strategy-readout");
  await expect(readout).toContainText("換序輸入");
  await expect(readout).toContainText("17%");
  await expect(readout).toContainText("2 / 12 個三注音字");
  await expect(readout).toContainText("介音 → 韻母 → 聲母 17%");

  const geometry = await analysis.evaluate((host) => {
    const object = host.querySelector<HTMLElement>(".analysis-v2-strategy-trajectory-object")!;
    const readout = host.querySelector<HTMLElement>(".analysis-v2-strategy-readout")!;
    const objectRect = object.getBoundingClientRect();
    const readoutRect = readout.getBoundingClientRect();
    return {
      gap: readoutRect.top - objectRect.bottom,
      readoutBelowObject: readoutRect.top >= objectRect.bottom - 1,
    };
  });

  expect(geometry.gap).toBeGreaterThanOrEqual(0);
  expect(geometry.readoutBelowObject).toBe(true);
});
