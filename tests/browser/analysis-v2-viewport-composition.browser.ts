import { expect, test, type Page } from "@playwright/test";

async function openAnalysis(page: Page): Promise<void> {
  await page.goto("/");
  await page.locator("#open-information").click();
  await page.locator(".analysis-v2-open").click();
  await expect(page.locator("#analysis-v2")).toBeVisible();
  await page.waitForTimeout(340);
}

async function semanticSelectionGeometry(page: Page, height: number): Promise<{
  gap: number;
  slotPosition: string;
  inspectorPosition: string;
  inspectorHeight: number;
}> {
  await page.setViewportSize({ width: 1440, height });
  await openAnalysis(page);
  const analysis = page.locator("#analysis-v2");
  await analysis.locator('[data-tab="semantic"]').click();
  await analysis.locator('[data-action="select-key"]').first().click();

  const inspector = analysis.locator(
    ".analysis-v2-semantic-stage.has-selection > .analysis-v2-inspector",
  );
  await inspector.evaluate((inspectorNode) => {
    const content = inspectorNode.querySelector<HTMLElement>(".analysis-v2-inspector-content");
    if (content === null || content.querySelector(".analysis-v2-trends") !== null) return;
    const trends = document.createElement("section");
    trends.className = "analysis-v2-trends";
    trends.innerHTML = `
      <div class="analysis-v2-trend-chart">
        <div class="analysis-v2-trend-heading"><span>近期錯誤觀察</span><strong>25%</strong></div>
        <svg viewBox="0 0 168 40" preserveAspectRatio="none" aria-hidden="true">
          <line x1="4" y1="36" x2="164" y2="36"></line>
          <path d="M4,14 L84,18 L164,25"></path>
          <circle cx="164" cy="25" r="2.5"></circle>
        </svg>
      </div>
      <div class="analysis-v2-trend-chart">
        <div class="analysis-v2-trend-heading"><span>近期鍵間時間</span><strong>184 ms</strong></div>
        <svg viewBox="0 0 168 40" preserveAspectRatio="none" aria-hidden="true">
          <line x1="4" y1="36" x2="164" y2="36"></line>
          <path d="M4,13 L84,17 L164,25"></path>
          <circle cx="164" cy="25" r="2.5"></circle>
        </svg>
      </div>`;
    content.append(trends);
  });

  return analysis.evaluate((host) => {
    const board = host.querySelector<HTMLElement>(".analysis-v2-keyboard")!;
    const inspectorNode = host.querySelector<HTMLElement>(
      ".analysis-v2-semantic-stage.has-selection > .analysis-v2-inspector",
    )!;
    const slot = host.querySelector<HTMLElement>(
      ".analysis-v2-semantic-primary .analysis-v2-primary-object-slot",
    )!;
    const boardRect = board.getBoundingClientRect();
    const inspectorRect = inspectorNode.getBoundingClientRect();
    return {
      gap: inspectorRect.top - boardRect.bottom,
      slotPosition: getComputedStyle(slot).position,
      inspectorPosition: getComputedStyle(inspectorNode).position,
      inspectorHeight: inspectorRect.height,
    };
  });
}

test("returns primary Analysis views and methodology to flow through the 700px compact-height boundary", async ({ page }) => {
  for (const height of [700, 670, 650, 621, 560, 480, 400]) {
    const semantic = await semanticSelectionGeometry(page, height);
    expect(semantic.slotPosition).toBe("static");
    expect(semantic.inspectorPosition).toBe("static");
    expect(semantic.inspectorHeight).toBeGreaterThanOrEqual(90);
    expect(semantic.gap).toBeGreaterThanOrEqual(0);
  }

  const fixedSemantic = await semanticSelectionGeometry(page, 701);
  expect(fixedSemantic.slotPosition).toBe("fixed");
  expect(fixedSemantic.inspectorPosition).toBe("fixed");
  expect(fixedSemantic.inspectorHeight).toBeGreaterThanOrEqual(90);
  expect(fixedSemantic.gap).toBeGreaterThanOrEqual(0);

  await page.setViewportSize({ width: 1440, height: 400 });
  await openAnalysis(page);
  const analysis = page.locator("#analysis-v2");
  const coordination = await analysis.evaluate((host) => {
    const main = host.querySelector<HTMLElement>(".analysis-v2-main")!;
    const board = host.querySelector<HTMLElement>(".analysis-v2-speed-board")!;
    const readout = host.querySelector<HTMLElement>(".analysis-v2-speed-readout")!;
    const method = host.querySelector<HTMLElement>(".analysis-v2-speed-field > .analysis-v2-method")!;
    const slot = host.querySelector<HTMLElement>(
      ".analysis-v2-speed-primary .analysis-v2-primary-object-slot",
    )!;
    const boardRect = board.getBoundingClientRect();
    const readoutRect = readout.getBoundingClientRect();
    const methodRect = method.getBoundingClientRect();
    if (getComputedStyle(slot).position !== "static") {
      throw new Error("short-height coordination composition did not return to flow");
    }
    return {
      readoutGap: readoutRect.top - boardRect.bottom,
      methodPosition: getComputedStyle(method).position,
      methodGap: methodRect.top - readoutRect.bottom,
      scrollable: main.scrollHeight > main.clientHeight,
    };
  });
  expect(coordination.readoutGap).toBeGreaterThanOrEqual(0);
  expect(coordination.methodPosition).toBe("static");
  expect(coordination.methodGap).toBeGreaterThanOrEqual(0);
  expect(coordination.scrollable).toBe(true);

  await analysis.locator('[data-tab="strategy"]').click();
  const strategy = await analysis.evaluate((host) => {
    const main = host.querySelector<HTMLElement>(".analysis-v2-main")!;
    const trajectory = host.querySelector<HTMLElement>(".analysis-v2-strategy-trajectory")!;
    const projection = host.querySelector<HTMLElement>(".analysis-v2-strategy-projection")!;
    const readout = host.querySelector<HTMLElement>(".analysis-v2-strategy-readout")!;
    const method = host.querySelector<HTMLElement>(".analysis-v2-strategy-domain > .analysis-v2-method")!;
    const slot = host.querySelector<HTMLElement>(
      ".analysis-v2-strategy-stage .analysis-v2-primary-object-slot",
    )!;
    const trajectoryRect = trajectory.getBoundingClientRect();
    const projectionRect = projection.getBoundingClientRect();
    const readoutRect = readout.getBoundingClientRect();
    const methodRect = method.getBoundingClientRect();
    return {
      slotPosition: getComputedStyle(slot).position,
      projectionPosition: getComputedStyle(projection).position,
      projectionGap: projectionRect.top - trajectoryRect.bottom,
      readoutGap: readoutRect.top - projectionRect.bottom,
      methodPosition: getComputedStyle(method).position,
      methodGap: methodRect.top - readoutRect.bottom,
      scrollable: main.scrollHeight > main.clientHeight,
    };
  });
  expect(strategy.slotPosition).toBe("static");
  expect(strategy.projectionPosition).toBe("static");
  expect(strategy.projectionGap).toBeGreaterThanOrEqual(0);
  expect(strategy.readoutGap).toBeGreaterThanOrEqual(0);
  expect(strategy.methodPosition).toBe("static");
  expect(strategy.methodGap).toBeGreaterThanOrEqual(0);
  expect(strategy.scrollable).toBe(true);
});

test("returns Movement methodology to flow in a short desktop viewport", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 400 });
  await openAnalysis(page);
  const analysis = page.locator("#analysis-v2");
  await analysis.locator('[data-action="coordination-view"][data-value="movement"]').click();

  const movement = await analysis.evaluate((host) => {
    const main = host.querySelector<HTMLElement>(".analysis-v2-main")!;
    const grid = host.querySelector<HTMLElement>(".analysis-v2-movement-grid")!;
    const method = host.querySelector<HTMLElement>(".analysis-v2-movement-view > .analysis-v2-method")!;
    const gridRect = grid.getBoundingClientRect();
    const methodRect = method.getBoundingClientRect();
    return {
      methodPosition: getComputedStyle(method).position,
      methodGap: methodRect.top - gridRect.bottom,
      scrollable: main.scrollHeight > main.clientHeight,
    };
  });

  expect(movement.methodPosition).toBe("static");
  expect(movement.methodGap).toBeGreaterThanOrEqual(0);
  expect(movement.scrollable).toBe(true);
});

test("uses the shared viewport-relative rail and reserves the methodology lane at 700px width", async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 900 });
  await openAnalysis(page);
  const analysis = page.locator("#analysis-v2");

  const geometry = await analysis.evaluate((host) => {
    const board = host.querySelector<HTMLElement>(".analysis-v2-speed-board")!;
    const copy = host.querySelector<HTMLElement>(".analysis-v2-speed-readout > span")!;
    const method = host.querySelector<HTMLElement>(".analysis-v2-speed-field > .analysis-v2-method")!;
    const range = document.createRange();
    range.selectNodeContents(copy);
    const textRect = range.getBoundingClientRect();
    const methodRect = method.getBoundingClientRect();
    return {
      boardWidth: board.offsetWidth,
      expectedWidth: window.innerWidth * 0.92,
      methodPosition: getComputedStyle(method).position,
      methodologyGap: methodRect.left - textRect.right,
    };
  });

  expect(Math.abs(geometry.boardWidth - geometry.expectedWidth)).toBeLessThanOrEqual(1);
  expect(geometry.methodPosition).toBe("fixed");
  expect(geometry.methodologyGap).toBeGreaterThanOrEqual(12);
});

test("keeps Movement data rules on the viewport floor without covering the final explanation", async ({ page }) => {
  await page.setViewportSize({ width: 1920, height: 1000 });
  await openAnalysis(page);
  const analysis = page.locator("#analysis-v2");
  await analysis.locator('[data-action="coordination-view"][data-value="movement"]').click();

  const floor = await analysis.evaluate((host) => {
    const view = host.querySelector<HTMLElement>(".analysis-v2-movement-view")!;
    const method = host.querySelector<HTMLElement>(".analysis-v2-movement-view > .analysis-v2-method")!;
    const summary = method.querySelector<HTMLElement>("summary")!;
    const finalNote = host.querySelector<HTMLElement>(".analysis-v2-movement-family:last-child > p")!;
    const viewRect = view.getBoundingClientRect();
    const methodRect = method.getBoundingClientRect();
    const summaryRect = summary.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(finalNote);
    const textRects = [...range.getClientRects()];
    const collisionCount = textRects.filter((rect) => (
      rect.right > summaryRect.left
      && rect.left < summaryRect.right
      && rect.bottom > summaryRect.top
      && rect.top < summaryRect.bottom
    )).length;
    return {
      position: getComputedStyle(method).position,
      bottomGap: window.innerHeight - methodRect.bottom,
      visibleBottom: methodRect.bottom <= window.innerHeight,
      movementRightDelta: Math.abs(viewRect.right - methodRect.right),
      collisionCount,
    };
  });

  expect(floor.position).toBe("fixed");
  expect(floor.visibleBottom).toBe(true);
  expect(floor.bottomGap).toBeGreaterThanOrEqual(29);
  expect(floor.bottomGap).toBeLessThanOrEqual(49);
  expect(floor.movementRightDelta).toBeLessThanOrEqual(1);
  expect(floor.collisionCount).toBe(0);
});
