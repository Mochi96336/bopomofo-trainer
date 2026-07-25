# Diagnostic progress history

> Trend labels are descriptive summaries of recent bounded observations.
> They are not statistical confidence, causal learning claims, or future predictions.

This document owns the progress-history extension to [weakness diagnostics](./weakness-diagnostics.md). It covers what a history point means, where it is stored, when it is written, and what the interface is and is not allowed to say about it.

## Product boundary

Progress history answers one question:

> How is this key doing now, and compared with this learner's own earlier valid observations, is it improving, level, or possibly getting worse?

It deliberately does not answer:

- how long until this key is learned;
- what the learner's overall typing ability is;
- how many more sentences are needed;
- whether the key has been mastered.

There is no validated learning model behind this feature, so it does not imitate one. No projected date, no remaining-lesson count, no unlock model, no probability of having learned a key, no confidence percentage, no regression line extended past the newest point.

The feature lives inside the existing full-page analysis mode, in the persistent selected-key detail pane, under a `最近變化` heading below the exact cumulative values. It is not a new route, not a dashboard, and not a drawer chart. The information drawer keeps its summary role and gains nothing from it.

## Scope

| Series | Included | Reason |
| --- | --- | --- |
| Key correctness (`錯誤觀察比例`) | yes | Clean denominator, matches an existing display metric. |
| Key binding timing (`有效鍵間時間`) | yes | Accepted timing observations already have an exact eligibility contract. |
| Transition timing | no — extension point only | See below. |
| Directional confusion | no — extension point only | See below. |

Relationship history is deferred rather than half-delivered. Both remaining series need something the current design does not establish:

- **Transition timing** would multiply stored identities by the number of ordered token pairs rather than the number of keys. Every bounded array in the current persistence contract is capped by a small fixed limit on a fixed set of identities; a transition series would need eviction *across* identities, which is a new persistence pattern and needs its own policy and tests before it is written to learner storage.
- **Directional confusion** needs a denominator that actually tracks whether a mispress is becoming rarer. The cumulative `expectedErrorShare` does not: if `ㄓ → ㄗ` falls from five occurrences to two while every other `ㄓ` confusion disappears, that share *rises*. A trustworthy series must bucket by the expected token's own mapped observations and store, per bucket, the expected-token observation count plus each actual token's occurrence count, so a bucket where the pair never appeared projects to a true `0` rather than to missing data. That is a different bucket shape from the two shipped here.

The extension point is `src/progress-history/`: `appendRoundToProgressHistory` already receives the full `Exercise`, the raw traces, and the measurement policy, so transition and confusion decisions are available at the same call site without changing the round-completion flow. Adding a series means adding a bucket shape, a parser branch, and a projection — not rewiring the pipeline.

## Dependency direction

```text
measurement          decides which observations are legal
progress-history     accumulates legal observations into bounded buckets
diagnostics          projects buckets into points, deltas, and trend summaries
app                  renders SVG and HTML only
```

`src/app/diagnostic-panel.ts` contains no statistics and no data cleaning. It formats what `src/diagnostics/progress-trends.ts` hands it.

## Bucket semantics

Buckets are counted in *observations*, never in sentences or dates, so a bucket means the same amount of exposure regardless of how long an utterance happened to be.

### Correctness buckets

- Size: `PROGRESS_HISTORY_POLICY.correctnessBucketSize`, currently **8** mapped correctness observations for that expected token. This matches `DIAGNOSTIC_POLICY.errorSamples.sufficient`, so one point is exactly the exposure the product already calls enough to display a ratio.
- A point records `attempts`, `errors`, `errorRatio`, the cumulative observation index at close, and the round that closed it.
- The ratio keeps the cumulative metric's exact meaning and limitation: a correct recovery input after an error is another mapped observation, so **this is not a first-attempt error rate**. It is not renamed anywhere in the interface.
- Unmapped keys, modifier shortcuts, repeats, and composition events are interaction noise upstream and never reach history.

### Timing buckets

- Size: `PROGRESS_HISTORY_POLICY.timingBucketSize`, currently **5** accepted timing observations, matching `DIAGNOSTIC_POLICY.timingSamples.sufficient`.
- Only observations the measurement policy already accepted are used. Syllable starts, incorrect input, recovery input, and interaction-noise-contaminated intervals are excluded, exactly as they are for the cumulative aggregate. Non-finite and negative intervals are dropped rather than allowed to reach a bucket.
- The representative value is the bucket **median**. A mean would let one hesitation inside a five-sample bucket drag the point noticeably; the median leaves it where the rest of the bucket sat. It is deterministic and independent of arrival order.
- A key whose catalog positions can never produce accepted motor timing has no timing series at all, and reuses the existing `不適用` wording rather than showing a chart that waits forever for samples.

### Current aggregate versus history point

These are different quantities and the interface must not blur them:

| | Cumulative aggregate | History point |
| --- | --- | --- |
| Correctness | all mapped observations to date | one 8-observation slice |
| Timing | exponential moving average, `alpha = 0.25`, carrying every earlier sample forward | median of that point's own 5 accepted samples |

The detail pane keeps showing the aggregate as the current state. The chart shows per-exposure representative values, drawn against its own labelled axis bounds, so the two readings are not mistaken for the same computation.

`bestTimeToTypeMs` remains one reference value in the cumulative detail. It is never drawn as a baseline ability, and `current / best` is never presented as a learning-progress percentage: a single fast sample can set it.

## Bounded history

- Completed points per series, per key: `PROGRESS_HISTORY_POLICY.completedPointLimit`, currently **10**. Overflow drops the oldest completed point only; the open partial bucket is never disturbed.
- Retained raw values: correctness keeps two counters; timing keeps at most `timingBucketSize - 1` (currently **4**) sample values, because a median cannot be computed incrementally. Nothing else is retained — no keydown events, no `InteractionTrace` values, no per-observation log.
- Worst case for the standard layout (42 bound tokens, every series at the limit, both partial buckets full) measured at **≈83 KiB** of JSON. A realistic 90-round fixture measured **≈31 KiB**. There is no reason to introduce IndexedDB.

## Persistence

History uses its own schema, independent of product progress:

```text
bopomofo-trainer.progress-history.v1
```

Separate storage was chosen over extending `ProductProgress` because this repository rejects obsolete progress generations rather than migrating them. Folding history into `ProductProgress` would tie every future history change to a progress schema bump, discarding cumulative aggregates to ship a feature that has no history to show yet. A separate key lets the two records rotate independently.

The parser rejects:

- an unsupported schema version, mode, or layout;
- a token outside the current layout and catalog support;
- more keys than `PROGRESS_HISTORY_KEY_LIMIT` (gated before per-key validation, so an imported backup cannot force a large payload through);
- arrays longer than the completed-point limit;
- negative, non-integer, `NaN`, and `Infinity` values;
- a point whose bucket size disagrees with the policy;
- a point whose stored ratio contradicts its own counts;
- duplicate or out-of-order points;
- an overfull partial bucket;
- totals that disagree with the stored points;
- a point recorded after the history's own last completed round.

Beyond parsing, the storage adapter discards a history whose `lastCompletedRound` exceeds the rounds the accompanying progress actually completed. History is only ever appended by a completed round, so a larger value means the two records have been separated, and showing points that no longer correspond to the displayed aggregates would be worse than starting over.

Backups carry the history in a `progressHistory` section. Every backup this version writes carries one, so a missing section is a malformed file and the import is rejected rather than filled in with an empty history.

`清除進度` clears history along with progress and Pilot history. When storage is blocked, the current practice session is unaffected and the existing notice language is reused.

Cumulative aggregates are never reshaped into history points. `currentTimeToTypeMs`, `bestTimeToTypeMs`, the current error ratio, and zero are not assembled into a fake two-point series.

## When history is written

History is folded in exactly once per round, in the browser's round-completion flow, after the round is finalized and its measurement decisions are settled. It is never recomputed during render, never written when the analysis panel opens, and never read from the DOM.

`appendRoundToProgressHistory` ignores any round at or below `lastCompletedRound`, so reopening the panel, reloading, or re-importing a backup cannot double-count practice. The `F8` inspection advance previews a different prompt without completing a round, so it never reaches this path at all.

## Trend display rule

The chart shows the points. The text states a conservative recent direction.

The estimator compares the **median of the two most recent completed points** with the **median of the two before them**, over the last four points only. Two windows rather than first-versus-last, because a single outlying bucket at either end of a ten-point series would otherwise decide the wording. Older points stay on the chart but do not affect the summary.

Both metrics are "lower is better", so a negative difference is always the improvement direction. The estimator is pure, deterministic, requires a minimum point count, and never extrapolates.

### Display dead zone

Differences smaller than the dead zone are reported as level rather than as a direction:

| Metric | Dead zone |
| --- | --- |
| Correctness | `DIAGNOSTIC_PROGRESS_POLICY.correctnessDeadZone`, currently 5 percentage points |
| Timing | the larger of `timingDeadZoneMs` (20 ms) and `timingDeadZoneRatio` (8%) of the earlier window |

This is a **display dead zone**. It is not a confidence interval and not a significance threshold.

A difference that clears the dead zone is still reported as `variable` rather than as a direction when point-to-point movement across the compared window is at least `variabilityMultiplier` (currently 3×) the size of the difference itself — that is, when the movement is smaller than the noise around it.

### States and wording

| State | Correctness | Timing |
| --- | --- | --- |
| `improving` | `最近較少出錯` | `最近較快` |
| `stable` | `近期大致持平` | `近期大致持平` |
| `worsening` | `最近錯誤觀察增加` | `最近較慢` |
| `variable` | `最近波動較大` | `最近波動較大` |
| `insufficient` | `再累積幾個區段後才能判斷` | `再累積幾個區段後才能判斷` |

Wording that claims causation, mastery, or certainty — `訓練已生效`, `系統成功改善此鍵`, `使用者已掌握`, `肌肉記憶形成`, `一定正在退步` — is out of contract.

## Empty and insufficient states

| Situation | Shown |
| --- | --- |
| No history for this key | `從本版本開始累積趨勢`, no chart |
| Timing can never apply | `不適用`, no chart |
| One completed point | the point, plus `再累積一些有效觀察後才能比較` |
| Two or three points | the chart, plus `目前資料不足以判斷方向` |
| Open bucket in progress | `下一個區段 3 / 5` as text |

The open partial bucket is reported as text, never plotted. Drawing it would put an unequal-exposure point on the same line as completed ones, which is the easiest way to mislead.

## Chart scale

Neither chart autoscales freely to its own range.

- Correctness is bounded to `0–100%` with a minimum axis span of 10 percentage points, so `8% → 7%` cannot be drawn as a collapse.
- Timing is never negative and has a minimum axis span of 40 ms.
- Both add 15% padding around the observed range so the newest point is never on the frame edge.
- Because the domain is adaptive, the upper and lower bound are **drawn on the chart itself**, as a tick and a label in that metric's own unit (`33%` / `0%`, `422 ms` / `325 ms`), in a reserved left gutter. The scale is read where it is used rather than described in a caption beside it, and the labelled bounds also make the timing chart's direction self-evident without a separate `越低越快` note.

Below the chart there is only the trend sentence and, when a bucket is open, `下一個區段 3 / 5`.

The SVG scales uniformly rather than stretching, so point markers stay circular at any pane width and the chart never forces the inspector to scroll sideways.

## Accessible text contract

Every chart carries a visually hidden sentence naming the metric, the number of completed segments, both window values, and the direction:

```text
ㄌ的錯誤觀察比例共有 6 個歷史區段，前期代表值 14%，近期代表值 8%，最近較少出錯。
ㄞ的有效鍵間時間共有 2 個區段，目前資料不足以判斷方向。
ㄌ的有效鍵間時間不適用。
```

The summary is produced by the diagnostics projection, so the text and the chart cannot diverge. Screen readers never walk SVG path coordinates or hear the axis labels read out as loose numbers: the `<svg>` is `role="presentation"`, `focusable="false"`, and `aria-hidden="true"`, and no chart internal enters the tab order. Point titles are a hover convenience only — every value they show is already in the delta line and the accessible summary.

Existing analysis-mode behaviour is unchanged: `Escape` closes, focus stays contained, reduced motion is respected, tab semantics hold, and the full-network overlay's pointer behaviour is untouched.

## Theme and visual language

The charts use existing tokens only. The connecting line and historic points use `--ink-upcoming`, the newest point uses `--ink`, and the reference line uses `--ink-faint`. Direction is carried by words and by which point is emphasized, not by a green/amber/red traffic light. `--danger` stays reserved for actual input errors and the full-network severity contract; `worsening` is a neutral observation, not an alarm.

## Validation coverage

```bash
npm run typecheck
npm run test:fast
npm run test:source-adapters
npm run catalog:validate
npm run build
```

Locked by tests:

- correctness bucket boundaries, remainder carry-over, recovery inclusion, and noise exclusion;
- timing bucket boundaries, every exclusion reason, deterministic median, and non-finite rejection;
- history-limit overflow dropping only the oldest completed point;
- round idempotency, cross-round partial continuation, and identity mismatch rejection;
- history totals agreeing exactly with the cumulative aggregate over real product rounds;
- the full parser rejection list and a serialize/parse round trip;
- backup round trip, missing-section rejection, and malformed-history rejection;
- storage-adapter load, save, clear, and separated-record recovery;
- trend states, both metric directions, dead zone, variability, windowing, and chart domain bounds;
- rendered states for no-history, single point, insufficient, not-applicable, partial bucket, accessible summary, and metric separation.

Browser acceptance was run with a temporary Playwright harness over the built app, seeded with history generated by playing 90 real product rounds: light and dark themes, 1280×720 and 1440×900, 100% and 125% zoom, and `prefers-reduced-motion: reduce` — 148 combinations, checking for horizontal overflow, overlap with the relationship SVG, the exact cumulative metrics remaining visible, and chart internals staying out of the tab order.
