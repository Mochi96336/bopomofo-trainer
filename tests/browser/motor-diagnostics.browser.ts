import { expect, test } from "@playwright/test";

test("shows observation-based motor diagnostics in the information panel", async ({ page }) => {
  await page.goto("/");
  await page.locator("#open-information").click();

  const section = page.locator(".motor-diagnostic-section");
  await expect(section).toBeVisible();
  await expect(section.getByRole("heading", { name: "動作協調" })).toBeVisible();
  await expect(section).toContainText("依實際按鍵順序量測");
  await expect(section).toContainText("左右手交接");
  await expect(section).toContainText("同手再出手");
  await expect(section).toContainText("聲調完成");
});

test("retires the old canonical transition diagnostics from every product navigation path", async ({ page }) => {
  await page.goto("/");
  await page.locator("#open-information").click();

  const semantic = page.locator(".diagnostic-summary-section");
  await expect(semantic.locator(".diagnostic-summary-signals > div")).toHaveCount(2);
  await expect(semantic).not.toContainText("轉換");

  await semantic.locator(".diagnostic-open-analysis").click();
  const analysis = page.locator("#diagnostic-analysis");
  const keyTab = page.locator("#diagnostic-analysis-tab-key");
  const confusionTab = page.locator("#diagnostic-analysis-tab-confusion");
  await expect(keyTab).toBeVisible();
  await expect(confusionTab).toBeVisible();
  await expect(page.locator("#diagnostic-analysis-tab-transition")).toHaveCount(0);
  await expect(analysis).not.toContainText("未計入時間");

  await keyTab.focus();
  await keyTab.press("ArrowRight");
  await expect(confusionTab).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#diagnostic-analysis-panel-transition")).toHaveCount(0);
  await expect(page.locator("#diagnostic-analysis-tab-transition")).toHaveCount(0);

  await confusionTab.press("ArrowLeft");
  await expect(keyTab).toHaveAttribute("aria-selected", "true");
  await expect(page.locator("#diagnostic-analysis-panel-transition")).toHaveCount(0);
});
