interface MovementLineArt {
  readonly label: string;
  readonly markup: string;
}

const svgOpen = '<svg width="260" height="78" viewBox="0 0 260 78" aria-hidden="true" focusable="false" style="max-width:82%;height:auto;font-family:inherit;overflow:visible">';
const svgClose = "</svg>";

const keyboard = `
  <g fill="none" stroke="currentColor" stroke-width="1" opacity=".38">
    <path d="M25 8h210l8 54H17z"/>
    <path d="M23 22h214M21 36h218M19 50h222"/>
    <path d="M45 8l-3 54M66 8l-2 54M87 8l-1 54M108 8v54M130 8v54M152 8l1 54M173 8l2 54M194 8l3 54M215 8l4 54"/>
    <path d="M130 7v56" stroke-dasharray="2 3" opacity=".65"/>
  </g>`;

const handSwitch = `${svgOpen}
  ${keyboard}
  <g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity=".88">
    <path d="M61 44C84 16 176 16 199 44"/>
    <path d="m191 37 8 7-10 3"/>
    <path d="M199 51C171 66 89 66 61 51" opacity=".55"/>
    <path d="m69 46-8 5 9 4" opacity=".55"/>
  </g>
  <g fill="currentColor" stroke="none" font-size="10" opacity=".72">
    <text x="49" y="19">左</text><text x="204" y="19">右</text>
  </g>
${svgClose}`;

const sameSideRevisit = `${svgOpen}
  ${keyboard}
  <g fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" opacity=".88">
    <path d="M57 43C61 16 103 15 108 42"/>
    <path d="m101 35 7 7-9 3"/>
    <path d="M59 51C91 34 168 34 199 50C166 67 92 67 61 53" stroke-dasharray="4 3" opacity=".48"/>
    <path d="m69 47-8 6 9 3" opacity=".48"/>
  </g>
  <g fill="currentColor" stroke="none" font-size="9" opacity=".68">
    <text x="47" y="19">同側</text><text x="196" y="19">另一側</text>
  </g>
${svgClose}`;

const wordStructure = `${svgOpen}
  <g fill="none" stroke="currentColor" stroke-width="1" opacity=".55">
    <path d="M78 45h28M154 45h28"/>
    <rect x="36" y="28" width="42" height="34" rx="5"/>
    <rect x="106" y="28" width="48" height="34" rx="5"/>
    <rect x="182" y="28" width="42" height="34" rx="5"/>
  </g>
  <g fill="currentColor" stroke="none" text-anchor="middle">
    <g font-size="9" opacity=".58"><text x="57" y="17">聲母</text><text x="130" y="17">介音</text><text x="203" y="17">韻母</text></g>
    <g font-size="16" opacity=".82"><text x="57" y="51">ㄐ</text><text x="130" y="51">ㄧ</text><text x="203" y="51">ㄚ</text></g>
  </g>
${svgClose}`;

const toneCommit = `${svgOpen}
  <g fill="none" stroke="currentColor" stroke-width="1" opacity=".55">
    <rect x="23" y="29" width="34" height="31" rx="4"/><rect x="61" y="29" width="34" height="31" rx="4"/><rect x="99" y="29" width="34" height="31" rx="4"/>
    <path d="M144 45h27M164 39l7 6-7 6"/>
    <rect x="184" y="25" width="54" height="39" rx="5"/>
  </g>
  <g fill="currentColor" stroke="none" text-anchor="middle">
    <g font-size="14" opacity=".76"><text x="40" y="50">ㄐ</text><text x="78" y="50">ㄧ</text><text x="116" y="50">ㄚ</text></g>
    <text x="211" y="48" font-size="12" letter-spacing="2" opacity=".84">ˊˇˋ˙</text>
    <g font-size="9" opacity=".55"><text x="78" y="18">字內注音</text><text x="211" y="18">聲調</text></g>
  </g>
${svgClose}`;

const lineArt: readonly MovementLineArt[] = [
  { label: "鍵盤左右手切換示意", markup: handSwitch },
  { label: "同側再出手與跨側返回示意", markup: sameSideRevisit },
  { label: "聲母、介音、韻母的字內結構示意", markup: wordStructure },
  { label: "完成字內注音後按下聲調鍵示意", markup: toneCommit },
];

function applyMovementLineArt(host: HTMLElement): void {
  const diagrams = host.querySelectorAll<HTMLElement>(
    ".analysis-v2-movement-grid .analysis-v2-movement-diagram",
  );
  diagrams.forEach((diagram, index) => {
    const art = lineArt[index];
    if (art === undefined || diagram.dataset.lineArt === "true") return;
    diagram.dataset.lineArt = "true";
    diagram.innerHTML = art.markup;
    diagram.removeAttribute("aria-hidden");
    diagram.setAttribute("role", "img");
    diagram.setAttribute("aria-label", art.label);
  });
}

export function mountAnalysisV2MovementLineArt(host: HTMLElement): () => void {
  applyMovementLineArt(host);
  const observer = new MutationObserver(() => applyMovementLineArt(host));
  observer.observe(host, { childList: true, subtree: true });
  return () => observer.disconnect();
}
