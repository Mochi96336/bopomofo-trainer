# Input-order V2 measurement policy

## Purpose

The production measurement pipeline separates **semantic evidence**, **input-order strategy evidence**, and **observed motor evidence**. Canonical Bopomofo order remains catalog structure; it is not treated as the order a learner must physically type.

The current aggregate policy is `input-order-v2-aggregate-5` in `src/measurement-v2/aggregate.ts`. Raw interaction semantics live in `InteractionTraceV2`; `src/measurement-v2/derive-observations.ts` projects traces into Measurement V2 observations; `src/measurement-v2/timing-eligibility.ts` owns clean-timing eligibility.

The older `src/measurement/` implementation remains for legacy research/simulation callers. Production progress, Analysis V2, and formal-syntax selection do not convert Measurement V2 back into a legacy `MeasurementSummary`.

## Input semantics

Within one syllable:

- non-tone body components may be completed in any valid order;
- a completed body component stays completed;
- the tone is an explicit commit and is accepted only after every body component is complete;
- repeating an already completed component is `duplicate-component`;
- a tone before body completion is `premature-tone`;
- a mapped token outside the remaining body is unexpected input.

An incorrect mapped input receives an expected-token attribution only when one target is unambiguous. If several body components remain, the system records an ambiguous error instead of manufacturing an expected-to-actual confusion pair.

## Semantic evidence

### Binding

Binding identity is:

```text
practice mode + layout ID + expected token
```

A successfully matched token records correct binding evidence. An error updates a binding only when `attributedExpectedToken` is known, so free body order cannot create false errors for tokens that merely appear earlier in canonical notation.

Binding timing is accepted-event timing. Start intervals, recovery intervals, and intervals contaminated by interaction noise do not update the clean timing estimate, although semantically valid correctness evidence may still be retained.

### Confusion

A confusion observation exists only when both sides can be stated without guessing:

```text
expected token → actual mapped token
```

The expected token belongs to current catalog support. The actual token is validated against the legal Bopomofo input-token domain rather than current catalog support, because a learner may legitimately press a mapped key whose token is not present in the currently narrowed catalog. Ambiguous errors, duplicate components, and premature tones remain separate counters.

## Strategy evidence

Strategy records how valid body components were actually accepted while preserving canonical position only as a reference coordinate.

Standard Bopomofo bodies have at most initial + medial + final, so the current long-term strategy domain is complete at body sizes `2` and `3`.

### Position observations

Each accepted body component may contribute:

```text
body size × canonical position × accepted position
```

The bounded position labels are `first`, `middle`, and `last`; two-part bodies use only `first` and `last`.

### Complete order

Three-part bodies additionally retain the complete accepted-order permutation. This joint channel distinguishes paths that position marginals alone cannot distinguish.

### Recent trajectories

Clean completed two- and three-part words may contribute recent time-aware trajectories. The first accepted body component is `t=0`; later components store elapsed milliseconds from that first event. At most 80 recent clean trajectories are retained independently for each body size.

## Motor evidence

Motor observations are derived from actual accepted-event order. Canonical adjacency never creates a motor edge.

### Syllable coordination

Coordination measures the clean span from the first accepted body component to the last accepted body component. Aggregate identity is the actual Bopomofo body structure:

```text
initial-medial
initial-final
medial-final
initial-medial-final
```

This is intentionally separate from hand-transition evidence.

### Exact accepted-token transition

`immediateTokens` records consecutive actually accepted tokens as directed pairs:

```text
from token → to token
```

Boundary class stays on the observation. Only clean `within-syllable` observations update pair timing. The persisted map is sparse and bounded by the valid token domain squared; no canonical or potential pair is synthesized.

### Immediate hand transition

Consecutive accepted physical events are projected to the conventional keyboard-side assignment:

```text
L → L
L → R
R → L
R → R
```

This is standard-fingering geometry, not detection of the learner's physical hand. Only clean `within-syllable` observations update timing.

### Same-hand revisit

Within one syllable, the model may measure the time from a previous accepted event on one assigned side to a later accepted event on that same side. The opposite side may or may not intervene; that distinction is part of aggregate identity:

```text
side × opposite side intervened
```

The final accepted tone may complete a revisit. Revisit state resets at syllable completion and never crosses into the next syllable.

### Tone commit

Tone commit measures from the last accepted body component to the accepted tone. Aggregate identity is the tone token. It remains separate from body coordination because the tone is a commit event rather than another freely ordered body component.

## Timing eligibility and noise

Repeats, modifier-only shortcuts, composition events, unmapped input, and mapped errors remain explicit trace events. A timing interval affected by intervening noise or recovery is marked ineligible rather than silently becoming an ordinary motor sample.

The same eligibility helpers are reused by cumulative Measurement V2 aggregation and bounded progress history. UI code does not independently reinterpret clean timing.

The cumulative timing smoother is an exponential moving average with alpha `0.25`; the first eligible sample initializes the estimate. Best eligible timing is retained separately.

## Bounded aggregation

Raw observations can carry more detail than persistent skill identity. Those fields must not automatically form a Cartesian-product aggregate.

Current persistent cardinality is intentionally bounded:

- strategy positions: at most 13 valid scopes;
- three-part permutations: at most 6 scopes;
- recent strategy trajectories: at most 80 per body size;
- coordination: at most 4 body-shape scopes;
- immediate hand: at most 4 scopes;
- same-hand revisit: at most 4 scopes;
- tone commit: tone identity only;
- exact accepted-token transitions: sparse, bounded by valid token count squared.

Physical-key-pair, finger, distance, and boundary-cross-product aggregates are not persistent Measurement V2 skill identities.

## Structural adjacency is not motor evidence

For a canonical syllable such as:

```text
ㄒ ㄩ ㄝ ˊ
```

catalog structure may contain:

```text
ㄒ → ㄩ
ㄩ → ㄝ
ㄝ → ˊ
```

A learner may instead type the body as:

```text
ㄝ → ㄩ → ㄒ → ˊ
```

The first sequence is structural evidence. The second is observed motor order. They must never share statistical meaning.

## Persistence

Product progress schema 7 uses measurement epoch `coordination-v1`.

Schema 6 progress may retain compatible identity, completed-round count, curriculum recency, and selection continuity during migration, but measurement-derived evidence does not cross the strict-order → unordered-input epoch boundary. Cumulative measurements and recent round measurement summaries reset.

Measurement V2 aggregate migrations validate old identities before preserving, transforming, or deliberately discarding evidence whose semantics changed. Current persistence accepts the historical aggregate generations needed for migration but always returns the current `input-order-v2-aggregate-5` shape.

Progress-history schema 8 stores bounded semantic timing/correctness history and bounded motor history, including exact accepted-token transition history. Historical points are never manufactured from a cumulative aggregate.

## Curriculum boundary

Production formal-syntax selection consumes Measurement V2 **semantic binding aggregates directly** through the curriculum-owned `LearnerBindingEvidence` contract. It has no Measurement V2 motor-transition input and does not rebuild a legacy `MeasurementSummary`.

Legacy/research selection may still use the old `src/measurement/` transition semantics through its separate API. That compatibility path is not a production Measurement V2 adapter.

Motor evidence is diagnostic-only in the current production curriculum. A future motor-driven curriculum must explicitly define how an exercise causes or encourages a motor objective; canonical occurrence of `A → B` is not evidence that free-order input will physically execute `A → B`.

## What the model can claim

The current model can state:

- which token binding was successfully or incorrectly observed when attribution is unambiguous;
- a directional confusion pair when intended target attribution is unambiguous;
- how valid body components were actually ordered;
- recent clean two- and three-part input trajectories;
- clean syllable-body coordination by Bopomofo body shape;
- exact directed accepted-token transition timing from actual within-syllable events;
- conventional keyboard-side transition timing;
- same-side revisit timing and whether the opposite side intervened;
- tone-commit timing;
- why a candidate timing interval was ineligible for a clean aggregate.

It does **not** claim:

- that canonical token order is required typing order;
- that an ambiguous wrong key reveals which remaining token the learner intended;
- that a boundary-crossing interval equals pure hand or finger movement time;
- that conventional keyboard-side assignment detects the learner's actual physical hand;
- that heterogeneous motor families can be ranked together by raw milliseconds;
- that motor aggregates should already drive curriculum selection.
