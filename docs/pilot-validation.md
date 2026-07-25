# Pilot evidence and interface hierarchy

This describes the per-round evidence the browser keeps and the interface rules that evidence is read through. It does not change curriculum thresholds and does not claim validated learning effectiveness.

## Storage boundary

Product progress remains the source of truth for cumulative measurement and curriculum state. Pilot history uses a separate schema-versioned localStorage key:

```text
bopomofo-trainer.pilot-history.v3
```

A payload whose schema version is not the current one is rejected outright rather than migrated, and the learner restarts from a fresh generation. Pilot-history schema 3 accompanies product-progress schema 6 and measurement policy `phase-3-v2`.

Bounded per-key progress trends are a third, independent record — see [progress history](./diagnostic-progress-history.md).

When the Pilot key is absent, progress summaries can derive a bounded fallback history. Summaries do not preserve per-round latency, so their `cleanLatencyMedianMs` is explicitly `null`. The two records are reconciled by round number: records beyond completed progress are discarded, summaries can fill a history write that is one round behind, and malformed history falls back to valid summaries.

## Per-round evidence

The latest 24 completed rounds retain:

- sequential round number;
- coverage or adaptive phase;
- mapped-key attempts, errors, and accuracy;
- eligible timing-sample count;
- median clean latency;
- completion time and entry IDs.

Mapped-key accuracy includes correct and incorrect mapped key presses at all boundaries. It excludes unmapped, repeat, modifier-only, and IME-composition events.

Median clean latency uses only non-null binding-observation timing values accepted by the measurement policy. It remains separate from user-facing accuracy.

The record retains a `kind` and a focus-token field from an earlier generation. Every round the product now produces is a practice round with no single focus token, so these are constant in new data; they are kept only so existing stored history stays parseable.

## Interface hierarchy

The primary product is a continuous sentence runway rather than a dashboard of product and research state.

1. One complete Traditional Chinese utterance is the visual unit. Catalog-entry and word boundaries remain in the domain model but are not rendered as cards, gaps, queue rows, or numbered states. Invisible entry wrappers are indivisible line-breaking units, so a reviewed word cannot split across lines.
2. Each displayed character uses a fixed visual step independent of reading length. The syllable row reserves four readable symbol positions — initial, medial, final, and tone where present — without compressing token spacing. Shorter syllables remain centered in that same slot.
3. The browser measures every entry at the current rendered font and container width, then uses a deterministic dynamic-programming planner to assign contiguous entry ranges to explicit lines. The planner minimizes ragged unused width and strongly penalizes a short single-entry final orphan whenever another legal distribution exists. Lines share one stable left edge, and punctuation stays inside the final entry.
4. Completed, current, and upcoming tokens use restrained ink contrast. The current Bopomofo token receives the persistent accent; the Chinese row does not add a second decorative locator.
5. Wrong-key feedback appears at the current token and in one fixed-height feedback line. Unmapped input stays quiet and does not move layout.
6. IME composition remains blocking, but its warning overlays and dims the stable practice surface instead of increasing feedback height or shifting the sentence and progress line.
7. The primary view retains only the utterance, Bopomofo path, compact round status, a restrained two-pixel progress line, and one numeric position count.
8. Completing the final token persists progress once, then immediately creates the next round. There is no completion card, next-round button, mouse action, or timed result gate.
9. The previous round's compact accuracy and clean median remain for at most 1.4 seconds and disappear earlier on the first correct input of the next sentence.
10. `Escape` opens a keyboard-operable information surface: a full-height 440px right-side panel. The same key closes it and restores the hidden keyboard-capture target.
11. Display toggles, the weakness-diagnostic summary with its `進入分析` action, recent history, selection-weight controls, and local backup/reset live inside that surface.
12. Desktop and narrow layouts preserve the same hierarchy without visible entry spacing or horizontal scrolling.

The implementation keeps a hidden textarea so real composition events remain observable. Space and Tab are prevented from moving the page only while the practice capture target owns input; controls inside the information surface retain normal keyboard navigation.

## Motion boundary

Motion supports state continuity but never becomes a reward layer:

- the sentence DOM is mounted once per round and existing token/glyph classes update in place;
- initial mount, container resize, and final font availability may reparent existing entry nodes into newly planned line wrappers without recreating glyph or token nodes;
- token progress uses an 80–90 ms colour and underline transition;
- an incorrect current token receives one small horizontal nudge;
- a newly created sentence receives a 150 ms opacity and four-pixel entrance;
- the information panel and the analysis mode each use one restrained entrance transition;
- `prefers-reduced-motion` reduces every transition and animation to an effectively immediate state change.

There are no success bursts, card scaling, staggered character entrances, animated counters, or background motion.

## Local backup

`匯出存檔` writes deterministic local JSON containing product progress, Pilot history, bounded progress-trend history, and the selection-weight tuning. It omits export time, account data, and any confidence or mastery score. `匯入存檔` replaces current state after an explicit confirmation, and rejects a file whose history does not fit the progress it travels with.

## Manual protocol

1. Complete 10–20 rounds without clearing progress or using the pointer.
2. Confirm the final correct token moves directly to an active next sentence and creates one history record.
3. Hold the final physical key long enough to generate key repeat and confirm the next sentence does not advance.
4. Open and close the information panel with `Escape`; confirm focus returns to practice and Tab navigation stays inside the panel while open.
5. Toggle the physical-key hint and confirm only the next expected key is exposed.
6. Trigger wrong-key, unmapped-key, and IME states without causing sentence or progress layout shifts.
7. Open `進入分析`, select a key, and confirm the cumulative detail and the `最近變化` trends describe the same key without contradicting each other.
8. Reload at least twice and verify completed history remains ordered, the deterministic next utterance is reproduced, and an open trend bucket continues rather than restarting.
9. Check one 320 px viewport and one normal desktop viewport. Use a long sentence that would greedily leave one short final entry, and confirm the planner moves an earlier entry to produce a more even final line while preserving entry order.
10. Resize across at least one line-break threshold and confirm only entry grouping changes: entered token state, current token, punctuation attachment, and sentence identity remain unchanged.
11. Confirm a four-symbol syllable including its tone stays visibly separated, and that shorter syllables do not change Chinese character spacing.
12. Export a backup, reset progress, re-import, and confirm progress, history, and trends all return.

Curriculum thresholds should change only after a repeatable failure mode appears. UI changes should likewise respond to observed task friction rather than decoration alone.
