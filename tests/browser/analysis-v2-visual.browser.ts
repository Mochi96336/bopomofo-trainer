import { expect, test, type Page } from "@playwright/test";

async function openAnalysis(page: Page): Promise<void> {
  await page.goto("/");
  await page.locator("#open-information").click();
  await page.locator(".analysis-v2-open").click();
  await expect(page.locator("#analysis-v2")).toBeVisible();
}

test("keeps the Analysis surface keyboard-first instead of card-first", async ({ page }) => {
  await openAnalysis(page);

  const visual = await page.locator("#analysis-v2").evaluate((analysis) => {
    const tabs = analysis.querySelector<HTMLElement>(".analysis-v2-tabs")!;
    const keyboardWrap = analysis.querySelector<HTMLElement>(".analysis-v2-keyboard-wrap")!;
    const sideDetail = analysis.querySelector<HTMLElement>(".analysis-v2-side-detail")!;
    const emptyDetail = analysis.querySelector<HTMLElement>(".analysis-v2-selection-empty")!;
    const key = analysis.querySelector<HTMLElement>(".analysis-v2-key:not(.unmapped)")!;
    const tabStyle = getComputedStyle(tabs);
    const keyboardStyle = getComputedStyle(keyboardWrap);
    const sideStyle = getComputedStyle(sideDetail);
    const emptyStyle = getComputedStyle(emptyDetail);
    const keyStyle = getComputedStyle(key);
    return {
      tabsBorder: tabStyle.borderTopWidth,
      tabsRadius: tabStyle.borderTopLeftRadius,
      keyboardBorder: keyboardStyle.borderTopWidth,
      keyboardBackground: keyboardStyle.backgroundColor,
      sideDivider: sideStyle.borderLeftWidth,
      emptyBackground: emptyStyle.backgroundColor,
      keyRadius: keyStyle.borderTopLeftRadius,
    };
  });

  expect(visual.tabsBorder).toBe("0px");
  expect(visual.tabsRadius).toBe("0px");
  expect(visual.keyboardBorder).toBe("0px");
  expect(visual.keyboardBackground).toBe("rgba(0, 0, 0, 0)");
  expect(visual.sideDivider).not.toBe("0px");
  expect(visual.emptyBackground).toBe("rgba(0, 0, 0, 0)");
  expect(visual.keyRadius).not.toBe("8px");
});

test("stacks speed copy on phones and keeps the original line-on-keyboard visual language", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openAnalysis(page);
  await page.locator('[data-action="select-tab"][data-tab="coordination"]').click();

  const visual = await page.locator("#analysis-v2").evaluate((analysis) => {
    const titleLine = analysis.querySelector<HTMLElement>(".analysis-v2-speed-card .analysis-v2-card-title-line")!;
    const copy = titleLine.querySelector<HTMLElement>("div")!;
    const speedCard = analysis.querySelector<HTMLElement>(".analysis-v2-speed-card")!;
    const speedBoard = analysis.querySelector<HTMLElement>(".analysis-v2-speed-board")!;
    const speedKeyboard = analysis.querySelector<HTMLElement>(".analysis-v2-speed-keyboard")!;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
    line.setAttribute("class", "analysis-v2-speed-path");
    line.style.setProperty("--relation-width", "1.4");
    line.style.setProperty("--relation-opacity", "0.48");
    line.style.setProperty("--relation-slowness", "0");
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.append(line);
    analysis.append(svg);
    const lineStyle = getComputedStyle(line);
    const result = {
      titleDirection: getComputedStyle(titleLine).flexDirection,
      copyWidthRatio: copy.getBoundingClientRect().width / speedCard.getBoundingClientRect().width,
      cardBackground: getComputedStyle(speedCard).backgroundColor,
      boardBackground: getComputedStyle(speedBoard).backgroundColor,
      keyboardTransform: getComputedStyle(speedKeyboard).transform,
      lineStroke: lineStyle.stroke,
      lineOpacity: Number(lineStyle.strokeOpacity),
    };
    svg.remove();
    return result;
  });

  expect(visual.titleDirection).toBe("column");
  expect(visual.copyWidthRatio).toBeGreaterThan(0.8);
  expect(visual.cardBackground).toBe("rgba(0, 0, 0, 0)");
  expect(visual.boardBackground).toBe("rgba(0, 0, 0, 0)");
  expect(visual.keyboardTransform).not.toBe("none");
  expect(visual.lineStroke).not.toBe("none");
  expect(visual.lineOpacity).toBeGreaterThanOrEqual(0.48);
});
