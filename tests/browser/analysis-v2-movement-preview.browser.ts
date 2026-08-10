import { expect, test } from "@playwright/test";

test("captures the refined movement diagram preview", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await page.locator("#open-information").click();
  await page.locator(".analysis-v2-open").click();

  const analysis = page.locator("#analysis-v2");
  await expect(analysis).toBeVisible();
  await analysis.locator('[data-action="coordination-view"][data-value="movement"]').click();

  const movement = analysis.locator(".analysis-v2-movement-view");
  await expect(movement).toBeVisible();
  await expect(movement.locator(".analysis-v2-movement-diagram svg")).toHaveCount(4);
  await movement.screenshot({
    path: "test-results/analysis-v2-movement-preview.png",
    animations: "disabled",
  });
});
