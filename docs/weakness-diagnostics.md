# Learning analysis

## Product boundary

The production analysis surface is **Analysis V2**. It separates evidence by meaning instead of presenting one generic weakness dashboard.

There are two presentation levels:

### Information drawer

The existing information drawer remains a lightweight status and settings surface. Its analysis section shows only a compact summary and one `進入分析` action.

The summary reports three independent evidence channels:

- semantic input coverage;
- coordination sample readiness;
- input-strategy position observations.

The drawer does not contain diagnostic tabs, complete lists, relationship graphs, dense filters, or a second motor-diagnostic section.

### Analysis mode

`進入分析` opens a full-viewport modal analysis surface inside the current application. It does not navigate to another route, reload the application, complete the current round, or replace the practice session.

Analysis V2 has exactly three top-level tabs:

1. `語意`
2. `協調`
3. `策略`

These tabs are separate evidence domains. They are not interchangeable views of one global weakness score.

## Evidence boundaries

### Semantic

Semantic analysis answers questions about symbol choice:

- which Bopomofo bindings have accumulated correct or incorrect observations;
- which expected token was confused with which actual token;
- how each binding's bounded correctness and accepted-timing history has changed.

Production semantic evidence is built from the V2 binding/confusion compatibility projection. It deliberately contains no canonical token-pair transition rows.

When an error cannot be attributed to one intended token without guessing, it is not invented as a confusion record.

### Coordination

Coordination analysis uses actual-order Measurement V2 motor aggregates.

Its exact transition-speed evidence is a sparse bounded map of:

```text
previous actually accepted token × current actually accepted token
```

An exact edge is created only from two consecutive accepted events. Its identity and direction are never reconstructed from canonical syllable structure. Dirty, cross-syllable, and entry-boundary observations may remain available as coverage, but only **clean within-syllable** observations become speed samples or visible speed lines.

The same coordination domain also exposes these native low-dimensional families:

- immediate standard-fingering side transition (`left/right × left/right`);
- same-side revisit, separated by whether the opposite side intervened;
- syllable-body coordination, separated by body-size bucket and hand-shape;
- tone commit, separated by tone token.

Different motor families are not ranked against one another by absolute milliseconds. A 90 ms side transition and a 300 ms multi-component syllable span are different measurements, not candidates for one global fastest/slowest ordering.

Exact accepted-token transitions are one homogeneous family, so the speed map may compare their current timing **within that family**. Current presentation uses relative slowness for line colour/opacity and clean sample support for line width. Fewer than five clean samples remain visibly preliminary.

`left` and `right` describe the conventional touch-typing assignment of the physical key. The application does **not** detect which physical hand the learner actually used.

### Strategy

Strategy analysis describes the order in which valid body components were actually accepted.

It uses bounded matrices of:

```text
canonical structural position × actual accepted position
```

for body-size buckets `2`, `3`, and `4+`.

Canonical position is only a structural reference coordinate. It is **not** the required input order, and structural adjacency is never interpreted as an observed motor transition.

For `4+` bodies, middle positions are deliberately coarsened so long-term aggregation remains bounded. The strategy model does not persist raw traces or build token-pair order scores.

## Semantic tab

The semantic tab has two local views.

### Key view

The key view uses the shared physical keyboard geometry and displays standard Bopomofo/tone bindings spatially.

Each mapped key may show:

- mapped observation count;
- error count;
- `錯誤觀察比例`;
- available accepted inter-key timing;
- recent bounded correctness history;
- recent bounded timing history.

The colour/intensity of a key represents only that key's displayed error ratio. It does not combine correctness with timing or motor coordination into one weakness score.

Selecting a key opens its exact cumulative values and recent trend points. Selection is session-only.

### Confusion view

The confusion view is a directional matrix:

```text
row    = expected token
column = actual token
```

`A → B` and `B → A` remain different records. The matrix does not infer an expected token when multiple intended targets are still plausible.

There is no semantic/canonical transition-network overlay in this view. The speed network belongs to coordination and consumes observed accepted-token motor evidence, not confusion or canonical adjacency.

## Coordination tab

The coordination tab starts with `實際鍵間速度`, a keyboard-wide flyline map of clean within-syllable accepted-token transitions.

The flyline contract is:

- a line exists only for an exact token pair with at least one accepted clean timing sample;
- no grammatically possible or canonical `potential` line is synthesized;
- slower exact transitions become visually stronger within the exact-transition family;
- clean sample support controls line width;
- preliminary lines remain lighter/dashed;
- tone-related lines remain visually distinguishable;
- hovering a line exposes its exact `A 到 B`, current milliseconds, and clean sample count;
- the current version deliberately uses **no arrow markers**. Direction remains in the underlying evidence and accessible title, so arrows can be added later without changing measurement semantics.

Below the speed map, each low-dimensional motor family keeps its own matrix or facet. Every cell carries its own:

- observation count;
- clean timing-sample count;
- current timing estimate when available;
- bounded timing history when available;
- readiness state.

A scope becomes ready for normal timing display after the Analysis V2 minimum clean-sample threshold. Insufficient data remains visibly a sampling state rather than being promoted into a pseudo-ranking.

The four low-dimensional sections are:

- `標準指法手別轉換`;
- `同側鍵位再出手`;
- `音節內協調`;
- `聲調完成`.

Copy must preserve the distinction between inferred key-side assignment and detected physical hands.

## Strategy tab

The strategy tab shows one position matrix for each body-size bucket.

Rows are canonical structural positions and columns are actual accepted positions. Counts and within-row percentages describe what the learner actually did while preserving canonical structure only as a coordinate system.

The strategy tab must never imply that the diagonal is automatically correct, that off-diagonal input is an error, or that canonical order is preferred unless a future product rule explicitly establishes such a requirement.

## Shared keyboard geometry

`src/app/keyboard-geometry.ts` owns the full physical keyboard row geometry and key-unit spans used by practice and analysis surfaces.

`tests/app/keyboard-geometry.test.ts` protects:

- physical row order;
- duplicate-code absence;
- quarter-unit span arithmetic;
- standard number-row Bopomofo/tone bindings through the layout contract.

Analysis code consumes this shared geometry directly rather than maintaining a diagnostic-only keyboard definition. `src/app/analysis-v2-speed-network.ts` uses the same geometry only to route observed motor edges; geometry never decides which edges exist.

## Persistence boundary

Exact accepted-token transition aggregates are cumulative sparse Measurement V2 data. Their identity space is bounded by the current valid layout token set squared. No raw keystroke log is persisted for the speed network.

Older V2 records that predate this field load with an empty exact-transition map. They are **not** backfilled from canonical structure, binding timing, or hand-transition aggregates.

Exact transition history is not persisted yet. The speed map therefore shows cumulative current timing and sample support, while the four low-dimensional motor families may also show their bounded progress-history points.

## Progress history

Analysis V2 reads bounded progress history rather than reconstructing an unbounded event log.

Semantic correctness/timing history and low-dimensional motor timing history remain separate series. Recent history supplements cumulative measurements; it does not replace them and is not used to predict future performance.

The persistence and bucket semantics are documented in [diagnostic progress history](./diagnostic-progress-history.md).

## Interaction and accessibility

Opening analysis performs these product actions:

1. close the information drawer;
2. preserve the current practice state;
3. open Analysis V2 in the browser top layer;
4. move focus into the analysis controls.

Closing analysis:

1. cancels any pending open animation frame;
2. closes the browser top layer;
3. returns focus to practice.

A stale open animation frame must never be able to reclaim focus after the analysis has already closed.

The top-level tabs use the WAI-ARIA tab interaction pattern with roving `tabindex` and support:

- Left / Right;
- Home / End;
- pointer activation.

`Escape` closes analysis. While the modal is open, normal practice input remains outside the active top layer.

The active top-level tab and semantic subview are persisted as lightweight UI preferences. Selected semantic keys remain session-only.

## Metric rules

Analysis V2 follows these non-negotiable metric boundaries:

1. correctness, semantic timing, motor timing, confusion counts, and strategy counts are not merged into one score;
2. canonical/catalog order never masquerades as observed physical order;
3. ambiguous intent is not guessed;
4. heterogeneous motor classes are not ranked by raw milliseconds;
5. exact accepted-token transitions may be compared only within their own homogeneous family;
6. insufficient samples are shown as insufficient rather than silently treated as stable estimates;
7. persistent identities are explicitly bounded; raw traces are not retained as long-term learner history.

The semantic key correctness label is `錯誤觀察比例`:

```text
mapped incorrect observations / mapped correct and incorrect observations
```

A correct recovery input after an error is another mapped observation, so this is not a first-attempt error rate.

## Retired interface

The earlier production analysis interface used `按鍵 / 轉換 / 誤按`, an exact token-pair transition list, and a keyboard-wide network whose transition identities and potential mesh were tied to strict/canonical compositional assumptions.

That **legacy transition model and controller** remain retired. Analysis V2 does not restore its transition tab, `轉換總覽` toggle, canonical potential mesh, or diagnostic relationship modules.

The flyline visual language is intentionally reused in a new independent module because it still answers a useful motor question once its evidence is corrected. The V2 speed network receives only actually observed accepted-token edges; it does not inherit the old canonical edge-generation semantics. Historical ADRs may still describe the earlier design and should be read as historical records, not the current product contract.
