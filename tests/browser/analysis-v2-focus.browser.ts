import { expect, test, type Locator, type Page } from "@playwright/test";

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

test("keeps the Coordination family rail below the primary readout", async ({ page }) => {
  await page.setViewportSize({ width: 1064, height: 665 });
  await page.goto("/");
  await page.locator("#open-information").click();
  await page.locator(".analysis-v2-open").click();
  const analysis = page.locator("#analysis-v2");
  await expect(analysis).toBeVisible();
  await page.waitForTimeout(340);

  const geometry = await analysis.evaluate((host) => {
    const readout = host.querySelector<HTMLElement>(".analysis-v2-speed-readout")!;
    const rail = host.querySelector<HTMLElement>(".analysis-v2-evidence-rail")!;
    const readoutRect = readout.getBoundingClientRect();
    const railRect = rail.getBoundingClientRect();
    return {
      gap: railRect.top - readoutRect.bottom,
      railTop: railRect.top,
      viewportHeight: window.innerHeight,
    };
  });

  expect(geometry.gap).toBeGreaterThanOrEqual(28);
  expect(geometry.railTop).toBeGreaterThan(geometry.viewportHeight * 0.68);
});
