# Learning analysis

## Product boundary

The production analysis surface is **Analysis V2**. It separates evidence by meaning instead of presenting one generic weakness score.

There are two presentation levels.

### Information drawer

The existing information drawer remains a lightweight status and settings surface. Its analysis section shows a compact summary and one `進入分析` action.

The summary reports independent evidence channels rather than reconstructing the full analysis UI inside the drawer.

### Analysis mode

`進入分析` opens a full-viewport modal analysis surface inside the current application. It does not navigate, reload the app, complete the current round, or replace practice state.

Analysis V2 has exactly three top-level tabs:

1. `語意`
2. `協調`
3. `策略`

These are separate evidence domains, not interchangeable views of one global weakness score.

## Evidence boundaries

### Semantic

Semantic analysis answers questions about symbol choice:

- which Bopomofo bindings have accumulated correct or incorrect observations;
- which expected token was confused with which actual mapped token;
- how bounded correctness and accepted-binding timing history have changed.

Production semantic evidence is projected directly from `MeasurementSummaryV2.semantic` by `src/app/analysis-v2-semantic-model.ts`. Analysis V2 does not convert V2 evidence through a legacy `MeasurementSummary` or through the retired diagnostic transition model.

Production formal-syntax selection also consumes V2 semantic binding aggregates directly through the curriculum-owned `LearnerBindingEvidence` contract. The old `src/measurement/` transition semantics remain only on legacy/research selection APIs; there is no production Measurement V2 → legacy selection adapter.

When an error cannot be attributed to one intended token without guessing, it is not invented as a confusion record.

### Coordination

Coordination analysis uses actual-order Measurement V2 motor aggregates.

Its exact transition-speed evidence is a sparse bounded map of:

```text
previous actually accepted token → current actually accepted token
```

An exact edge originates only from two consecutive accepted events. Identity and direction are never reconstructed from canonical syllable structure. Dirty or boundary-crossing observations may remain as coverage, but only clean **within-syllable** observations update exact-pair timing.

The same coordination domain exposes four low-dimensional motor families:

- immediate conventional keyboard-side transition (`left/right × left/right`);
- same-side revisit, separated by whether the opposite side intervened;
- syllable-body coordination, separated by Bopomofo body shape;
- tone commit, separated by tone token.

Body coordination identities are:

```text
initial-medial
initial-final
medial-final
initial-medial-final
```

Different motor families are not ranked against one another by absolute milliseconds. A side transition and a multi-component syllable span measure different actions.

Exact accepted-token transitions are one homogeneous family. The speed map may compare current timing within that family after the per-edge evidence threshold is met. Line strength represents relative slowness within the visible exact-transition family, and line width represents clean sample support. If the sparse network grows dense, the current renderer keeps at most 36 highest-support ready edges rather than synthesizing or displaying a complete mesh.

`left` and `right` describe conventional touch-typing assignment of physical keys. The application does **not** detect which physical hand the learner actually used.

### Strategy

Strategy analysis describes the order in which valid body components were actually accepted.

The current persistent strategy domain is complete at body sizes `2` and `3`. Standard Bopomofo has at most initial + medial + final; obsolete `4+` buckets are migration-only legacy data and are not part of the current aggregate policy.

Position evidence uses bounded matrices of:

```text
canonical structural position × actual accepted position
```

Canonical position is only a structural coordinate. It is not the required input order, and off-diagonal input is not an error.

Three-part bodies also retain complete accepted-order permutations so different joint paths are not collapsed into identical position marginals. Recent clean two- and three-part words may additionally contribute bounded time-aware trajectories from the first accepted body component (`t=0`) to later accepted components.

## Semantic tab

The semantic tab has local views for key-level evidence and directional confusion evidence.

### Key view

The key view uses shared physical keyboard geometry and displays standard Bopomofo/tone bindings spatially.

A mapped key may expose:

- mapped observation count;
- error count;
- `錯誤觀察比例`;
- available accepted-binding timing;
- recent bounded correctness history;
- recent bounded timing history.

The colour/intensity of a key represents only its displayed error ratio. Correctness, semantic timing, and motor coordination are not merged into one score.

Selecting a key opens its cumulative values and recent trend points. Selection is session-only.

### Confusion view

The confusion view is directional:

```text
row    = expected token
column = actual token
```

`A → B` and `B → A` remain different records. The projector filters confusion aggregates to the active practice mode and layout before computing display totals. It does not infer an expected token when multiple intended targets are still plausible.

A persisted confusion's expected token must belong to current catalog support. Its actual token is a valid mapped Bopomofo input token and may legitimately be outside a narrowed catalog support set; pressing such a key must not make the persisted progress unreadable.

There is no semantic/canonical transition-network overlay. The speed network belongs to Coordination and consumes observed accepted-token motor evidence.

## Coordination tab

The default Coordination view starts with `實際鍵間速度`, a keyboard-wide flyline map of ready clean within-syllable accepted-token transitions.

The flyline contract is:

- an edge is based only on an exact actually observed directed token pair;
- a visible comparison line requires the Analysis V2 readiness threshold (currently five clean timing samples and a current timing estimate);
- no grammatically possible or canonical `potential` line is synthesized;
- visible edges are support-limited rather than allowed to form an unreadable dense mesh;
- slower visible exact transitions become visually stronger within the exact-transition family;
- clean sample support controls line width;
- tone-related lines remain visually distinguishable;
- hover/focus previews the exact pair, current milliseconds, clean sample count, and that pair's bounded timing history;
- click/keyboard activation pins one pair while later hover remains transient;
- direction remains in evidence and accessible labeling; the current visual deliberately uses no arrow markers.

The alternate movement view presents the low-dimensional motor families with renderer-owned line art and per-family statistics. Movement artwork is keyed by stable family identity, not DOM order or post-render title scanning.

Each low-dimensional row carries its own:

- observation count;
- clean timing-sample count;
- current comparable timing when ready;
- bounded timing history when available;
- readiness/sampling state.

Insufficient data remains sampling data rather than being promoted into a pseudo-ranking.

## Strategy tab

The Strategy tab can inspect two- or three-component bodies. It combines structural-position evidence with recent clean input trajectories for the selected body size; three-part data may also use complete-order permutation evidence.

Counts and within-row percentages describe what the learner actually did while preserving canonical structure only as a coordinate system. The trajectory horizontal axis is elapsed time from the first accepted body component, not wall-clock time.

The Strategy UI must never imply that diagonal/canonical order is automatically correct or preferred.

## Shared keyboard geometry

`src/app/keyboard-geometry.ts` owns physical keyboard row geometry and key-unit spans used by practice and Analysis surfaces.

Analysis consumes that shared geometry rather than maintaining a diagnostic-only keyboard definition. `src/app/analysis-v2-speed-network.ts` uses geometry only to route already-observed motor edges; geometry never decides which edges exist.

## Persistence boundary

Semantic cumulative evidence comes directly from bounded `MeasurementSummaryV2.semantic.bindings` and `.confusions`. The Analysis projector adds labels, display readiness, and bounded history presentation; it does not create a second stored semantic model.

Exact accepted-token transition aggregates are cumulative sparse Measurement V2 data. No raw keystroke log is persisted for the speed network. Older V2 records that predate exact-token evidence load that channel empty rather than being backfilled from canonical structure, binding timing, or hand-transition aggregates.

Progress-history schema 8 persists bounded timing history for exact accepted-token pairs as well as the low-dimensional motor families. Exact-pair history uses the same directed pair identity and clean within-syllable timing eligibility as the cumulative pair aggregate. Older history schemas migrate with an empty exact-pair history because historical bucket order cannot be reconstructed from a cumulative value.

## Progress history

Analysis V2 reads bounded progress history rather than reconstructing an unbounded event log.

Stored history includes:

- per-key semantic correctness history;
- per-key accepted-binding timing history;
- exact accepted-token transition timing history;
- body coordination timing history;
- immediate keyboard-side timing history;
- same-side revisit timing history;
- tone-commit timing history.

Input-order position/permutation evidence and recent strategy trajectories are not converted into a separate trend series.

Recent history supplements cumulative measurements; it does not replace them and is not a prediction model. The bucket and migration semantics are documented in [Analysis progress history](./diagnostic-progress-history.md).

## Render and interaction ownership

Analysis V2 rendering is split by responsibility:

- `analysis-v2-panel.ts` owns dialog-level interaction state, tab/subview selection, pin state, focus restore, and delegated events;
- semantic / coordination / strategy renderers own their complete synchronous markup;
- `analysis-v2-speed-preview.ts` owns transient hover/focus preview state, not persistent pin state;
- `analysis-v2-integration.ts` owns app integration, browser top-layer mounting, and transition from practice into Analysis.

Renderers must not depend on a `MutationObserver`, DOM index, visible title text, or a later DOM patch to complete production markup.

## Interaction and accessibility

Opening Analysis:

1. closes the information drawer;
2. preserves current practice state;
3. opens Analysis V2 in the browser top layer;
4. moves focus into Analysis controls.

Closing Analysis:

1. cancels any pending open animation frame;
2. closes the browser top layer;
3. returns focus to practice.

A stale open animation frame must never reclaim focus after Analysis has already closed.

Top-level tabs use the WAI-ARIA tab interaction pattern with roving `tabindex` and support Left / Right / Home / End plus pointer activation. `Escape` closes Analysis. While the modal is open, normal practice input remains outside the active top layer.

The active top-level tab and semantic subview are lightweight persisted UI preferences. Selected keys and pinned exact relations remain session interaction state rather than learner measurement data.

## Metric rules

Analysis V2 follows these non-negotiable boundaries:

1. correctness, semantic timing, motor timing, confusion counts, and strategy counts are not merged into one score;
2. canonical/catalog order never masquerades as observed physical order;
3. ambiguous intent is not guessed;
4. heterogeneous motor classes are not ranked by raw milliseconds;
5. exact accepted-token transitions may be compared only within their homogeneous family;
6. insufficient samples are shown as insufficient rather than silently treated as stable estimates;
7. persistent identities are explicitly bounded; raw traces are not retained as long-term learner history.

The semantic correctness label `錯誤觀察比例` means:

```text
mapped incorrect observations / mapped correct and incorrect observations
```

A correct recovery input after an error is another mapped observation, so this is not a first-attempt error rate.

## Retired interface

The earlier production analysis interface used `按鍵 / 轉換 / 誤按`, a legacy exact token-pair transition list, and a network whose transition semantics were tied to strict/canonical compositional assumptions.

That legacy transition model/controller remains retired. Analysis V2 does not restore its transition tab, canonical potential mesh, or diagnostic relationship modules.

The flyline visual language is reused in an independent V2 module because it becomes valid once its input is actual accepted-token motor evidence. Historical ADRs may still describe earlier designs and should be treated as historical records rather than current production contracts.
