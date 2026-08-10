import { expect, test, type Page } from "@playwright/test";

async function openAnalysis(page: Page): Promise<void> {
  await page.goto("/");
  await page.locator("#open-information").click();
  await page.locator(".analysis-v2-open").click();
  await expect(page.locator("#analysis-v2")).toBeVisible();
  await page.waitForTimeout(340);
}

function expectedBoardWidth(width: number, height: number): number {
  const preferred = Math.min(width * 0.42, height * 0.60);
  const bounded = Math.max(760, Math.min(1080, preferred));
  return Math.min(width * 0.92, bounded);
}

function expectedKeyHeight(width: number, height: number): number {
  return Math.max(23, Math.min(48, Math.min(width * 0.037, height * 0.032)));
}

test("scales Coordination and Semantic together only when width and height both have room", async ({ page }) => {
  for (const viewport of [
    { width: 700, height: 900 },
    { width: 1440, height: 900 },
    { width: 1920, height: 1080 },
    { width: 1920, height: 1440 },
    { width: 2560, height: 1440 },
    { width: 3840, height: 900 },
    { width: 3840, height: 2160 },
  ]) {
    await page.setViewportSize(viewport);
    await openAnalysis(page);
    const analysis = page.locator("#analysis-v2");

    const coordination = await analysis.evaluate((host) => {
      const board = host.querySelector<HTMLElement>(".analysis-v2-speed-board")!;
      const key = host.querySelector<HTMLElement>(".analysis-v2-speed-board .analysis-v2-key")!;
      return {
        width: board.getBoundingClientRect().width,
        keyHeight: key.getBoundingClientRect().height,
      };
    });

    await analysis.locator('[data-tab="semantic"]').click();
    const semantic = await analysis.evaluate((host) => {
      const keyboard = host.querySelector<HTMLElement>(
        ".analysis-v2-semantic-primary .analysis-v2-keyboard",
      )!;
      const slot = host.querySelector<HTMLElement>(
        ".analysis-v2-semantic-primary .analysis-v2-primary-object-slot",
      )!;
      const key = keyboard.querySelector<HTMLElement>(".analysis-v2-key")!;
      return {
        keyboardWidth: keyboard.getBoundingClientRect().width,
        slotWidth: slot.getBoundingClientRect().width,
        keyHeight: key.getBoundingClientRect().height,
      };
    });

    const expectedWidth = expectedBoardWidth(viewport.width, viewport.height);
    const expectedHeight = expectedKeyHeight(viewport.width, viewport.height);
    expect(Math.abs(coordination.width - expectedWidth)).toBeLessThanOrEqual(1);
    expect(Math.abs(semantic.slotWidth - expectedWidth)).toBeLessThanOrEqual(1);
    expect(Math.abs(semantic.keyboardWidth - coordination.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(coordination.keyHeight - expectedHeight)).toBeLessThanOrEqual(1);
    expect(Math.abs(semantic.keyHeight - coordination.keyHeight)).toBeLessThanOrEqual(1);
  }
});

test("keeps enlarged high-resolution keyboards clear of fixed evidence and methodology", async ({ page }) => {
  for (const viewport of [
    { width: 1920, height: 1440 },
    { width: 2560, height: 1440 },
    { width: 3840, height: 2160 },
  ]) {
    await page.setViewportSize(viewport);
    await openAnalysis(page);
    const analysis = page.locator("#analysis-v2");

    const coordination = await analysis.evaluate((host) => {
      const board = host.querySelector<HTMLElement>(".analysis-v2-speed-board")!;
      const readout = host.querySelector<HTMLElement>(".analysis-v2-speed-readout")!;
      const method = host.querySelector<HTMLElement>(".analysis-v2-speed-field > .analysis-v2-method")!;
      const boardRect = board.getBoundingClientRect();
      const readoutRect = readout.getBoundingClientRect();
      const methodRect = method.getBoundingClientRect();
      return {
        boardReadoutGap: readoutRect.top - boardRect.bottom,
        methodReadoutGap: methodRect.left - readoutRect.right,
        methodRight: methodRect.right,
        readoutRight: readoutRect.right,
      };
    });
    expect(coordination.boardReadoutGap).toBeGreaterThanOrEqual(12);
    expect(Math.abs(coordination.methodRight - coordination.readoutRight)).toBeLessThanOrEqual(1);

    await analysis.locator('[data-tab="semantic"]').click();
    await analysis.locator('[data-action="select-key"]').first().click();
    const semantic = await analysis.evaluate((host) => {
      const board = host.querySelector<HTMLElement>(
        ".analysis-v2-semantic-primary .analysis-v2-keyboard",
      )!;
      const inspector = host.querySelector<HTMLElement>(
        ".analysis-v2-semantic-stage.has-selection > .analysis-v2-inspector",
      )!;
      const rail = host.querySelector<HTMLElement>(".analysis-v2-semantic-rail")!;
      const method = host.querySelector<HTMLElement>(".analysis-v2-semantic-domain > .analysis-v2-method")!;
      const boardRect = board.getBoundingClientRect();
      const inspectorRect = inspector.getBoundingClientRect();
      const railRect = rail.getBoundingClientRect();
      const methodRect = method.getBoundingClientRect();
      return {
        boardInspectorGap: inspectorRect.top - boardRect.bottom,
        inspectorRailGap: railRect.top - inspectorRect.bottom,
        methodRightDelta: Math.abs(methodRect.right - railRect.right),
        viewportOverflow: Math.max(0, boardRect.right - innerWidth, -boardRect.left),
      };
    });
    expect(semantic.boardInspectorGap).toBeGreaterThanOrEqual(12);
    expect(semantic.inspectorRailGap).toBeGreaterThanOrEqual(-1);
    expect(semantic.methodRightDelta).toBeLessThanOrEqual(1);
    expect(semantic.viewportOverflow).toBeLessThanOrEqual(1);
  }
});

test("keeps the fixed desktop composition collision-free immediately above the 700px fallback", async ({ page }) => {
  for (const height of [701, 720, 744]) {
    await page.setViewportSize({ width: 1440, height });
    await openAnalysis(page);
    const analysis = page.locator("#analysis-v2");

    const coordination = await analysis.evaluate((host) => {
      const slot = host.querySelector<HTMLElement>(
        ".analysis-v2-speed-primary .analysis-v2-primary-object-slot",
      )!;
      const board = host.querySelector<HTMLElement>(".analysis-v2-speed-board")!;
      const readout = host.querySelector<HTMLElement>(".analysis-v2-speed-readout")!;
      return {
        slotPosition: getComputedStyle(slot).position,
        readoutGap: readout.getBoundingClientRect().top - board.getBoundingClientRect().bottom,
      };
    });

    expect(coordination.slotPosition).toBe("fixed");
    expect(coordination.readoutGap).toBeGreaterThanOrEqual(-1);

    await analysis.locator('[data-tab="semantic"]').click();
    await analysis.locator('[data-action="select-key"]').first().click();

    const semantic = await analysis.evaluate((host) => {
      const slot = host.querySelector<HTMLElement>(
        ".analysis-v2-semantic-primary .analysis-v2-primary-object-slot",
      )!;
      const board = host.querySelector<HTMLElement>(
        ".analysis-v2-semantic-primary .analysis-v2-keyboard",
      )!;
      const inspector = host.querySelector<HTMLElement>(
        ".analysis-v2-semantic-stage.has-selection > .analysis-v2-inspector",
      )!;
      const rail = host.querySelector<HTMLElement>(".analysis-v2-semantic-rail")!;
      const boardRect = board.getBoundingClientRect();
      const inspectorRect = inspector.getBoundingClientRect();
      const railRect = rail.getBoundingClientRect();
      return {
        slotPosition: getComputedStyle(slot).position,
        inspectorGap: inspectorRect.top - boardRect.bottom,
        railGap: railRect.top - inspectorRect.bottom,
      };
    });

    expect(semantic.slotPosition).toBe("fixed");
    expect(semantic.inspectorGap).toBeGreaterThanOrEqual(-1);
    expect(semantic.railGap).toBeGreaterThanOrEqual(-1);
  }
});
