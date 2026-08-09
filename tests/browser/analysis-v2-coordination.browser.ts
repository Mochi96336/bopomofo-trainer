import { expect, test } from "@playwright/test";

test("surfaces motor evidence through Coordination paths and Movement views", async ({ page }) => {
  await page.goto("/");
  await page.locator("#open-information").click();

  const summary = page.locator(".analysis-v2-summary");
  await expect(summary).toBeVisible();
  await expect(summary.locator(".analysis-v2-summary-heading h3")).toHaveText("分析");
  await expect(summary.locator(".analysis-v2-summary-signals > div")).toHaveCount(3);
  await expect(summary).toContainText("語意");
  await expect(summary).toContainText("協調");
  await expect(summary).toContainText("策略");
  await expect(page.locator(".motor-diagnostic-section")).toHaveCount(0);

  await summary.locator(".analysis-v2-open").click();

  const analysis = page.locator("#analysis-v2");
  await expect(analysis.locator("#analysis-v2-title")).toHaveText("分析");
  await expect(analysis.locator('[data-tab="coordination"]')).toHaveAttribute("aria-selected", "true");
  await expect(analysis.locator('[data-action="coordination-view"]')).toHaveText(["鍵間", "動作"]);
  await expect(page.locator(".analysis-v2-speed-field")).toBeVisible();
  await expect(page.locator(".analysis-v2-speed-board")).toBeVisible();
  await expect(page.locator(".analysis-v2-speed-svg marker")).toHaveCount(0);
  await expect(analysis.locator(".analysis-v2-movement-view")).toHaveCount(0);

  await analysis.locator('[data-action="coordination-view"][data-value="movement"]').click();
  const movement = analysis.locator(".analysis-v2-movement-view");
  await expect(movement).toBeVisible();
  await expect(movement.locator(".analysis-v2-movement-family")).toHaveCount(4);
  await expect(movement).toContainText("手別轉換");
  await expect(movement).toContainText("同側再出手");
  await expect(movement).toContainText("字內結構");
  await expect(movement).toContainText("聲調收尾");
  await expect(movement.locator(".analysis-v2-word-structure")).toContainText("聲母");
  await expect(movement.locator(".analysis-v2-word-structure")).toContainText("介音");
  await expect(movement.locator(".analysis-v2-word-structure")).toContainText("韻母");
  await expect(movement.locator("table")).toHaveCount(0);
  await expect(analysis.locator(".analysis-v2-speed-board")).toHaveCount(0);
});

test("retires canonical transition diagnostics from every production navigation path", async ({ page }) => {
  await page.goto("/");
  await page.locator("#open-information").click();

  const summary = page.locator(".analysis-v2-summary");
  await expect(summary.locator(".analysis-v2-summary-signals > div")).toHaveCount(3);
  await expect(summary).not.toContainText("轉換總覽");

  await summary.locator(".analysis-v2-open").click();
  const analysis = page.locator("#analysis-v2");
  await expect(analysis.locator('[role="tab"]')).toHaveText(["協調", "語意", "策略"]);
  await expect(analysis.locator('[data-tab="coordination"]')).toHaveAttribute("aria-selected", "true");
  await expect(analysis.locator('[data-tab="transition"]')).toHaveCount(0);
  await expect(analysis.locator('[data-action="toggle-network"]')).toHaveCount(0);
  await expect(analysis.locator(".diagnostic-relationship-svg")).toHaveCount(0);

  const coordinationTab = analysis.locator('[data-action="select-tab"][data-tab="coordination"]');
  const semanticTab = analysis.locator('[data-action="select-tab"][data-tab="semantic"]');
  const strategyTab = analysis.locator('[data-action="select-tab"][data-tab="strategy"]');
  await coordinationTab.focus();
  await coordinationTab.press("ArrowRight");
  await expect(semanticTab).toHaveAttribute("aria-selected", "true");
  await semanticTab.press("ArrowRight");
  await expect(strategyTab).toHaveAttribute("aria-selected", "true");
  await strategyTab.press("ArrowRight");
  await expect(coordinationTab).toHaveAttribute("aria-selected", "true");
});
