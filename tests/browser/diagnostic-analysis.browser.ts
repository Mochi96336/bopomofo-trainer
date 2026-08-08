import { expect, test } from "@playwright/test";

test("opens Analysis V2 without reviving the legacy transition network", async ({ page }) => {
  await page.goto("/");
  await page.locator("#open-information").click();
  await page.locator(".diagnostic-open-analysis").click();
  await expect(page.locator("#diagnostic-analysis")).toBeVisible();

  const tabs = page.locator('#diagnostic-analysis [role="tab"]');
  await expect(tabs).toHaveText(["語意", "協調", "策略"]);
  await expect(page.locator('[data-action="toggle-network"]')).toHaveCount(0);
  await expect(page.locator(".diagnostic-relationship-svg")).toHaveCount(0);

  await page.locator('[data-action="select-tab"][data-tab="coordination"]').click();
  await expect(page.locator("#analysis-v2-coordination-title")).toHaveText("動作協調");
  await expect(page.getByText("不是偵測實際使用的手")).toBeVisible();

  await page.locator('[data-action="select-tab"][data-tab="strategy"]').click();
  await expect(page.locator("#analysis-v2-strategy-title")).toHaveText("輸入策略");
  await expect(page.getByText(/canonical 位置只是注音結構的參考座標/)).toBeVisible();
  await expect(page.locator(".strategy-matrix")).toHaveCount(3);
});
