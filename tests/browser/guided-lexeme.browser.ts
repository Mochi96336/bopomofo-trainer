import { expect, test } from "@playwright/test";
import { tokenLabel } from "../../src/diagnostics/labels.js";
import { STANDARD_BOPOMOFO_LAYOUT } from "../../src/scheme/standard-layout.js";

const codeByToken = new Map(
  Object.entries(STANDARD_BOPOMOFO_LAYOUT.bindings)
    .map(([code, token]) => [tokenLabel(token), code]),
);

function pressCodeFor(label: string): string {
  const code = codeByToken.get(label.trim());
  if (!code) throw Error("unknown standard Zhuyin key: "+label);
  return code;
}

test("independent guided typing lane opens all 131 source-pinned reading identities", async ({page})=>{
  await page.goto("/");
  const countBefore=await page.locator("#progress-count").textContent();
  const storedBefore=await page.evaluate(()=>localStorage.getItem("bopomofo-trainer.progress.v4"));
  await page.locator("#open-guided-lexeme-drill").click();
  const dialog=page.locator("#guided-lexeme-dialog");
  await expect(dialog).toHaveJSProperty("open",true);
  await expect(page.locator("#guided-lexeme-choice option")).toHaveCount(131);
  await page.locator("#guided-lexeme-choice").selectOption("word:看:ㄎㄢ1");
  await expect(page.locator("#guided-lexeme-word")).toHaveText("看");

  const labels=await page.locator("#guided-lexeme-sounds .guided-lexeme-token").allTextContents();
  expect(labels.length).toBeGreaterThan(1);
  for(const label of labels)await page.keyboard.press(pressCodeFor(label));
  await expect(page.locator("#guided-lexeme-feedback")).toContainText("已完成");
  await expect(page.locator("#guided-lexeme-progress"))
    .toHaveText(labels.length+" / "+labels.length+" 個注音按鍵");

  // No original sentence press, progress history, or learner stats were altered.
  expect(await page.locator("#progress-count").textContent()).toBe(countBefore);
  expect(await page.evaluate(()=>localStorage.getItem("bopomofo-trainer.progress.v4")))
    .toBe(storedBefore);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveJSProperty("open",false);
  await expect(page.locator("#keyboard-capture")).toBeFocused();
});

test("isolated guided typing practice is operable on the narrowest viewport", async ({page})=>{
  await page.setViewportSize({width:320,height:640});
  await page.goto("/");
  await page.locator("#open-guided-lexeme-drill").click();
  await expect(page.locator("#guided-lexeme-word")).toBeVisible();
  const dimensions=await page.evaluate(()=>({
    viewport:document.documentElement.clientWidth,
    document:document.documentElement.scrollWidth,
    dialog:document.querySelector("#guided-lexeme-dialog")?.getBoundingClientRect().width??0,
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
  expect(dimensions.dialog).toBeLessThan(dimensions.viewport);
});
