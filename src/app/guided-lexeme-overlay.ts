import "./guided-lexeme-overlay.css";
import { PRACTICE_CATALOG } from "./generated/catalog.js";
import { keyboardEventToInput } from "./keyboard-adapter.js";
import { tokenLabel } from "../diagnostics/labels.js";
import type { CatalogEntry, Exercise } from "../core/model.js";
import {
  applyInteractionInputV2,
  createInteractionSessionV2,
  type InteractionSessionStateV2,
} from "../practice/interaction-session-v2.js";
import { tokenState } from "./practice-session-view.js";
import { STANDARD_BOPOMOFO_LAYOUT } from "../scheme/standard-layout.js";
import { VERIFIED_GUIDED_LEXEME_ENTRY_IDS } from "../readings/verified-guided-lexeme-target-ids.js";

/**
 * Opt-in and measurement-isolated phonetic key practice.
 *
 * There is no sentence generation and no semantic reading assignment.
 * Each target is an exact catalog (text, reading) verified against both
 * pinned September 2026 MOE archives by the CI roster reconciliation step.
 * Some targets are rare/archaic; they are not being taught as ordinary modern
 * readings for the same surface text.
 *
 * The guided drill deliberately does not modify the sentence product state,
 * learner measures, curriculum history, or local storage.
 */
export function mountGuidedLexemeOverlay(
  options: { readonly focusSentencePractice: () => void },
): { readonly destroy: () => void } {
  const entriesById = new Map(PRACTICE_CATALOG.map(e => [e.id, e]));
  const ids = [...VERIFIED_GUIDED_LEXEME_ENTRY_IDS];
  if (ids.length !== 131 || new Set(ids).size !== ids.length
    || ids.some(id => !entriesById.has(id))) {
    throw new Error("guided lexeme roster was not compiled against the active catalog");
  }
  const targets = ids.map(id => entriesById.get(id)!);
  const actions = document.querySelector<HTMLElement>(".topbar-actions");
  if (actions === null) throw new Error("missing practice topbar actions");

  const scope = new AbortController();
  const trigger = document.createElement("button");
  trigger.type = "button";
  trigger.id = "open-guided-lexeme-drill";
  trigger.className = "guided-lexeme-entry";
  trigger.textContent = "字音練習";
  trigger.setAttribute("aria-haspopup", "dialog");
  trigger.setAttribute("aria-controls", "guided-lexeme-dialog");
  actions.prepend(trigger);

  const dialog = document.createElement("dialog");
  dialog.id = "guided-lexeme-dialog";
  dialog.className = "guided-lexeme-dialog";
  dialog.setAttribute("aria-labelledby", "guided-lexeme-title");
  dialog.innerHTML = [
    '<section class="guided-lexeme-shell">',
    '  <header class="guided-lexeme-header">',
    '    <div><h2 id="guided-lexeme-title">字音鍵位練習</h2>',
    '    <p>指定讀音的單一完整詞條，不用句子猜音。</p></div>',
    '    <button id="guided-lexeme-close" class="guided-lexeme-text-button" type="button" aria-label="返回句子練習">關閉</button>',
    '  </header>',
    '  <p class="guided-lexeme-note">依教育部雙來源收錄的字音練習鍵位，包含部分罕用及歷史讀音。這不是詞義或自然句子的讀音判斷；練習不會修改原本的學習紀錄。</p>',
    '  <div class="guided-lexeme-controls">',
    '    <label for="guided-lexeme-choice">選擇詞條與讀音</label>',
    '    <select id="guided-lexeme-choice" aria-label="選擇詞條與指定注音"></select>',
    '    <span id="guided-lexeme-position" aria-live="polite"></span>',
    '  </div>',
    '  <div class="guided-lexeme-target">',
    '    <strong id="guided-lexeme-word"></strong>',
    '    <div id="guided-lexeme-sounds" aria-label="指定的完整注音"></div>',
    '  </div>',
    '  <p id="guided-lexeme-progress" class="guided-lexeme-progress" aria-live="polite"></p>',
    '  <p id="guided-lexeme-feedback" class="guided-lexeme-feedback" role="status" aria-live="polite"></p>',
    '  <div class="guided-lexeme-actions">',
    '    <button id="guided-lexeme-previous" type="button">上一個</button>',
    '    <button id="guided-lexeme-next" type="button">下一個</button>',
    '  </div>',
    '</section>',
  ].join("");
  document.body.append(dialog);

  const choose = dialog.querySelector<HTMLSelectElement>("#guided-lexeme-choice")!;
  const word = dialog.querySelector<HTMLElement>("#guided-lexeme-word")!;
  const sounds = dialog.querySelector<HTMLElement>("#guided-lexeme-sounds")!;
  const position = dialog.querySelector<HTMLElement>("#guided-lexeme-position")!;
  const progress = dialog.querySelector<HTMLElement>("#guided-lexeme-progress")!;
  const feedback = dialog.querySelector<HTMLElement>("#guided-lexeme-feedback")!;
  const previous = dialog.querySelector<HTMLButtonElement>("#guided-lexeme-previous")!;
  const next = dialog.querySelector<HTMLButtonElement>("#guided-lexeme-next")!;

  function syllableReading(entry: CatalogEntry): string {
    return entry.syllables.map(s=>s.tokens.map(tokenLabel).join("")).join(" ");
  }
  for(const entry of targets) {
    const option = document.createElement("option");
    option.value = entry.id;
    option.textContent = entry.prompt.text+" · "+syllableReading(entry);
    choose.append(option);
  }

  let index = 0;
  let session: InteractionSessionStateV2;

  function exercise(entry: CatalogEntry): Exercise {
    return {id:"guided-lexeme:"+entry.id,mode:"guided",
      layoutId:STANDARD_BOPOMOFO_LAYOUT.id,entries:[entry]};
  }
  function begin(indexToUse: number): void {
    if(!Number.isInteger(indexToUse) || indexToUse<0 || indexToUse>=targets.length)
      throw new Error("invalid approved phonetic practice target");
    index = indexToUse;
    const target = targets[index]!;
    choose.value = target.id;
    session = createInteractionSessionV2(exercise(target), performance.now());
    render();
  }
  function render(): void {
    const target = targets[index]!;
    word.textContent = target.prompt.text;
    position.textContent = (index+1)+" / "+targets.length;
    previous.disabled = index===0;
    next.disabled = index===targets.length-1;
    sounds.replaceChildren();
    let ordinal = 0;
    target.syllables.forEach(syllable=>{
      const block = document.createElement("span");
      block.className = "guided-lexeme-syllable";
      syllable.tokens.forEach((token,canonicalIndex)=>{
        const state = tokenState(session,ordinal,canonicalIndex);
        const el = document.createElement("span");
        el.textContent=tokenLabel(token);
        el.className="guided-lexeme-token "+state;
        if(state==="pending"||state==="commit-ready")
          el.setAttribute("aria-current","true");
        block.append(el);
      });
      sounds.append(block);
      ordinal++;
    });
    progress.textContent=session.completedCount+" / "+session.plan.totalSlots+" 個注音按鍵";
    if(session.completed) {
      feedback.textContent="已完成這個指定讀音。可以選擇下一個詞條。";
      feedback.dataset.state="success";
    } else {
      const last=session.traces.at(-1);
      feedback.textContent=last!==undefined && !last.accepted && !(
        last.outcome==="ignored-modifier" || last.outcome==="ignored-repeat" ||
        last.outcome==="composition"
      ) ? "按鍵與指定注音不符；請依顯示的注音繼續。" : "直接按標準注音鍵盤；完成音節後再按聲調。";
      feedback.dataset.state=last!==undefined && !last.accepted ? "attention" : "neutral";
    }
  }
  function close(): void {
    if(dialog.open)dialog.close();
  }
  function onKeydown(event: KeyboardEvent): void {
    if(!dialog.open)return;
    // Prevent the main sentence app from consuming a target's physical key.
    // Do not interfere with tab navigation and native select interactions.
    if(event.code==="Tab") {
      event.stopImmediatePropagation();
      return;
    }
    if(event.code==="Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
      return;
    }
    const focused=document.activeElement;
    if(focused===choose) {
      event.stopImmediatePropagation();
      return;
    }
    // Buttons remain operable by click/tab. Their Enter/Space action must not
    // count as a Bopomofo typing attempt.
    if(focused instanceof HTMLButtonElement && (event.code==="Enter"||event.code==="Space")) {
      event.stopImmediatePropagation();
      return;
    }
    event.stopImmediatePropagation();
    if(event.code==="Space")event.preventDefault();
    if(session.completed)return;
    const input=keyboardEventToInput(event,STANDARD_BOPOMOFO_LAYOUT,
      performance.now(),event.isComposing);
    if(input.composing || input.modifierOnly || input.repeat)return;
    session=applyInteractionInputV2(session,input);
    render();
  }

  trigger.addEventListener("click",()=>{
    begin(index);
    dialog.showModal();
    next.focus();
  },{signal:scope.signal});
  dialog.querySelector<HTMLButtonElement>("#guided-lexeme-close")!
    .addEventListener("click",close,{signal:scope.signal});
  previous.addEventListener("click",()=>begin(index-1),{signal:scope.signal});
  next.addEventListener("click",()=>begin(index+1),{signal:scope.signal});
  choose.addEventListener("change",()=>{
    const selected=ids.indexOf(choose.value);
    if(selected<0)throw new Error("unreviewed selected phonetic target");
    begin(selected);
    next.focus();
  },{signal:scope.signal});
  dialog.addEventListener("cancel",(event)=>{
    event.preventDefault();
    close();
  },{signal:scope.signal});
  dialog.addEventListener("close",options.focusSentencePractice,{signal:scope.signal});
  // Capturing on window precedes the sentence app's document/capture listeners.
  window.addEventListener("keydown",onKeydown,{capture:true,signal:scope.signal});
  begin(0);
  return {destroy:()=>{scope.abort();dialog.remove();trigger.remove();}};
}
