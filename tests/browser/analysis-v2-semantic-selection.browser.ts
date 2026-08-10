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
]) {
  test(`reuses the Semantic readout slot while keeping the summary visible at ${viewport.width}x${viewport.height}`, async ({ page }) => {
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
        railBottom: rail.getBoundingClientRect().bottom,
        methodTop: method.getBoundingClientRect().top,
      };
    });

    await analysis.locator('[data-action="select-key"]').first().click();
    const inspector = analysis.locator(".analysis-v2-semantic-stage > .analysis-v2-inspector");
    await expect(inspector).toBeVisible();

    const after = await analysis.evaluate((host) => {
      const main = host.querySelector<HTMLElement>(".analysis-v2-main")!;
      const keyboard = host.querySelector<HTMLElement>(".analysis-v2-keyboard")!;
      const rail = host.querySelector<HTMLElement>(".analysis-v2-semantic-rail")!;
      const method = host.querySelector<HTMLElement>(".analysis-v2-method")!;
      const inspectorNode = host.querySelector<HTMLElement>(".analysis-v2-semantic-stage > .analysis-v2-inspector")!;
      const heading = inspectorNode.querySelector<HTMLElement>(".analysis-v2-detail-heading strong")!;
      const keyboardRect = keyboard.getBoundingClientRect();
      const railRect = rail.getBoundingClientRect();
      const inspectorRect = inspectorNode.getBoundingClientRect();
      return {
        scrollHeight: main.scrollHeight,
        keyboardTop: keyboardRect.top,
        keyboardBottom: keyboardRect.bottom,
        keyboardLeft: keyboardRect.left,
        railTop: railRect.top,
        railBottom: railRect.bottom,
        railVisibility: getComputedStyle(rail).visibility,
        methodTop: method.getBoundingClientRect().top,
        inspectorTop: inspectorRect.top,
        inspectorBottom: inspectorRect.bottom,
        headingSize: Number.parseFloat(getComputedStyle(heading).fontSize),
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
  });
}
