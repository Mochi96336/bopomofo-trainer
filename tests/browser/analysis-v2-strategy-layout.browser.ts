import { expect, test, type Page } from "@playwright/test";
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

const THREE_PART_ORDER = {
  "first-middle-last": [0, 1, 2],
  "middle-first-last": [1, 0, 2],
  "first-last-middle": [0, 2, 1],
  "middle-last-first": [1, 2, 0],
  "last-first-middle": [2, 0, 1],
  "last-middle-first": [2, 1, 0],
} as const;

function seededTrajectoryProgress(): string {
  const environment = createProductEnvironment({
    practice: PRACTICE_CATALOG,
    evaluation: EVALUATION_CATALOG,
    syntaxProfiles: SYNTAX_PROFILES,
  });
  const fresh = createFreshProgressForEnvironment(
    environment,
    "analysis-v2-strategy-trajectory-browser-data",
    "guided",
    STANDARD_BOPOMOFO_LAYOUT.id,
  );
  const threePartPermutations = [
    "first-middle-last",
    "first-middle-last",
    "first-middle-last",
    "first-middle-last",
    "first-middle-last",
    "first-middle-last",
    "middle-last-first",
    "middle-last-first",
    "middle-first-last",
    "last-middle-first",
  ] as const;
  const twoPartPermutations = [
    "first-last",
    "first-last",
    "first-last",
    "first-last",
    "first-last",
    "first-last",
    "first-last",
    "first-last",
    "last-first",
    "last-first",
  ] as const;
  const threePartTrajectories = threePartPermutations.map((permutation, index) => ({
    syllableOrdinal: index,
    bodySize: 3 as const,
    permutation,
    elapsedMs: [0, 82 + index * 7, 218 + index * 13] as const,
  }));
  const twoPartTrajectories = twoPartPermutations.map((permutation, index) => ({
    syllableOrdinal: 100 + index,
    bodySize: 2 as const,
    permutation,
    elapsedMs: [0, 96 + index * 11] as const,
  }));
  const threePartPositions = threePartPermutations.flatMap((permutation, syllableOrdinal) =>
    THREE_PART_ORDER[permutation].map((canonicalBodyIndex, acceptedBodyIndex) => ({
      syllableOrdinal,
      bodySize: 3,
      canonicalBodyIndex,
      acceptedBodyIndex,
    })));
  const twoPartPositions = twoPartPermutations.flatMap((permutation, index) => {
    const acceptedOrder = permutation === "first-last" ? [0, 1] : [1, 0];
    return acceptedOrder.map((canonicalBodyIndex, acceptedBodyIndex) => ({
      syllableOrdinal: 100 + index,
      bodySize: 2,
      canonicalBodyIndex,
      acceptedBodyIndex,
    }));
  });
  const measurements = aggregateMeasurementObservationsV2({
    bindings: [],
    confusions: [],
    inputOrderPositions: [...twoPartPositions, ...threePartPositions],
    inputOrderPermutations: threePartPermutations.map((permutation, syllableOrdinal) => ({
      syllableOrdinal,
      permutation,
    })),
    inputOrderTrajectories: [...twoPartTrajectories, ...threePartTrajectories],
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

async function installTrajectoryProgress(page: Page): Promise<void> {
  const source = seededTrajectoryProgress();
  await page.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, value);
  }, { key: PROGRESS_KEY, value: source });
}

async function openAnalysis(page: Page): Promise<void> {
  await page.goto("/");
  await page.locator("#open-information").click();
  await page.locator(".analysis-v2-open").click();
  await page.waitForTimeout(340);
}

test("pairs Strategy projection and readout on the same viewport rail as other Analysis views", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openAnalysis(page);
  const analysis = page.locator("#analysis-v2");
  await analysis.locator('[data-tab="strategy"]').click();

  const geometry = await analysis.evaluate((host) => {
    const slot = host.querySelector<HTMLElement>(
      ".analysis-v2-strategy-stage .analysis-v2-primary-object-slot",
    )!;
    const trajectory = host.querySelector<HTMLElement>(".analysis-v2-strategy-trajectory")!;
    const readout = host.querySelector<HTMLElement>(".analysis-v2-strategy-readout")!;
    const headline = readout.querySelector<HTMLElement>("strong")!;
    const projection = host.querySelector<HTMLElement>(".analysis-v2-strategy-projection")!;
    const method = host.querySelector<HTMLElement>(".analysis-v2-strategy-domain > .analysis-v2-method")!;
    const trajectoryRect = trajectory.getBoundingClientRect();
    const readoutRect = readout.getBoundingClientRect();
    const headlineRect = headline.getBoundingClientRect();
    const projectionRect = projection.getBoundingClientRect();
    const methodRect = method.getBoundingClientRect();
    return {
      slotPosition: getComputedStyle(slot).position,
      trajectoryLeft: trajectoryRect.left,
      trajectoryRight: trajectoryRect.right,
      trajectoryCenterX: trajectoryRect.left + trajectoryRect.width / 2,
      trajectoryCenterY: trajectoryRect.top + trajectoryRect.height / 2,
      trajectoryWidth: trajectoryRect.width,
      readoutLeft: readoutRect.left,
      readoutBottom: readoutRect.bottom,
      projectionLeft: projectionRect.left,
      projectionRight: projectionRect.right,
      projectionBottom: projectionRect.bottom,
      headlineLeft: headlineRect.left,
      methodRight: methodRect.right,
      methodBottom: methodRect.bottom,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
    };
  });

  expect(geometry.slotPosition).toBe("fixed");
  expect(geometry.trajectoryWidth).toBeGreaterThanOrEqual(759);
  expect(geometry.trajectoryWidth).toBeLessThanOrEqual(760.5);
  expect(Math.abs(geometry.trajectoryCenterX - geometry.viewportWidth / 2)).toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.trajectoryCenterY - geometry.viewportHeight / 2)).toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.projectionLeft - geometry.trajectoryLeft)).toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.readoutLeft - geometry.trajectoryLeft)).toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.methodRight - geometry.trajectoryRight)).toBeLessThanOrEqual(1);
  expect(geometry.headlineLeft - geometry.projectionRight).toBeGreaterThanOrEqual(16);

  const readoutFloorGap = geometry.viewportHeight - geometry.readoutBottom;
  const projectionFloorGap = geometry.viewportHeight - geometry.projectionBottom;
  const methodFloorGap = geometry.viewportHeight - geometry.methodBottom;
  expect(readoutFloorGap).toBeGreaterThanOrEqual(29);
  expect(readoutFloorGap).toBeLessThanOrEqual(49);
  expect(Math.abs(projectionFloorGap - readoutFloorGap)).toBeLessThanOrEqual(1);
  expect(Math.abs(methodFloorGap - readoutFloorGap)).toBeLessThanOrEqual(1);
});

test("aligns Strategy primary object with Coordination and Semantic", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installTrajectoryProgress(page);
  await openAnalysis(page);
  const analysis = page.locator("#analysis-v2");

  const measure = async (slotSelector: string, objectSelector: string) => analysis.evaluate(
    (host, selectors) => {
      const slot = host.querySelector<HTMLElement>(selectors.slot)!;
      const object = host.querySelector<HTMLElement>(selectors.object)!;
      const slotRect = slot.getBoundingClientRect();
      const rect = object.getBoundingClientRect();
      return {
        slotPosition: getComputedStyle(slot).position,
        left: rect.left,
        width: rect.width,
        centerX: rect.left + rect.width / 2,
        centerY: slotRect.top + slotRect.height / 2,
      };
    },
    { slot: slotSelector, object: objectSelector },
  );

  const coordination = await measure(
    ".analysis-v2-speed-primary .analysis-v2-primary-object-slot",
    ".analysis-v2-speed-board",
  );

  await analysis.locator('[data-tab="semantic"]').click();
  const semantic = await measure(
    ".analysis-v2-semantic-primary .analysis-v2-primary-object-slot",
    ".analysis-v2-semantic-primary .analysis-v2-keyboard",
  );

  await analysis.locator('[data-tab="strategy"]').click();
  const strategy = await measure(
    ".analysis-v2-strategy-stage .analysis-v2-primary-object-slot",
    ".analysis-v2-strategy-trajectory",
  );

  for (const frame of [coordination, semantic, strategy]) {
    expect(frame.slotPosition).toBe("fixed");
    expect(frame.width).toBeGreaterThanOrEqual(759);
    expect(frame.width).toBeLessThanOrEqual(760.5);
  }

  for (const comparison of [semantic, strategy]) {
    expect(Math.abs(comparison.left - coordination.left)).toBeLessThanOrEqual(1);
    expect(Math.abs(comparison.width - coordination.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(comparison.centerX - coordination.centerX)).toBeLessThanOrEqual(1);
    expect(Math.abs(comparison.centerY - coordination.centerY)).toBeLessThanOrEqual(1);
  }
});

test("keeps two- and three-part Strategy trajectories on one fixed frame", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installTrajectoryProgress(page);
  await openAnalysis(page);
  const analysis = page.locator("#analysis-v2");
  await analysis.locator('[data-tab="strategy"]').click();

  const trajectory = analysis.locator(".analysis-v2-strategy-trajectory");
  const projection = analysis.locator(".analysis-v2-strategy-projection");
  await expect(trajectory).toHaveAttribute("data-body-size", "3");
  await expect(trajectory.locator(".analysis-v2-strategy-trajectory-path")).toHaveCount(10);
  await expect(trajectory).toContainText("聲母");
  await expect(trajectory).toContainText("介音");
  await expect(trajectory).toContainText("韻母");
  await expect(projection.locator("tbody tr")).toHaveCount(3);
  await expect(projection.locator("tbody td")).toHaveCount(9);
  await expect(analysis.locator(".analysis-v2-strategy-readout")).toContainText("換序輸入");

  const threePart = await trajectory.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const paths = [...node.querySelectorAll<SVGPathElement>(".analysis-v2-strategy-trajectory-path")];
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      oldestOpacity: Number.parseFloat(getComputedStyle(paths[0]!).strokeOpacity),
      newestOpacity: Number.parseFloat(getComputedStyle(paths.at(-1)!).strokeOpacity),
    };
  });

  await analysis.locator('[data-action="strategy-size"][data-value="2"]').click();
  await expect(trajectory).toHaveAttribute("data-body-size", "2");
  await expect(trajectory.locator(".analysis-v2-strategy-trajectory-path")).toHaveCount(10);
  await expect(trajectory).toContainText("前位");
  await expect(trajectory).toContainText("後位");
  await expect(trajectory).not.toContainText("聲母");
  await expect(projection.locator("tbody tr")).toHaveCount(2);
  await expect(projection.locator("tbody td")).toHaveCount(4);
  await expect(analysis.locator(".analysis-v2-strategy-readout")).toContainText("換序輸入");
  await expect(analysis.locator(".analysis-v2-strategy-readout")).not.toContainText("位置偏移");
  await expect(analysis.locator(".analysis-v2-strategy-readout")).toContainText("20%");

  const twoPart = await trajectory.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    const paths = [...node.querySelectorAll<SVGPathElement>(".analysis-v2-strategy-trajectory-path")];
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
      oldestOpacity: Number.parseFloat(getComputedStyle(paths[0]!).strokeOpacity),
      newestOpacity: Number.parseFloat(getComputedStyle(paths.at(-1)!).strokeOpacity),
    };
  });

  expect(Math.abs(twoPart.left - threePart.left)).toBeLessThanOrEqual(1);
  expect(Math.abs(twoPart.top - threePart.top)).toBeLessThanOrEqual(1);
  expect(Math.abs(twoPart.width - threePart.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(twoPart.height - threePart.height)).toBeLessThanOrEqual(1);
  expect(threePart.newestOpacity).toBeGreaterThan(threePart.oldestOpacity);
  expect(twoPart.newestOpacity).toBeGreaterThan(twoPart.oldestOpacity);

  const overflow = await analysis.evaluate((host) => {
    const main = host.querySelector<HTMLElement>(".analysis-v2-main")!;
    return main.scrollWidth - main.clientWidth;
  });
  expect(overflow).toBeLessThanOrEqual(1);
});