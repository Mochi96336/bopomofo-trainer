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

test("pairs the desktop Strategy projection with the shared lower-left rail", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.locator("#open-information").click();
  await page.locator(".analysis-v2-open").click();

  const analysis = page.locator("#analysis-v2");
  await analysis.locator('[data-tab="strategy"]').click();

  const readout = analysis.locator(".analysis-v2-strategy-readout");
  const projection = analysis.locator(".analysis-v2-strategy-projection");
  await expect(readout).toBeVisible();
  await expect(projection).toBeVisible();

  const layout = await analysis.evaluate((host) => {
    const stage = host.querySelector<HTMLElement>(".analysis-v2-strategy-stage")!;
    const object = host.querySelector<HTMLElement>(".analysis-v2-strategy-object")!;
    const readout = host.querySelector<HTMLElement>(".analysis-v2-strategy-readout")!;
    const headline = readout.querySelector<HTMLElement>("strong")!;
    const projection = host.querySelector<HTMLElement>(".analysis-v2-strategy-projection")!;
    const stageRect = stage.getBoundingClientRect();
    const objectRect = object.getBoundingClientRect();
    const readoutRect = readout.getBoundingClientRect();
    const headlineRect = headline.getBoundingClientRect();
    const projectionRect = projection.getBoundingClientRect();
    const readoutStyle = getComputedStyle(readout);

    return {
      alignSelf: readoutStyle.alignSelf,
      justifyItems: readoutStyle.justifyItems,
      textAlign: readoutStyle.textAlign,
      stageBottom: stageRect.bottom,
      readoutLeft: readoutRect.left,
      readoutTop: readoutRect.top,
      readoutBottom: readoutRect.bottom,
      objectLeft: objectRect.left,
      headlineLeft: headlineRect.left,
      projectionLeft: projectionRect.left,
      projectionRight: projectionRect.right,
      projectionTop: projectionRect.top,
      projectionBottom: projectionRect.bottom,
    };
  });

  expect(layout.alignSelf).toBe("end");
  expect(layout.justifyItems).toBe("start");
  expect(layout.textAlign).toBe("left");
  expect(Math.abs(layout.stageBottom - layout.readoutBottom)).toBeLessThanOrEqual(1);
  expect(Math.abs(layout.stageBottom - layout.projectionBottom)).toBeLessThanOrEqual(1);
  expect(Math.abs(layout.projectionLeft - layout.readoutLeft)).toBeLessThanOrEqual(1);
  expect(Math.abs(layout.objectLeft - layout.readoutLeft)).toBeLessThanOrEqual(1);
  expect(layout.headlineLeft - layout.projectionRight).toBeGreaterThanOrEqual(16);
  expect(Math.min(layout.readoutBottom, layout.projectionBottom)
    - Math.max(layout.readoutTop, layout.projectionTop)).toBeGreaterThan(40);
});

test("aligns Strategy object frame with Coordination and Semantic while extending to the workspace floor", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installTrajectoryProgress(page);
  await page.goto("/");
  await page.locator("#open-information").click();
  await page.locator(".analysis-v2-open").click();
  const analysis = page.locator("#analysis-v2");

  const measureFrame = async (
    stageSelector: string,
    objectSelector: string,
    readoutSelector: string,
  ) => analysis.evaluate((host, selectors) => {
    const stage = host.querySelector<HTMLElement>(selectors.stage)!;
    const slot = stage.querySelector<HTMLElement>(".analysis-v2-primary-object-slot")!;
    const object = host.querySelector<HTMLElement>(selectors.object)!;
    const readout = host.querySelector<HTMLElement>(selectors.readout)!;
    const stageRect = stage.getBoundingClientRect();
    const slotRect = slot.getBoundingClientRect();
    const readoutRect = readout.getBoundingClientRect();
    return {
      stageHeight: stageRect.height,
      slotHeight: slotRect.height,
      objectWidth: object.offsetWidth,
      readoutWidth: readout.offsetWidth,
      readoutLeft: readoutRect.left,
    };
  }, { stage: stageSelector, object: objectSelector, readout: readoutSelector });

  const coordination = await measureFrame(
    ".analysis-v2-speed-primary",
    ".analysis-v2-speed-board",
    ".analysis-v2-speed-readout",
  );

  await analysis.locator('[data-tab="semantic"]').click();
  const semantic = await measureFrame(
    ".analysis-v2-semantic-primary",
    ".analysis-v2-semantic-primary .analysis-v2-keyboard",
    ".analysis-v2-semantic-readout",
  );

  await analysis.locator('[data-tab="strategy"]').click();
  const strategy = await measureFrame(
    ".analysis-v2-strategy-stage",
    ".analysis-v2-strategy-trajectory-object",
    ".analysis-v2-strategy-readout",
  );

  for (const frame of [coordination, semantic, strategy]) {
    expect(frame.objectWidth).toBeGreaterThanOrEqual(759);
    expect(frame.objectWidth).toBeLessThanOrEqual(760.5);
  }

  expect(Math.abs(semantic.stageHeight - coordination.stageHeight)).toBeLessThanOrEqual(1);
  expect(strategy.stageHeight).toBeGreaterThanOrEqual(coordination.stageHeight);

  for (const comparison of [semantic, strategy]) {
    expect(Math.abs(comparison.slotHeight - coordination.slotHeight)).toBeLessThanOrEqual(1);
    expect(Math.abs(comparison.objectWidth - coordination.objectWidth)).toBeLessThanOrEqual(1);
    expect(Math.abs(comparison.readoutWidth - coordination.readoutWidth)).toBeLessThanOrEqual(1);
    expect(Math.abs(comparison.readoutLeft - coordination.readoutLeft)).toBeLessThanOrEqual(1);
  }
});

test("uses one fixed Strategy frame for two- and three-part real-millisecond trajectories", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await installTrajectoryProgress(page);
  await page.goto("/");
  await page.locator("#open-information").click();
  await page.locator(".analysis-v2-open").click();
  const analysis = page.locator("#analysis-v2");
  await analysis.locator('[data-tab="strategy"]').click();

  const trajectory = analysis.locator(".analysis-v2-strategy-trajectory");
  const projection = analysis.locator(".analysis-v2-strategy-projection");
  await expect(trajectory).toHaveAttribute("data-body-size", "3");
  await expect(trajectory.locator(".analysis-v2-strategy-trajectory-path")).toHaveCount(10);
  await expect(trajectory).toContainText("聲母");
  await expect(trajectory).toContainText("介音");
  await expect(trajectory).toContainText("韻母");
  await expect(trajectory).toContainText("ms");
  await expect(projection).toContainText("位置投影");
  await expect(projection.locator("tbody tr")).toHaveCount(3);
  await expect(projection.locator("tbody td")).toHaveCount(9);
  await expect(analysis.locator(".strategy-matrix")).toHaveCount(0);
  await expect(analysis.locator(".strategy-order-table")).toHaveCount(0);
  await expect(analysis.locator(".analysis-v2-strategy-readout")).toContainText("換序輸入");

  const threePartGeometry = await analysis.evaluate((host) => {
    const stage = host.querySelector<HTMLElement>(".analysis-v2-strategy-stage")!;
    const object = host.querySelector<HTMLElement>(".analysis-v2-strategy-trajectory-object")!;
    const svg = host.querySelector<SVGSVGElement>(".analysis-v2-strategy-trajectory svg")!;
    const projectionNode = host.querySelector<HTMLElement>(".analysis-v2-strategy-projection")!;
    const headline = host.querySelector<HTMLElement>(".analysis-v2-strategy-readout strong")!;
    const paths = [...host.querySelectorAll<SVGPathElement>(".analysis-v2-strategy-trajectory-path")];
    const stageRect = stage.getBoundingClientRect();
    const objectRect = object.getBoundingClientRect();
    const svgRect = svg.getBoundingClientRect();
    const projectionRect = projectionNode.getBoundingClientRect();
    const headlineRect = headline.getBoundingClientRect();
    return {
      object: { left: objectRect.left, top: objectRect.top, width: objectRect.width, height: objectRect.height },
      svgLeft: svgRect.left,
      svgRight: svgRect.right,
      projectionBelowObject: projectionRect.top >= objectRect.bottom - 1,
      projectionLeftOfReadout: projectionRect.right <= headlineRect.left - 16,
      projectionBottomDelta: Math.abs(stageRect.bottom - projectionRect.bottom),
      oldestOpacity: Number.parseFloat(getComputedStyle(paths[0]!).strokeOpacity),
      newestOpacity: Number.parseFloat(getComputedStyle(paths.at(-1)!).strokeOpacity),
      mainClientWidth: host.querySelector<HTMLElement>(".analysis-v2-main")!.clientWidth,
      mainScrollWidth: host.querySelector<HTMLElement>(".analysis-v2-main")!.scrollWidth,
    };
  });
  expect(threePartGeometry.object.width).toBeGreaterThanOrEqual(759);
  expect(threePartGeometry.object.width).toBeLessThanOrEqual(760.5);
  expect(threePartGeometry.svgLeft).toBeGreaterThanOrEqual(threePartGeometry.object.left - 1);
  expect(threePartGeometry.svgRight).toBeLessThanOrEqual(
    threePartGeometry.object.left + threePartGeometry.object.width + 1,
  );
  expect(threePartGeometry.projectionBelowObject).toBe(true);
  expect(threePartGeometry.projectionLeftOfReadout).toBe(true);
  expect(threePartGeometry.projectionBottomDelta).toBeLessThanOrEqual(1);
  expect(threePartGeometry.newestOpacity).toBeGreaterThan(threePartGeometry.oldestOpacity);
  expect(threePartGeometry.mainScrollWidth).toBeLessThanOrEqual(threePartGeometry.mainClientWidth + 1);

  await analysis.locator('[data-action="strategy-size"][data-value="2"]').click();
  await expect(trajectory).toHaveAttribute("data-body-size", "2");
  await expect(trajectory.locator(".analysis-v2-strategy-trajectory-path")).toHaveCount(10);
  await expect(trajectory).toContainText("前位");
  await expect(trajectory).toContainText("後位");
  await expect(trajectory).not.toContainText("聲母");
  await expect(projection).toContainText("位置投影");
  await expect(projection.locator("tbody tr")).toHaveCount(2);
  await expect(projection.locator("tbody td")).toHaveCount(4);
  await expect(analysis.locator(".strategy-matrix")).toHaveCount(0);
  await expect(analysis.locator(".analysis-v2-strategy-readout")).toContainText("位置偏移");
  await expect(analysis.locator(".analysis-v2-strategy-readout")).toContainText("20%");

  const twoPartGeometry = await analysis.evaluate((host) => {
    const object = host.querySelector<HTMLElement>(".analysis-v2-strategy-trajectory-object")!;
    const paths = [...host.querySelectorAll<SVGPathElement>(".analysis-v2-strategy-trajectory-path")];
    const objectRect = object.getBoundingClientRect();
    return {
      object: { left: objectRect.left, top: objectRect.top, width: objectRect.width, height: objectRect.height },
      oldestOpacity: Number.parseFloat(getComputedStyle(paths[0]!).strokeOpacity),
      newestOpacity: Number.parseFloat(getComputedStyle(paths.at(-1)!).strokeOpacity),
      mainClientWidth: host.querySelector<HTMLElement>(".analysis-v2-main")!.clientWidth,
      mainScrollWidth: host.querySelector<HTMLElement>(".analysis-v2-main")!.scrollWidth,
    };
  });

  expect(Math.abs(twoPartGeometry.object.left - threePartGeometry.object.left)).toBeLessThanOrEqual(1);
  expect(Math.abs(twoPartGeometry.object.top - threePartGeometry.object.top)).toBeLessThanOrEqual(1);
  expect(Math.abs(twoPartGeometry.object.width - threePartGeometry.object.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(twoPartGeometry.object.height - threePartGeometry.object.height)).toBeLessThanOrEqual(1);
  expect(twoPartGeometry.newestOpacity).toBeGreaterThan(twoPartGeometry.oldestOpacity);
  expect(twoPartGeometry.mainScrollWidth).toBeLessThanOrEqual(twoPartGeometry.mainClientWidth + 1);
});