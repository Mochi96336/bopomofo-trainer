# Weakness diagnostics

## Product boundary

Weakness diagnostics use two presentation levels.

### Information drawer

The existing 440px information drawer remains a lightweight status and settings surface. Its weakness-diagnostic section contains only:

- the objective aggregate summary;
- one representative key signal;
- one representative transition signal;
- one representative confusion signal;
- one `進入分析` action.

The drawer does not contain diagnostic tabs, complete lists, expanded records, a miniature relationship graph, or dense filter controls. Increasing typography or row density inside the drawer is not an acceptable substitute for a proper analysis layout.

### Analysis mode

`進入分析` opens a full-viewport analysis mode inside the current application. It is not a separate route and does not reload or replace the active practice session.

Analysis mode contains three views:

- `按鍵`: expected-token correctness observations and accepted inter-key timing for one binding;
- `轉換`: exact ordered timing between adjacent tokens inside one syllable;
- `誤按`: directional expected-token to actual-token confusions.

The mode combines spatial keyboard reading, exact lists, sample warnings, selected-item details, and directional SVG relationships. The key and transition views may replace their per-tab paths with one severity-coloured transition overview. The confusion view is mutually exclusive with that overview and always draws its own directional relationships.

Direction, minimum-sample, tone, and first-five/complete-list controls were all removed after review; the only user control over list contents is an optional key selection. Copy must therefore never refer to a chosen "scope" or "range".

## Design principles

1. Preserve the product's quiet typographic and spatial rhythm. Do not solve analytical density by globally enlarging controls or introducing dashboard-style cards.
2. Keep the drawer scannable. It answers whether there is anything worth opening, not every diagnostic question.
3. Give exact values and spatial relationships separate areas. The keyboard explains where; the inspector explains how much and why.
4. Use the existing keyboard sketch as product identity. Analysis mode shares its geometry, perspective, key shape, border language, and theme tokens.
5. Preserve metric distinctions. Correctness, binding timing, transition timing, and confusion counts are not merged into one score.
6. Keep graph and list semantics identical. Spatial overlays use the exact currently rendered selector result from the inspector.
7. Keep practice state in place. Entering analysis pauses input but does not complete, reset, or mutate the current round.
8. Reserve red for actual input errors, with one deliberate exception: the full-network overlay (see below) uses a faint-ink-to-red gradient to make severity itself the reading, since that overlay's entire purpose is to surface weak points at a glance. Everything else — selection, focus, per-tab graph lines, sample warnings — keeps neutral ink emphasis.
9. Treat sufficient data as the normal state. Only `資料不足` and `初步` require visible warning labels.

## Entry and transition

Opening analysis performs one coordinated transition:

1. the information drawer translates out to the right;
2. the practice surface recedes without being destroyed;
3. the analysis keyboard rises into the canvas using a measured FLIP: its actual start rect is read from the practice keyboard hint when visible, or a fallback strip near the bottom of the practice stage when the hint is off, so the motion always originates from a real on-screen position rather than a fixed offset;
4. the inspector enters after the keyboard establishes continuity.

Closing analysis reverses the transition and returns directly to practice. The information drawer does not reopen automatically.

The transition is decorative. With `prefers-reduced-motion: reduce`, the layout changes without translation or scale animation.

While analysis mode is open:

- ordinary practice input is paused;
- background application content is inert;
- focus remains within analysis controls;
- `Escape` closes analysis;
- the current round and unsent input state remain unchanged.

## Desktop layout

Analysis mode uses a full-viewport shell with two content regions; the tabs and exit control live in the inspector's head rather than in a separate header band.

```text
┌───────────────────────────────────────────────────────────────────────┐
│           keyboard analysis canvas          │      inspector rail     │
│                                              │                         │
│ 分析 title · 全網 toggle                      │ [按鍵][轉換][誤按] Esc │
│ shared keyboard geometry, tilt, key shape    │ sort (key tab only)    │
│ key emphasis / full-network relation overlay │ exact list             │
│ selected item context                        │ selected detail        │
│                                              │ count · metric note    │
└───────────────────────────────────────────────────────────────────────┘
```

Recommended desktop proportions:

- keyboard canvas: flexible, never below the width required for readable key geometry;
- inspector rail: `340–400px`;
- overall content width: bounded by the existing product shell rhythm rather than edge-to-edge dashboard spacing.

An earlier draft of this layout reserved a third `190–230px` overview rail (objective counts, a metric explanation, active-scope text, and a data-state legend) to the left of the canvas. Hands-on review found it duplicated the header's summary line and explained a dot legend the UI does not actually use, so it was removed rather than kept as under-used chrome; the one line worth keeping — the active metric's explanation — moved to the foot of the inspector, beside the list it describes. Mobile-specific interaction remains outside this workstream.

## Header

The analysis mode has no separate header band. The canvas carries a short `分析` title (labelled `弱點診斷分析` for assistive technology), and the inspector's own head holds:

- `按鍵 / 轉換 / 誤按` tabs;
- the exit control, labelled `返回練習` for assistive technology and shown as `Esc`.

The objective summary line lives in the drawer, not in analysis mode.

Tabs use the WAI-ARIA tab pattern:

- `role="tablist"`;
- `role="tab"`;
- `role="tabpanel"`;
- roving `tabindex`;
- Left/Right, Home, and End keyboard navigation.

The active tab is persisted. Selected keys and selected relationships remain session-only. Tab activation and overview toggling use the same pure analysis-state transitions for pointer and keyboard input.

## Canvas heading

The objective counts (keys with observations, repeated confusions, slower sufficient-sample transitions) live once, in the drawer summary. The canvas heading carries the `分析` title and the `轉換總覽` toggle described below. The active metric's explanation — including the `錯誤觀察比例` first-attempt limitation note on the key tab — sits with the row count at the foot of the inspector, next to the list it describes.

`資料足夠` remains an internal display state but is not shown as a badge or legend item. Sufficient data is the unmarked normal state; only `資料不足` and `初步` get visible warnings, inline on the rows and detail pane that carry them.

## Keyboard canvas

The keyboard canvas reuses the standard physical layout and the existing sketch language: the same organic key-cap border radius, the same `perspective(520px) rotateX(19deg)` board tilt, and the same F/J home-row notch. Analysis keys are taller than the decorative sketch's, since they must hold a legible symbol and badge that the blank sketch never needed to, but the shape and tilt are not a reinterpretation — they are the sketch's actual values, so the canvas reads as the same keyboard rather than a differently styled cousin of it. Hover and focus states change border colour and text colour only; there is no lift or other transform, matching the sketch's own static key states.

### Shared geometry

`src/app/keyboard-geometry.ts` owns the full keyboard row geometry, physical codes, and key-unit spans. Both the practice sketch and the analysis keyboard consume it. `tests/app/keyboard-geometry-agreement.test.ts` renders both and compares what they drew, so a second source cannot be reintroduced silently.

The analysis keyboard displays only Bopomofo or tone symbols. Physical English labels remain available to assistive technology and in the exact inspector, but do not compete with the central keyboard reading.

The standard number row is fixed by the layout contract and test coverage:

```text
1 ㄅ · 2 ㄉ · 3 ˇ · 4 ˋ · 5 ㄓ · 6 ˊ · 7 ˙ · 8 ㄚ · 9 ㄞ · 0 ㄢ · - ㄦ
```

### Key view

The key view emphasizes the exact keys returned by the active key selector.

- error sorting may display error-observation ratios on emphasized keys;
- timing sorting may display accepted inter-key time on emphasized keys;
- selecting a key synchronizes the inspector detail;
- keys without observations remain visually available but subdued;
- rank or metric intensity may change emphasis, but does not imply a combined weakness score.

### Transition view

When the transition overview is off, the transition view displays endpoints and directional SVG paths from the exact currently filtered transition rows.

- the selected key and the fixed sample gate affect both list and graph;
- opposite directions remain separate paths;
- selecting a path selects the corresponding inspector row;
- hover and focus synchronize between path and row.

### Confusion view

The confusion view always uses its separate directional SVG overlay. Entering this tab turns the transition overview off at the analysis-state boundary, including when a selected key had only made that overview appear temporarily hidden.

- expected and actual direction remain explicit;
- opposite directions remain separate records and paths;
- path and inspector selection remain synchronized.

### Full-network overlay

The `轉換總覽` toggle sits in the canvas heading. It is on by default when analysis opens in the key or transition view, but opens off when the persisted or requested view is confusion. It draws the **transition** mesh at once — unranked, sample-gate-free, and with no selection state — as one keyboard-wide relationship network. Enabling it while confusion is active returns to the transition tab and clears selections that would immediately suppress the overview. This intentionally supersedes an earlier constraint in this document: these paths' colour is not neutral ink.

Two path kinds appear:

- every measured transition;
- every transition Bopomofo's fixed compositional order permits that has no measurement yet, drawn as a faint `potential` path with no hover title.

Confusions are **not** part of this overlay; they are drawn only in the confusion tab with the overview off. Copy for the toggle must not promise otherwise.

Measured path colour and prominence are driven by severity, `0` to `1`. Transition severity has no error-rate equivalent, so it is slowness against `DIAGNOSTIC_POLICY.transitionTimingBandsMs` (`0` at or below `medium`, `1` at or above `slow`).

Severity interpolates stroke colour from `var(--ink-muted)` to `var(--danger)`, and scales both opacity (`0.2`–`0.75`) and width (`1.1`–`2.5`) — a faint thin ink line for a low-severity relation, a thicker red one for a high-severity relation. Network paths are decorative and not part of the tab order: they carry a title on hover for sighted mouse users, but the accessible reading of the same data remains the per-tab inspector list, one click away via the toggle. When there is no transition to draw at all, the canvas shows a short inline notice instead of silently rendering nothing, so the toggle's effect is never mistaken for missing functionality.

Turning `轉換總覽` off restores the per-tab behaviour of the current key or transition view. Entering confusion performs the same close operation as part of the tab transition rather than asking the rendering enhancement to repair the DOM afterward.

### Relationship routing

Relationship paths use:

- SVG rather than Canvas;
- deterministic cubic paths derived from shared keyboard geometry;
- explicit arrow direction;
- separate higher, dashed routing for tone relations.

Per-tab paths (network overlay off) additionally use stable sample-count width tiers, neutral ink styling, and hover/click/keyboard-focus/list synchronization. They are built from the exact rows the inspector listed, after the selectors have applied the key selection and the fixed sample gate — the panel hands those rows, the selection and the mesh's visibility to the overlay as it renders, rather than the overlay recovering them from the rendered markup. The list buttons are still located in the DOM, but only to wire hover and activation between each path and its row.

## Inspector rail

The inspector rail is the exact-reading surface.

It contains, from top to bottom:

1. tabs and the exit control;
2. the sort control, on the key tab only;
3. exact rows, always the complete list;
4. one persistent selected-item detail pane;
5. the row count and the active metric's explanation.

Rows do not expand into long inline blocks. Selecting a row updates the detail pane, preserving list position and comparison context.

### Key inspector

The key list supports:

- sort by `錯誤觀察比例`;
- sort by `有效鍵間時間`;
- selected-key synchronization with the keyboard.

Keys with no observations are omitted from the list; the empty state is `尚無按鍵資料。`

The detail pane shows:

- attempts and errors;
- visible warnings only when error or timing data is insufficient or preliminary;
- accepted timing and best timing;
- all four timing exclusion counters;
- current frequency-first expected-token influence and reason;
- a `最近變化` section holding the bounded correctness and timing history charts.

`最近變化` sits below the exact cumulative values and never replaces them. The two metrics keep separate charts, separate axes, and separate values; they are never combined into one score or one dual-axis chart. Its full contract — bucket semantics, bounded persistence, the trend dead zone, empty states, and the no-prediction boundary — is in [diagnostic progress history](./diagnostic-progress-history.md).

### Transition inspector

The transition list is filtered only by an optional key selection, in both directions, tones included. One fixed gate remains: a transition is listed once it reaches `DIAGNOSTIC_POLICY.relationshipSamples.preliminary` accepted samples, so the empty state must distinguish three real situations rather than blaming a scope the learner never chose:

| Situation | Copy |
| --- | --- |
| A key is selected and has nothing listable | `ㄌ 相關的轉換尚無足夠資料。` |
| No selection, no transitions recorded at all | `尚無轉換資料。` |
| No selection, transitions exist but none reach the gate | `同一組轉換累積 3 次有效輸入後才會顯示；目前資料仍不足。` |

The detail pane shows exact direction, current and best accepted timing, sample count, and any non-sufficient sample warning.

### Confusion inspector

The confusion list is filtered only by an optional key selection, in both directions. It has no sample gate — a confusion is listed from its first occurrence — so its copy must not promise a threshold:

| Situation | Copy |
| --- | --- |
| A key is selected and has none | `ㄌ 目前沒有誤按紀錄。` |
| No selection, none recorded | `尚無誤按資料。` |

The detail pane shows exact expected and actual keys, occurrences, expected-token confusion total, expected-error share, and any non-sufficient sample warning.

## Drawer summary contract

The drawer summary uses the same model and selectors as analysis mode.

It may display:

- objective aggregate text such as `24 鍵有資料 · 2 組重複誤按 · 8 組慢轉換`;
- the first error-sorted key row with its ratio and sample count;
- the first sufficient-sample transition row with timing;
- the first confusion row with occurrences;
- `進入分析`.

It must not introduce subjective counts such as `3 個值得注意的按鍵` unless a future formal attention policy defines that set.

## Separate metrics

Correctness and timing remain separate observations. The interface may use an overall conservative data state to decide whether a warning is needed, but it never combines metrics into a mastery or weakness score. This holds for progress history too: the two series are never merged into a mastery, weakness, skill, confidence, or progress score.

The key correctness label is `錯誤觀察比例`:

```text
mapped incorrect observations / mapped correct and incorrect observations
```

A correct recovery input after an error is another mapped observation. Therefore this ratio is not a first-attempt error rate, and the interface states that limitation explicitly.

The key timing label is `有效鍵間時間`. It is the current exponential moving average of accepted timing observations, not a validated ability score. Syllable starts, incorrect input, recovery input, and interaction-noise-contaminated intervals remain excluded.

A binding with no catalog position that can produce accepted motor timing is marked `不適用`, rather than being shown permanently as if more samples alone would make timing available.

## Data-state policy

Display thresholds are centralized in `src/diagnostics/policy.ts`:

| Metric | Preliminary | Sufficient |
| --- | ---: | ---: |
| Error observations | 3 attempts | 8 attempts |
| Binding timing | 3 accepted samples | 5 accepted samples |
| Transition/confusion relation | 3 observations | 5 observations |

Below the preliminary threshold, the state is `資料不足`. Between thresholds it is `初步`. Both receive visible warnings. Sufficient rows are unmarked.

These are product display gates, not statistical confidence intervals.

## Selection influence

The selected-key detail explains the browser's actual frequency-first selection influence, not the older single-focus curriculum state.

For one expected token, the diagnostic applies the same public policy inputs used by production selection:

- `minimumBindingAttempts` gates the error contribution;
- `minimumBindingTimingSamples` gates the timing contribution;
- current timing is compared with that token's own best accepted timing;
- current error and timing influence settings scale their respective contributions;
- the result is capped by `maximumExpectedTokenBoost`.

The user-facing states are:

- `尚未達選題門檻`;
- `目前無額外加權`;
- `選題加權中`.

This is an explainable selection modifier, not a claim that the key is being trained at a guaranteed rate. Candidate frequency, grammar compatibility, other learner evidence, recent-use penalties, and the combined learner cap still affect final utterance selection.

## Directional relationships

Transitions retain exact order:

```text
ㄓ → ㄨ  !=  ㄨ → ㄓ
```

They are created only from clean correct adjacent tokens inside one syllable. They never cross syllable, entry, or utterance boundaries.

Confusions also retain exact direction:

```text
expected ㄢ, actual ㄤ  !=  expected ㄤ, actual ㄢ
```

The displayed share is:

```text
pair occurrences / all confusion occurrences for the same expected token
```

Measurement policy `phase-3-v2` gives confusion its own observation contexts. Mapped incorrect syllable-start, within-syllable, and tone inputs contribute to confusion, while motor timing remains narrower.

## Presentation model

Browser UI code does not read measurement aggregates directly. `src/diagnostics/build-model.ts` joins:

- cumulative measurement aggregates;
- the standard physical-key layout;
- catalog support used to distinguish available and non-applicable timing;
- the current frequency-first selection policy, including user-selected influence scales.

`src/diagnostics/selectors.ts` owns deterministic sorting, selected-key filtering, sample gates, and the first-five limit still used for the drawer's representative signals. Drawer signals, inspector lists, and keyboard emphasis consume these selectors. The temporary relationship enhancement consumes the exact rendered inspector result so graph and list cannot diverge in visible scope.

`src/app/diagnostic-analysis-state.ts` owns the analysis view-mode invariants. The panel asks it to open, select a tab, compute effective overview visibility, and toggle the transition overview. The relationship enhancement remains render-only and never changes tabs, preferences, or selections in response to DOM mutations.

## Persistence

The measurement-contract change rotated Pilot history to schema 3; product progress has since rotated on to schema 6. Older generations are rejected rather than partially migrated, so aggregates with different confusion semantics are never mixed.

Bounded per-key progress history uses its own independent key:

```text
bopomofo-trainer.progress-history.v1
```

It is deliberately not part of `ProductProgress`: adding it there would bump the progress schema and, under this repository's delete-rather-than-migrate rule, discard every existing learner's cumulative aggregates to add a feature that has no history to show them yet. Existing learners keep their aggregates and begin accumulating history from this version. See [diagnostic progress history](./diagnostic-progress-history.md).

Diagnostic UI preferences use the independent key:

```text
bopomofo-trainer.diagnostics.v1
```

The browser retains the active tab, the key-list sort, and the full-network toggle. Selected keys, selected relationships, hover state, and detail selection are session-only. `confusion + networkOverlay` is not a valid live view state: opening or entering confusion normalizes the overlay off, and enabling the overlay from confusion changes the active tab to transition.

The previously implemented drawer-expansion preference is retained only until the analysis-mode preference cleanup; the final drawer summary is not collapsible.

## Known gaps

These are real, currently true shortcuts, not planned features:

- the browser suite is a smoke test rather than coverage: it holds the platform behaviour jsdom cannot produce, and the rest of the manual protocol is still manual.

Closed since this list was written: the analysis composes its model from the running shell's `getDiagnosticSnapshot()` instead of from mirrored localStorage; the relationship overlay is given the visible rows rather than reading them back out of the DOM; the practice sketch renders from the shared keyboard geometry; and a Chromium smoke suite runs in CI.

## Validation

Every milestone runs:

```text
npm run typecheck
npm run test:fast
npm run test:source-adapters
npm run catalog:validate
npm run build
```

Additional coverage locks:

- measurement semantics and generation rejection;
- diagnostic model and deterministic selectors;
- preference validation;
- diagnostic analysis view-mode invariants and transition/confusion exclusivity;
- shared keyboard row geometry and number-row labels;
- exact keyboard relationship coordinates;
- deterministic directional routing, reverse-direction separation, selection, and tone marking.

## Non-goals

This workstream does not provide:

- a combined weakness or mastery score;
- first-attempt error rate;
- statistical confidence intervals;
- predicted mastery dates, remaining-lesson counts, unlock models, or any forward extrapolation of a trend;
- transition or directional-confusion history (deferred with a documented extension point);
- cross-user comparison;
- ergonomic causal inference;
- mobile-specific interaction design;
- route-level navigation or server persistence.
