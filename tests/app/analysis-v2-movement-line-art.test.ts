// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { mountAnalysisV2MovementLineArt } from "../../src/app/analysis-v2-movement-line-art.js";

function family(title: string): string {
  return `<section class="analysis-v2-movement-family">
    <header><strong>${title}</strong></header>
    <div class="analysis-v2-movement-diagram" aria-hidden="true"></div>
  </section>`;
}

describe("Analysis V2 Movement line art", () => {
  it("binds diagrams by family identity rather than DOM position", () => {
    const host = document.createElement("div");
    host.innerHTML = `<div class="analysis-v2-movement-grid">
      ${family("聲調收尾")}
      ${family("手別轉換")}
      ${family("字內結構")}
      ${family("同側回返")}
    </div>`;

    const unmount = mountAnalysisV2MovementLineArt(host);
    const families = [...host.querySelectorAll<HTMLElement>(".analysis-v2-movement-family")];
    const labels = Object.fromEntries(families.map((row) => [
      row.querySelector("header strong")?.textContent ?? "",
      row.querySelector(".analysis-v2-movement-diagram")?.getAttribute("aria-label"),
    ]));

    expect(labels).toEqual({
      聲調收尾: "完成字內注音後按下聲調鍵示意",
      手別轉換: "鍵盤左右手切換示意",
      字內結構: "聲母、介音、韻母的字內結構示意",
      同側回返: "同側回返示意：離開一側後經另一側回到原側",
    });
    expect(families.every((row) => row.querySelector("svg") !== null)).toBe(true);

    unmount();
  });
});
