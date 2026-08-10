# Analysis progress history

> Trend values are descriptive summaries of recent bounded observations.
> They are not statistical confidence, causal learning claims, or future predictions.

This document owns the bounded history used by [Learning analysis](./weakness-diagnostics.md): what a history point means, where it is stored, when it is written, and what Analysis V2 may say about it.

## Product boundary

Progress history answers a narrow retrospective question:

> What did recent valid observations look like compared with this learner's earlier valid observations?

It deliberately does not answer:

- how long until a key or motor pattern is learned;
- what the learner's overall typing ability is;
- how many lessons remain;
- whether a skill has been mastered;
- what will happen next.

There is no validated predictive learning model behind this feature. The product therefore exposes bounded historical points rather than projections, confidence percentages, regression forecasts, or mastery dates.

## Stored series

Progress-history schema 3 stores two evidence groups.

### Per-key semantic history

For each expected token:

- correctness (`錯誤觀察比例`);
- accepted binding timing (`有效鍵間時間`).

These two series remain separate. They are never combined into one progress or weakness score.

### V2 motor history

Motor timing history uses the same low-dimensional scope identities as the cumulative Measurement V2 aggregates:

- syllable coordination;
- immediate standard-fingering side transition;
- same-side revisit;
- tone commit.

Every scope has its own timing series. Different motor families are not compared by raw milliseconds as if they measured the same action.

### Not stored as history

Directional confusion history is not currently persisted. A trustworthy confusion trend needs an exposure denominator for the expected token, not just cumulative pair counts, so it requires a different bucket shape before it can be added.

Input-strategy position aggregates are currently cumulative bounded counts, not trend series.

## Dependency direction

```text
interaction / measurement-v2
        ↓ decides which observations are legal
progress-history
        ↓ accumulates legal observations into bounded buckets
Analysis V2 model
        ↓ joins cumulative aggregates with matching histories
Analysis V2 UI
        renders exact values and recent points
```

UI code does not decide timing eligibility, reconstruct raw traces, or reclassify canonical order as motor evidence.

## Schema and migration

`PROGRESS_HISTORY_SCHEMA_VERSION` is currently **3**.

Schema 3 added bounded V2 motor histories. Schema 2 is safely migratable because it already used unordered input-order V2 semantics; migration adds empty motor histories rather than reinterpreting old observations.

Older strict-order measurement epochs are not silently carried across the input-order semantic boundary.

## Bucket policy

`src/progress-history/policy.ts` owns the history constants. UI code must not duplicate them.

Current policy:

| Setting | Value | Meaning |
| --- | ---: | --- |
| correctness bucket | 8 observations | mapped semantic observations per completed correctness point |
| timing bucket | 5 samples | accepted clean timing samples per completed timing point |
| completed-point limit | 10 | newest completed points retained per series |

Overflow drops the oldest completed point and leaves the open partial bucket intact.

Buckets are counted in observations/samples, not dates or sentences, so one point represents a stable amount of exposure rather than an arbitrary calendar interval.

## Correctness points

A completed correctness point records:

- cumulative ending observation index;
- completed round;
- attempts in the bucket;
- errors in the bucket;
- bucket error ratio.

Its ratio has the same meaning as the cumulative semantic metric:

```text
mapped incorrect observations / mapped correct and incorrect observations
```

A correct recovery input after an error is another mapped observation. Therefore this is **not** a first-attempt error rate and must not be renamed as one.

Unmapped keys, modifier shortcuts, ignored repeats, composition events, and other interaction noise do not become semantic correctness observations upstream and therefore cannot enter these buckets.

## Timing points

A completed timing point records:

- cumulative ending timing-sample index;
- completed round;
- sample count;
- representative timing in milliseconds.

The representative value is the **median** of that bucket's accepted samples.

The open partial timing bucket temporarily stores raw timing values because a median cannot be updated from one scalar accumulator. That array is bounded by `timingBucketSize - 1`; once the bucket closes, only the completed point remains.

Non-finite or negative timing values are never allowed to become history samples.

## Semantic timing versus motor timing

Semantic binding timing and V2 motor timing are different series even when both are expressed in milliseconds.

Semantic timing is attached to an expected binding observation. Motor timing is attached to a native V2 motor scope such as a side transition, coordination shape, revisit class, or tone commit.

Analysis V2 must not copy one family into another or use a global millisecond ranking across heterogeneous scopes.

## Cumulative aggregate versus history point

The current aggregate and a history point answer different questions.

| | Cumulative aggregate | History point |
| --- | --- | --- |
| Correctness | all mapped observations to date | one 8-observation slice |
| Semantic timing | current smoothed aggregate | median of one 5-sample slice |
| Motor timing | current V2 scope aggregate | median of one 5-sample slice for the same scope |

The UI may show both, but must not imply they are the same computation.

## Motor scope identity

`MotorTimingProgressHistory<Scope>` stores the exact scope object used by its cumulative aggregate plus:

- completed timing points;
- one partial timing bucket;
- cumulative timing-sample count.

The four motor dictionaries are keyed by bounded aggregate identity. They do not grow by arbitrary token pairs or raw event traces.

This is a core storage boundary: richer observation detail may exist transiently during measurement, while long-term learner history remains intentionally low-dimensional.

## Round update semantics

History is appended on completed rounds.

`lastCompletedRound` makes the operation idempotent: applying a round whose number is not newer is a no-op. Reopening analysis, reloading, or re-importing a backup therefore cannot double-count a completed round.

The history update consumes observations that have already passed the relevant measurement eligibility rules. It does not perform a second, UI-specific interpretation of keyboard order.

## Persistence boundary

Progress history is local learner data stored independently from the current cumulative product progress, but both use the same practice mode/layout identity boundary.

The persisted representation is bounded by:

- a finite set of key identities;
- a finite set of V2 motor aggregate identities;
- at most 10 completed points per series;
- at most one partial bucket per series.

No raw per-keystroke history is retained after a bucket closes.

## Analysis V2 rendering

Semantic selected-key detail may show the newest correctness and semantic-timing points.

Coordination cells may show the newest motor-timing points for their own scope.

Strategy currently has no progress-history chart because its position matrices are cumulative bounded aggregates rather than time series.

Empty history is a normal state. The UI should say that there are no completed history points yet rather than infer stability from the absence of points.

## Language boundary

Allowed descriptions are observational, for example:

- `最近 5 個點`;
- `92 → 88 → 85 ms`;
- `尚無完成的歷史點`;
- `樣本累積中`.

Do not turn those observations into unsupported claims such as:

- `已掌握`;
- `退步` without an explicit descriptive policy;
- `再練 3 次就會熟`;
- `80% 信心已學會`;
- `預計明天達標`.

Progress history records what happened. It does not certify ability or predict learning.
