import { describe, expect, it } from "vitest";
import { renderAttestedFocusContext } from "../../src/app/attested-focus-context.js";
import type { Exercise } from "../../src/core/model.js";
import type { AttestedFocusPresentation } from "../../src/curriculum/attested-context-source-alignment.js";

describe("source-aligned one-target context display", () => {
  const base: AttestedFocusPresentation = {
    sourceSentenceIndex: 1,
    focusEntryId: "word:吃:ㄔ1",
    originalText: "他吃飯。",
    prefix: "他", focus: "吃", suffix: "飯。",
    start: 1, end: 2,
  };

  const focusedExercise: Exercise = {
    id: "source-focus", mode: "guided", layoutId: "standard",
    entries: [{
      id: base.focusEntryId,
      prompt: { text: "吃", locale: "zh-TW" },
      syllables: [{ tokens: ["zhuyin:ㄔ", "tone:1"] }],
      tags: [], provenanceIds: [],
    }],
  };

  it("marks the single target but never converts the rest of the sentence to a graded glyph", () => {
    const html = renderAttestedFocusContext(base, focusedExercise);
    expect(html).toContain('class="attested-context-focus"');
    expect(html).toContain("他<mark");
    expect(html).toContain(">吃</mark>飯。");
    expect(html).not.toContain("reading-token");
    expect(html).not.toContain("entry-index");
    expect(html).not.toContain("word:吃");
  });

  it("escapes untrusted corpus text and focus tokens before interpolating HTML", () => {
    const originalText = '<b> & "吃" </b>';
    const focus = "吃";
    const start = originalText.indexOf(focus);
    const item: AttestedFocusPresentation = {
      ...base, originalText,
      prefix: originalText.slice(0, start), focus,
      suffix: originalText.slice(start + focus.length),
      start, end: start + focus.length,
    };
    const html = renderAttestedFocusContext(item, focusedExercise);
    expect(html).not.toContain("<b>");
    expect(html).not.toContain("</b>");
    expect(html).toContain("&lt;b&gt; &amp; &quot;");
    expect(html).toContain("<mark");
    expect(html).toContain("</mark>");
  });

  it("refuses mutated source displays instead of silently shifting the target", () => {
    expect(() => renderAttestedFocusContext({ ...base, suffix: "書。" }, focusedExercise))
      .toThrow("source text");
    expect(() => renderAttestedFocusContext({ ...base, start: 0, end: 1 }, focusedExercise))
      .toThrow("source text");
  });
  it("never highlights one word while grading a different pronunciation identity", () => {
    expect(() => renderAttestedFocusContext(base, {
      ...focusedExercise,
      entries: [{ ...focusedExercise.entries[0]!, id: "word:吃:ㄔ2" }],
    })).toThrow("graded catalog identity");
    expect(() => renderAttestedFocusContext(base, {
      ...focusedExercise, entries: [],
    })).toThrow("graded catalog identity");
    expect(() => renderAttestedFocusContext(base, {
      ...focusedExercise, entries: [
        focusedExercise.entries[0]!, focusedExercise.entries[0]!,
      ],
    })).toThrow("graded catalog identity");
  });

});
