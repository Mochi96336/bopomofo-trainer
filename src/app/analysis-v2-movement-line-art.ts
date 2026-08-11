import type { MovementFamilyId } from "./analysis-v2-panel.js";

interface MovementLineArt {
  readonly label: string;
  readonly markup: string;
}

const svgOpen = '<svg width="260" height="78" viewBox="0 0 260 78" aria-hidden="true" focusable="false" style="display:block;max-width:82%;height:auto;font-family:inherit;overflow:visible">';
const svgClose = "</svg>";

function arrowMarker(id: string, size = 7): string {
  return `
    <defs>
      <marker id="${id}" viewBox="0 0 7 7" refX="6.2" refY="3.5" markerWidth="${size}" markerHeight="${size}" markerUnits="userSpaceOnUse" orient="auto">
        <path d="M1 1.8L6.2 3.5L1 5.2" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round"/>
      </marker>
    </defs>`;
}

function keyCluster(x: number, label: string): string {
  return `
    <g transform="translate(${x} 22)" fill="none" stroke="currentColor" stroke-width="1">
      <g opacity=".28">
        <rect x="0" y="0" width="12" height="10" rx="2"/>
        <rect x="16" y="0" width="12" height="10" rx="2"/>
        <rect x="32" y="0" width="12" height="10" rx="2"/>
        <rect x="5" y="14" width="12" height="10" rx="2"/>
        <rect x="21" y="14" width="12" height="10" rx="2"/>
        <rect x="37" y="14" width="12" height="10" rx="2"/>
      </g>
      <text x="24.5" y="40" fill="currentColor" stroke="none" text-anchor="middle" font-size="9" opacity=".56">${label}</text>
    </g>`;
}

const handSwitchMarker = "analysis-v2-arrow-hand-switch";
const handSwitch = `${svgOpen}
  ${arrowMarker(handSwitchMarker)}
  ${keyCluster(37, "左")}
  ${keyCluster(174, "右")}
  <path d="M130 15V57" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="2 4" opacity=".16"/>
  <circle cx="76" cy="36" r="2.8" fill="currentColor" opacity=".66"/>
  <circle cx="184" cy="36" r="2.8" fill="currentColor" opacity=".66"/>
  <path d="M79 34C106 24 153 24 181 34" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" marker-end="url(#${handSwitchMarker})" opacity=".82"/>
${svgClose}`;

const revisitReturnMarker = "analysis-v2-arrow-revisit-return";
const sameSideRevisit = `${svgOpen}
  ${arrowMarker(revisitReturnMarker, 6.2)}
  ${keyCluster(37, "同側")}
  ${keyCluster(174, "另一側")}
  <path d="M130 15V57" fill="none" stroke="currentColor" stroke-width="1" stroke-dasharray="2 4" opacity=".14"/>

  <!-- One return pattern only: leave the side, cross over, then land back on it. -->
  <circle cx="48" cy="35" r="2.5" fill="currentColor" opacity=".48"/>
  <circle cx="201" cy="35" r="2.5" fill="currentColor" opacity=".44"/>
  <circle cx="85" cy="43" r="2.6" fill="currentColor" opacity=".72"/>
  <path d="M50.5 34.5C93 28 158 28 198.5 34.5" fill="none" stroke="currentColor" stroke-width="1.25" stroke-linecap="round" stroke-dasharray="4 3" opacity=".38"/>
  <path d="M198.5 37C166 53 121 55 88 44C87 43.6 86 43 85 43" fill="none" stroke="currentColor" stroke-width="1.45" stroke-linecap="round" marker-end="url(#${revisitReturnMarker})" opacity=".68"/>
${svgClose}`;

const wordStructure = `${svgOpen}
  <path d="M72 39H188" fill="none" stroke="currentColor" stroke-width="1" opacity=".20"/>
  <g fill="var(--panel, transparent)" stroke="currentColor" stroke-width="1.05" opacity=".62">
    <circle cx="72" cy="39" r="12"/>
    <circle cx="130" cy="39" r="12"/>
    <circle cx="188" cy="39" r="12"/>
  </g>
  <g fill="currentColor" stroke="none" text-anchor="middle">
    <g font-size="9" opacity=".56">
      <text x="72" y="16">聲母</text>
      <text x="130" y="16">介音</text>
      <text x="188" y="16">韻母</text>
    </g>
    <g font-size="15" opacity=".84">
      <text x="72" y="44">ㄐ</text>
      <text x="130" y="44">ㄧ</text>
      <text x="188" y="44">ㄚ</text>
    </g>
    <text x="130" y="70" font-size="9" opacity=".46">例：家 · ㄐ ㄧ ㄚ</text>
  </g>
${svgClose}`;

const toneMarker = "analysis-v2-arrow-tone-commit";
const toneCommit = `${svgOpen}
  ${arrowMarker(toneMarker)}
  <g fill="var(--panel, transparent)" stroke="currentColor" stroke-width="1" opacity=".48">
    <circle cx="52" cy="38" r="10"/>
    <circle cx="86" cy="38" r="10"/>
    <circle cx="120" cy="38" r="10"/>
  </g>
  <path d="M62 38H76M96 38H110" fill="none" stroke="currentColor" stroke-width="1" opacity=".18"/>
  <g fill="currentColor" stroke="none" text-anchor="middle" font-size="14" opacity=".76">
    <text x="52" y="43">ㄐ</text>
    <text x="86" y="43">ㄧ</text>
    <text x="120" y="43">ㄚ</text>
  </g>
  <path d="M139 38H186" fill="none" stroke="currentColor" stroke-width="1.55" stroke-linecap="round" marker-end="url(#${toneMarker})" opacity=".76"/>
  <rect x="199" y="22" width="34" height="32" rx="7" fill="none" stroke="currentColor" stroke-width="1.2" opacity=".78"/>
  <text x="216" y="44" fill="currentColor" stroke="none" text-anchor="middle" font-size="15" opacity=".90">ˇ</text>
  <g fill="currentColor" stroke="none" text-anchor="middle" font-size="9" opacity=".50">
    <text x="86" y="69">字內注音</text>
    <text x="216" y="69">聲調</text>
  </g>
${svgClose}`;

const lineArtByFamily: Readonly<Record<MovementFamilyId, MovementLineArt>> = {
  "hand-switch": { label: "鍵盤左右手切換示意", markup: handSwitch },
  "same-side-revisit": { label: "同側回返示意：離開一側後經另一側回到原側", markup: sameSideRevisit },
  "word-structure": { label: "聲母、介音、韻母的字內結構示意", markup: wordStructure },
  "tone-commit": { label: "完成字內注音後按下聲調鍵示意", markup: toneCommit },
};

function isMovementFamilyId(value: string | undefined): value is MovementFamilyId {
  return value === "hand-switch"
    || value === "same-side-revisit"
    || value === "word-structure"
    || value === "tone-commit";
}

function applyMovementLineArt(host: HTMLElement): void {
  const families = host.querySelectorAll<HTMLElement>(".analysis-v2-movement-family");
  families.forEach((family) => {
    const familyId = family.dataset.movementFamily;
    if (!isMovementFamilyId(familyId)) return;
    const diagram = family.querySelector<HTMLElement>(".analysis-v2-movement-diagram");
    if (diagram === null || diagram.dataset.lineArt === "true") return;
    const art = lineArtByFamily[familyId];
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
