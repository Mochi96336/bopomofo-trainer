// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { mountAnalysisV2MovementLineArt } from "../../src/app/analysis-v2-movement-line-art.js";
import type { MovementFamilyId } from "../../src/app/analysis-v2-panel.js";

interface ExpectedFamily {
  readonly id: MovementFamilyId;
  readonly title: string;
  readonly label: string;
  readonly svgSignature: string;
}

function family(id: MovementFamilyId, title: string): string {
  return `<section class="analysis-v2-movement-family" data-movement-family="${id}">
    <header><strong>${title}</strong></header>
    <div class="analysis-v2-movement-diagram" aria-hidden="true"></div>
  </section>`;
}

describe("Analysis V2 Movement line art", () => {
  it("binds exact diagrams by stable family identity despite reordered families and changed copy", () => {
    const expected: readonly ExpectedFamily[] = [
      {
        id: "tone-commit",
        title: "聲調收尾（測試文案）",
        label: "完成字內注音後按下聲調鍵示意",
        svgSignature: "analysis-v2-arrow-tone-commit",
      },
      {
        id: "hand-switch",
        title: "左右手切換（測試文案）",
        label: "鍵盤左右手切換示意",
        svgSignature: "analysis-v2-arrow-hand-switch",
      },
      {
        id: "word-structure",
        title: "字內組成（測試文案）",
        label: "聲母、介音、韻母的字內結構示意",
        svgSignature: "例：家 · ㄐ ㄧ ㄚ",
      },
      {
        id: "same-side-revisit",
        title: "同側返回（測試文案）",
        label: "同側回返示意：離開一側後經另一側回到原側",
        svgSignature: "analysis-v2-arrow-revisit-return",
      },
    ];
    const host = document.createElement("div");
    host.innerHTML = `<div class="analysis-v2-movement-grid">
      ${expected.map((row) => family(row.id, row.title)).join("")}
    </div>`;

    const unmount = mountAnalysisV2MovementLineArt(host);

    for (const row of expected) {
      const familyNode = host.querySelector<HTMLElement>(
        `[data-movement-family="${row.id}"]`,
      );
      expect(familyNode?.querySelector("header strong")?.textContent).toBe(row.title);
      const diagram = familyNode?.querySelector<HTMLElement>(".analysis-v2-movement-diagram");
      expect(diagram?.getAttribute("aria-label")).toBe(row.label);
      expect(diagram?.getAttribute("role")).toBe("img");
      expect(diagram?.hasAttribute("aria-hidden")).toBe(false);
      const svg = diagram?.querySelector("svg");
      expect(svg).not.toBeNull();
      expect(svg?.getAttribute("aria-hidden")).toBe("true");
      expect(svg?.getAttribute("focusable")).toBe("false");
      expect(diagram?.innerHTML).toContain(row.svgSignature);
    }

    unmount();
  });
});
