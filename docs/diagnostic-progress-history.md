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

Progress-history schema 7 stores per-key semantic history plus bounded V2 motor history.

### Per-key semantic history

For each expected token:

- correctness (`錯誤觀察比例`);
- accepted binding timing (`有效鍵間時間`).

These two series remain separate. They are never combined into one progress or weakness score.

### V2 motor history

Motor timing history uses the same scope identity as its cumulative Measurement V2 aggregate. The persisted families are:

- exact accepted-token transition (`immediateTokens`);
- syllable word-structure coordination;
- immediate standard-fingering side transition;
- same-side revisit;
- tone commit.

Every scope has its own timing series. Different motor families are not compared by raw milliseconds as if they measured the same action.

Exact accepted-token transitions are the intentionally higher-cardinality family. Their identity is the actual directed `fromToken → toToken` pair already used by the `鍵間` speed map. They are bounded by the valid token domain squared; no potential or canonical pair is synthesized merely to create history.

### Not stored as history

Directional confusion history is not currently persisted. A trustworthy confusion trend needs an exposure denominator for the expected token, not just cumulative pair counts, so it requires a different bucket shape before it can be added.

Input-strategy position and whole-word-order aggregates are cumulative bounded counts, not trend series.

## Dependency direction

```text
interaction / measurement-v2
        ↓ decides which observations are legal
progress-history
        ↓ accumulates selected legal observations into bounded buckets
Analysis V2 model
        ↓ joins cumulative aggregates with matching histories
Analysis V2 UI
        renders current values and bounded recent points
```

UI code does not decide timing eligibility, reconstruct raw traces, or reclassify canonical order as motor evidence. Exact transition history uses the same `immediateTokenTimingSample` eligibility as the cumulative speed-map aggregate: the observation must be a clean, actual, within-syllable accepted transition.

## Schema and migration

`PROGRESS_HISTORY_SCHEMA_VERSION` is currently **7**.

Schema 8 adds `motor.immediateTokens`, keyed by the existing exact directed token-pair aggregate identity.

Schema 6 did not store pair-level history. A schema-6 record therefore migrates to schema 7 with `immediateTokens: {}` while preserving its valid word-structure coordination, immediate-hand, same-hand-revisit, and tone-commit histories. The parser does **not** take a cumulative pair aggregate and manufacture historical points from it: the joint sequence of past buckets is not recoverable from one cumulative value.

Older migration semantics remain unchanged:

- schema 5 preserves word-structure coordination, immediate-hand, and tone history but discards the old same-hand-revisit series whose semantics were later tightened;
- schemas 3/4 validate and discard obsolete coordination identities rather than guessing a conversion;
- schema 2 migrates with empty motor history.

Older strict-order measurement epochs are not silently carried across an input-order semantic boundary.

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

Semantic binding timing and V2 motor timing are different evidence even when both are expressed in milliseconds.

Semantic timing is attached to an expected binding observation. Motor history is attached to a native V2 motor scope: an exact directed token pair, side transition, word-structure shape, revisit class, or tone commit.

Analysis V2 must not copy one family into another or use a global millisecond ranking across heterogeneous scopes. Exact token transitions may be compared among exact token transitions because they share one measurement shape.

## Cumulative aggregate versus history point

The current aggregate and a history point answer different questions.

| | Cumulative aggregate | History point |
| --- | --- | --- |
| Correctness | all mapped observations to date | one 8-observation slice |
| Semantic timing | current smoothed aggregate | median of one 5-sample slice |
| Exact accepted-token timing | current V2 pair aggregate | median of one 5-sample slice for the same directed pair |
| Low-dimensional motor timing | current V2 scope aggregate | median of one 5-sample slice for the same scope |

The UI may show both aggregate and history, but must not imply they are the same computation or fabricate a history point from the cumulative value. For example, `ㄅ → ㄆ = 123 ms` is the current cumulative pair aggregate; `180 → 160 → 123 ms` may be a sequence of recent completed five-sample bucket medians. The last historical point happening to equal the current aggregate does not make the computations equivalent.

## Motor scope identity

`MotorTimingProgressHistory<Scope>` stores the exact scope object used by its cumulative aggregate plus:

- completed timing points;
- one partial timing bucket;
- cumulative timing-sample count.

The low-dimensional dictionaries remain finitely bounded by their small canonical identity sets. `immediateTokens` is separately bounded by the current valid token set squared, matching the cumulative Measurement V2 parser boundary. It remains sparse in practice because history entries are created only for exact directed pairs that actually produce eligible observations.

No raw event trace is persisted in a motor-history dictionary.

## Round update semantics

History is appended on completed rounds.

`lastCompletedRound` makes the operation idempotent: applying a round whose number is not newer is a no-op. Reopening analysis, reloading, or re-importing a backup therefore cannot double-count a completed round.

The history update consumes observations that have already passed the relevant measurement eligibility rules. It does not perform a second, UI-specific interpretation of keyboard order.

For exact transitions, each clean within-syllable immediate-token observation is appended to the history entry for its actual directed pair. Five accepted timing samples close one history point using the same median bucket policy as the other timing families.

## Persistence boundary

Progress history is local learner data stored independently from the current cumulative product progress, but both use the same practice mode/layout identity boundary.

The persisted history representation is bounded by:

- a finite set of key identities;
- four low-dimensional V2 motor identity families;
- one sparse exact-transition family bounded by `validTokens.size²` pair identities;
- at most 10 completed points per series;
- at most one partial bucket per series.

No raw per-keystroke history is retained after a bucket closes. The exact transition family stores only pair scope, bounded timing points, one bounded partial timing bucket, and a cumulative timing-sample count.

## Analysis V2 rendering

Semantic selected-key detail may show the newest correctness and semantic-timing points.

Low-dimensional coordination cells may show the newest motor-timing points for their own scope.

The exact transition speed network may expose the current cumulative timing/sample support together with recent completed history points for that same directed pair. An empty pair history is a normal state, especially immediately after schema-6 migration; it must be described as missing/accumulating history rather than as a flat trend.

Strategy currently has no progress-history chart because its position and complete-order measurements are cumulative bounded aggregates rather than time series.

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
