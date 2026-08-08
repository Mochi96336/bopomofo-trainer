import { expect, test } from "@playwright/test";

test("surfaces motor evidence through the integrated Analysis V2 summary", async ({ page }) => {
  await page.goto("/");
  await page.locator("#open-information").click();

  const summary = page.locator(".diagnostic-summary-section");
  await expect(summary).toBeVisible();
  await expect(summary.locator(".diagnostic-summary-signals > div")).toHaveCount(3);
  await expect(summary).toContainText("語意");
  await expect(summary).toContainText("協調");
  await expect(summary).toContainText("策略");
  await expect(page.locator(".motor-diagnostic-section")).toHaveCount(0);

  await summary.locator(".diagnostic-open-analysis").click();
  await page.locator('[data-action="select-tab"][data-tab="coordination"]').click();
  const coordination = page.locator("#analysis-v2-coordination-title").locator("..");
  await expect(coordination).toContainText("不同動作類型不以絕對毫秒互相比弱");
  await expect(page.getByText("標準指法手別轉換")).toBeVisible();
  await expect(page.getByText("同側鍵位再出手")).toBeVisible();
  await expect(page.getByText("聲調完成")).toBeVisible();
});

test("retires canonical transition diagnostics from every production navigation path", async ({ page }) => {
  await page.goto("/");
  await page.locator("#open-information").click();

  const summary = page.locator(".diagnostic-summary-section");
  await expect(summary.locator(".diagnostic-summary-signals > div")).toHaveCount(3);
  await expect(summary).not.toContainText("轉換總覽");

  await summary.locator(".diagnostic-open-analysis").click();
  const analysis = page.locator("#diagnostic-analysis");
  await expect(analysis.locator('[role="tab"]')).toHaveText(["語意", "協調", "策略"]);
  await expect(analysis.locator('[data-tab="transition"]')).toHaveCount(0);
  await expect(analysis.locator('[data-action="toggle-network"]')).toHaveCount(0);
  await expect(analysis.locator(".diagnostic-relationship-svg")).toHaveCount(0);

  const semanticTab = analysis.locator('[data-action="select-tab"][data-tab="semantic"]');
  const coordinationTab = analysis.locator('[data-action="select-tab"][data-tab="coordination"]');
  const strategyTab = analysis.locator('[data-action="select-tab"][data-tab="strategy"]');
  await semanticTab.focus();
  await semanticTab.press("ArrowRight");
  await expect(coordinationTab).toHaveAttribute("aria-selected", "true");
  await coordinationTab.press("ArrowRight");
  await expect(strategyTab).toHaveAttribute("aria-selected", "true");
  await strategyTab.press("ArrowRight");
  await expect(semanticTab).toHaveAttribute("aria-selected", "true");
});
