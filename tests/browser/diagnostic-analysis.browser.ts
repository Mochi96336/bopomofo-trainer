import { expect, test } from "@playwright/test";

/**
 * The analysis view assembled the way the page assembles it.
 *
 * The relationship overlay is unit-tested as a function of its arguments, and
 * the panel that supplies those arguments is type-checked against them. What
 * neither covers is the join: that the panel actually calls back on every render
 * and that the overlay finds the markup in place when it does. Before the view
 * model, that join was a subtree `MutationObserver` guessing at re-renders --
 * the arrangement whose failure mode was the graph quietly not appearing, with
 * nothing red to say so. This is the check that would say so.
 */

test("draws the relationship mesh over the analysis keyboard, and takes it away again", async ({ page }) => {
  await page.goto("/");
  await page.locator("#open-information").click();
  await page.locator(".diagnostic-open-analysis").click();
  await expect(page.locator("#diagnostic-analysis")).toBeVisible();

  // The mesh is on by default and needs no practice history: a transition
  // nobody has made yet is still one the layout makes possible.
  const toggle = page.locator('[data-action="toggle-network"]');
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".diagnostic-relationship-svg.network")).toHaveCount(1);
  expect(await page.locator(".diagnostic-relationship-path.network").count())
    .toBeGreaterThan(0);

  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "false");
  await expect(page.locator(".diagnostic-relationship-svg.network")).toHaveCount(0);

  await toggle.click();
  await expect(page.locator(".diagnostic-relationship-svg.network")).toHaveCount(1);
});
