import { expect, test, type Page } from "@playwright/test";

async function openSemantic(page: Page): Promise<void> {
  await page.goto("/");
  await page.locator("#open-information").click();
  await page.locator(".analysis-v2-open").click();
  const analysis = page.locator("#analysis-v2");
  await expect(analysis).toBeVisible();
  await page.waitForTimeout(340);
  await analysis.locator('[data-tab="semantic"]').click();
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 1064, height: 665 },
  { width: 912, height: 720 },
  { width: 800, height: 700 },
]) {
  test(`keeps selected-key evidence calm and collision-free at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await openSemantic(page);
    const analysis = page.locator("#analysis-v2");

    const before = await analysis.evaluate((host) => {
      const main = host.querySelector<HTMLElement>(".analysis-v2-main")!;
      const keyboard = host.querySelector<HTMLElement>(".analysis-v2-keyboard")!;
      const rail = host.querySelector<HTMLElement>(".analysis-v2-semantic-rail")!;
      const method = host.querySelector<HTMLElement>(".analysis-v2-method")!;
      const keyboardRect = keyboard.getBoundingClientRect();
      return {
        scrollHeight: main.scrollHeight,
        keyboardTop: keyboardRect.top,
        keyboardBottom: keyboardRect.bottom,
        keyboardLeft: keyboardRect.left,
        railTop: rail.getBoundingClientRect().top,
        methodTop: method.getBoundingClientRect().top,
      };
    });

    await analysis.locator('[data-action="select-key"]').first().click();
    const inspector = analysis.locator(".analysis-v2-semantic-stage > .analysis-v2-inspector");
    await expect(inspector).toBeVisible();

    // Stress the long evidence copy from the production screenshot and provide
    // deterministic trend markup even when the local test learner has no history.
    await inspector.evaluate((inspectorNode) => {
      const values = inspectorNode.querySelectorAll<HTMLElement>("dd");
      if (values[0] !== undefined) values[0].textContent = "35%";
      if (values[1] !== undefined) values[1].textContent = "可比較 · 43 次";
      if (values[2] !== undefined) values[2].textContent = "276 ms · 可比較 · 28 個乾淨樣本";

      const content = inspectorNode.querySelector<HTMLElement>(".analysis-v2-inspector-content");
      if (content === null || content.querySelector(".analysis-v2-trends") !== null) return;
      const trends = document.createElement("section");
      trends.className = "analysis-v2-trends";
      const addTrend = (label: string, value: string, pathData: string): void => {
        const chart = document.createElement("div");
        chart.className = "analysis-v2-trend-chart";
        chart.innerHTML = `<div class="analysis-v2-trend-heading"><span>${label}</span><strong>${value}</strong></div>
          <svg viewBox="0 0 168 40" preserveAspectRatio="none" aria-hidden="true">
            <line x1="4" y1="36" x2="164" y2="36"></line>
            <path d="${pathData}"></path>
            <circle cx="164" cy="25" r="2.5"></circle>
          </svg>`;
        trends.append(chart);
      };
      addTrend("近期錯誤觀察", "25%", "M4,14 L84,18 L164,25");
      addTrend("近期鍵間時間", "184 ms", "M4,13 L84,17 L164,25");
      content.append(trends);
    });

    const after = await analysis.evaluate((host) => {
      const main = host.querySelector<HTMLElement>(".analysis-v2-main")!;
      const keyboard = host.querySelector<HTMLElement>(".analysis-v2-keyboard")!;
      const rail = host.querySelector<HTMLElement>(".analysis-v2-semantic-rail")!;
      const method = host.querySelector<HTMLElement>(".analysis-v2-method")!;
      const inspectorNode = host.querySelector<HTMLElement>(".analysis-v2-semantic-stage > .analysis-v2-inspector")!;
      const content = inspectorNode.querySelector<HTMLElement>(".analysis-v2-inspector-content")!;
      const heading = inspectorNode.querySelector<HTMLElement>(".analysis-v2-detail-heading strong")!;
      const metrics = [...content.querySelectorAll<HTMLElement>("dl > div")];
      const charts = [...content.querySelectorAll<HTMLElement>(".analysis-v2-trend-chart")];
      const svg = content.querySelector<SVGSVGElement>(".analysis-v2-trend-chart svg")!;
      const baseline = svg.querySelector<SVGLineElement>("line")!;
      const endpoint = svg.querySelector<SVGCircleElement>("circle")!;
      const endpointStyle = getComputedStyle(endpoint);
      const keyboardRect = keyboard.getBoundingClientRect();
      const railRect = rail.getBoundingClientRect();
      const inspectorRect = inspectorNode.getBoundingClientRect();
      const metricRects = metrics.map((node) => node.getBoundingClientRect());
      const chartRects = charts.map((node) => node.getBoundingClientRect());
      const overflowGroups = [
        ...content.querySelectorAll<HTMLElement>("dl, .analysis-v2-trends, dl > div, .analysis-v2-trend-chart"),
      ];
      return {
        scrollHeight: main.scrollHeight,
        keyboardTop: keyboardRect.top,
        keyboardBottom: keyboardRect.bottom,
        keyboardLeft: keyboardRect.left,
        railTop: railRect.top,
        railVisibility: getComputedStyle(rail).visibility,
        methodTop: method.getBoundingClientRect().top,
        inspectorTop: inspectorRect.top,
        inspectorBottom: inspectorRect.bottom,
        headingSize: Number.parseFloat(getComputedStyle(heading).fontSize),
        contentOverflow: content.scrollWidth - content.clientWidth,
        overflowGroupCount: overflowGroups.filter((node) => node.scrollWidth - node.clientWidth > 1).length,
        trendColumnCount: getComputedStyle(content.querySelector<HTMLElement>(".analysis-v2-trends")!)
          .gridTemplateColumns.split(" ").length,
        firstTrendOffset: Math.abs((chartRects[0]?.left ?? 0) - (metricRects[0]?.left ?? 0)),
        timingTrendOffset: Math.abs((chartRects[1]?.left ?? 0) - (metricRects[2]?.left ?? 0)),
        firstTrendWidthDelta: Math.abs((chartRects[0]?.width ?? 0) - (metricRects[0]?.width ?? 0)),
        timingTrendWidthDelta: Math.abs((chartRects[1]?.width ?? 0) - (metricRects[2]?.width ?? 0)),
        trendSvgHeight: svg.getBoundingClientRect().height,
        baselineDisplay: getComputedStyle(baseline).display,
        endpointFill: endpointStyle.fill,
        endpointStrokeWidth: endpointStyle.strokeWidth,
        endpointVectorEffect: endpointStyle.vectorEffect,
        endpointRadius: endpointStyle.getPropertyValue("r"),
      };
    });

    expect(Math.abs(after.keyboardTop - before.keyboardTop)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.keyboardLeft - before.keyboardLeft)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.railTop - before.railTop)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.methodTop - before.methodTop)).toBeLessThanOrEqual(1);
    expect(Math.abs(after.scrollHeight - before.scrollHeight)).toBeLessThanOrEqual(1);
    expect(after.railVisibility).toBe("visible");
    expect(after.inspectorTop).toBeGreaterThanOrEqual(before.keyboardBottom + 1);
    expect(after.inspectorBottom).toBeLessThanOrEqual(before.railTop + 1);
    expect(after.headingSize).toBeLessThanOrEqual(24.5);
    expect(after.contentOverflow).toBeLessThanOrEqual(1);
    expect(after.overflowGroupCount).toBe(0);
    expect(after.trendColumnCount).toBe(3);
    expect(after.firstTrendOffset).toBeLessThanOrEqual(1);
    expect(after.timingTrendOffset).toBeLessThanOrEqual(1);
    expect(after.firstTrendWidthDelta).toBeLessThanOrEqual(1);
    expect(after.timingTrendWidthDelta).toBeLessThanOrEqual(1);
    expect(after.trendSvgHeight).toBeLessThanOrEqual(24.5);
    expect(after.baselineDisplay).toBe("none");
    expect(after.endpointFill).toBe("none");
    expect(after.endpointStrokeWidth).toBe("4px");
    expect(after.endpointVectorEffect).toBe("non-scaling-stroke");
    expect(after.endpointRadius).toBe("0.01px");
  });
}
