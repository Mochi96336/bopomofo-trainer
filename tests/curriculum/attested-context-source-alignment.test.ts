import { describe, expect, it } from "vitest";
import type { UdOccurrenceToken } from "../../scripts/ud-occurrence-source.js";
import {
  alignUdTokensToSourceText,
  buildAlignedAttestedFocusPresentation,
  parseUdOriginalSentenceTexts,
} from "../../src/curriculum/attested-context-source-alignment.js";
import type { AttestedTargetContext } from "../../src/curriculum/attested-target-contexts.js";

const token = (id: number, form: string, upos = "NOUN"): UdOccurrenceToken =>
  ({ id, form, upos, head: 0, relation: "root", feats: "_" });

describe("original source text + exact focused token", () => {
  it("parses source text records at exactly the same sentence boundaries as UD tokens", () => {
    const source = [
      "# sent_id = a", "# text = 我 在 IBM 工作。",
      "1\t我\t_\tPRON\t_\t_\t2\tnsubj\t_\t_",
      "2\t在\t_\tADP\t_\t_\t4\tcase\t_\t_",
      "", "# sent_id = b", "# text = 他吃飯。",
      "1\t他\t_\tPRON\t_\t_\t2\tnsubj\t_\t_",
      "", "# sent_id = c",
      "1\t沒有\t_\tVERB\t_\t_\t0\troot\t_\t_",
      "",
    ].join("\n");
    expect(parseUdOriginalSentenceTexts(source))
      .toEqual(["我 在 IBM 工作。", "他吃飯。", null]);
  });

  it("aligns whitespace and repeated lexical forms by occurrence, not first text match", () => {
    const tokens = [
      token(1, "他", "PRON"), token(2, "看看", "VERB"),
      token(3, "看", "VERB"), token(4, "書"), token(5, "。", "PUNCT"),
    ];
    const target: AttestedTargetContext = {
      sourceSentenceIndex: 7, sourceTokenId: 3, tokenIndex: 2,
      focusText: "看", focusEntryId: "word:看:ㄎㄢ4",
      sourceTokenForms: tokens.map(t => t.form),
    };
    const presentation = buildAlignedAttestedFocusPresentation(target, tokens, "他看看 看書。");
    expect(presentation).toMatchObject({
      originalText: "他看看 看書。", prefix: "他看看 ", focus: "看", suffix: "書。",
      start: 4, end: 5, focusEntryId: target.focusEntryId,
    });
    expect(presentation!.prefix + presentation!.focus + presentation!.suffix)
      .toBe(presentation!.originalText);
    expect(alignUdTokensToSourceText("我 在 IBM 工作。", [
      token(1, "我"), token(2, "在", "ADP"), token(3, "IBM", "PROPN"),
      token(4, "工作", "VERB"), token(5, "。", "PUNCT"),
    ])).not.toBeNull();
  });

  it("refuses dropped punctuation, skipped source words, and source-token drift", () => {
    const tokens = [token(1, "我"), token(2, "吃", "VERB"), token(3, "飯")];
    const target: AttestedTargetContext = {
      sourceSentenceIndex: 0, sourceTokenId: 2, tokenIndex: 1,
      focusText: "吃", focusEntryId: "word:吃:ㄔ1",
      sourceTokenForms: ["我", "吃", "飯"],
    };
    expect(alignUdTokensToSourceText("我先吃飯", tokens)).toBeNull();
    expect(alignUdTokensToSourceText("我吃飯。", tokens)).toBeNull();
    expect(alignUdTokensToSourceText("我吃飯", tokens)).not.toBeNull();
    expect(buildAlignedAttestedFocusPresentation(target, tokens, null)).toBeNull();
    expect(buildAlignedAttestedFocusPresentation(target, tokens, "我先吃飯")).toBeNull();
    expect(buildAlignedAttestedFocusPresentation(
      { ...target, tokenIndex: 0 }, tokens, "我吃飯",
    )).toBeNull();
    expect(buildAlignedAttestedFocusPresentation(
      { ...target, sourceTokenId: 99 }, tokens, "我吃飯",
    )).toBeNull();
  });

  it("uses UTF-16 positions safely for source text with supplementary characters", () => {
    const tokens = [token(1, "𠮷"), token(2, "看", "VERB"), token(3, "書")];
    const target: AttestedTargetContext = {
      sourceSentenceIndex: 5, sourceTokenId: 2, tokenIndex: 1,
      focusText: "看", focusEntryId: "word:看", sourceTokenForms: tokens.map(t => t.form),
    };
    expect(buildAlignedAttestedFocusPresentation(target, tokens, "𠮷看書"))
      .toMatchObject({ prefix: "𠮷", focus: "看", suffix: "書", start: 2, end: 3 });
  });
});
