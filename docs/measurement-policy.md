# Input-order v2 measurement policy

## Purpose

The production measurement pipeline now separates **semantic evidence** from **observed motor evidence**. Canonical Bopomofo token order remains useful catalog structure, but it is no longer treated as the order a learner must physically type.

The current aggregate policy is versioned as `input-order-v2-aggregate-1` in `src/measurement-v2/aggregate.ts`. Raw interaction semantics live in `InteractionTraceV2`; projection lives in `src/measurement-v2/derive-observations.ts`.

The older `src/measurement/` Phase 3 implementation remains only for archived research and a narrow semantic compatibility view. Production motor measurement must not derive timing from its token-pair transition channel.

## Input semantics

Within one syllable:

- non-tone body components may be completed in any order;
- a completed body component stays completed;
- the tone is an explicit commit and is accepted only after every body component is complete;
- repeating an already completed component is `duplicate-component`;
- a tone before body completion is `premature-tone`;
- a mapped token outside the remaining body is unexpected input.

An incorrect mapped input receives an expected-token attribution only when one target is unambiguous. If several body components remain, the system records an ambiguous error instead of manufacturing an expected-to-actual confusion pair.

## Semantic observations

### Binding

A successfully matched token produces binding success evidence for:

```text
practice mode + layout ID + token
```

An error updates a token binding only when `attributedExpectedToken` is known. This means freedom of body order does not create false errors for tokens that happened to appear earlier in canonical notation.

Clean binding timing is based on actual accepted-event timing. Start, recovery, and noise-affected intervals are excluded from clean timing while correctness evidence can still be retained where semantically valid.

### Confusion

A confusion observation exists only when the system can state both:

```text
expected token
actual token
```

without guessing user intent. Ambiguous errors, duplicate components, and premature tones are counted separately rather than forced into the confusion matrix.

## Motor observations

Motor observations are derived from actual accepted event order and physical-key ergonomics.

### Syllable coordination

Measures the span from the first accepted body component to the last accepted body component. The aggregate identity is deliberately coarse:

```text
body-size bucket × hand shape
```

Body-size buckets are `2`, `3`, and `4+`. Hand shape is `left-only`, `right-only`, `mixed`, or `unknown`.

### Immediate hand transition

Looks only at consecutive accepted physical events. Aggregate identity is one of four assigned-hand paths:

```text
L → L
L → R
R → L
R → R
```

It does not use canonical token adjacency.

### Same-hand revisit

For each accepted event, the system may look back to the previous accepted event assigned to the same hand, even across syllable or entry boundaries. The measurement is a **revisit interval**, not a claim that the two keys were consecutive or that the entire interval was finger travel time.

Aggregate identity is intentionally limited to:

```text
hand × whether the opposite hand intervened
```

Boundary class stays observation metadata and is not multiplied into the aggregate key.

### Tone commit

Measures from the last accepted body component to the accepted tone. Tone commit is separate from body coordination because the tone acts as syllable completion rather than another freely ordered body component.

## Noise and recovery

Repeats, modifier-only shortcuts, composition events, unmapped input, and mapped errors remain explicit trace events. Timing observations affected by intervening noise or recovery are marked dirty or excluded from clean timing instead of silently being treated as ordinary motor samples.

Raw evidence is kept more expressive than aggregate identity so policy can evolve without inventing precision that the sample count does not support.

## Bounded aggregation

Observation records may contain token, physical code, hand, boundary, syllable, and timing information together. These fields **must not automatically form a Cartesian-product skill identity**.

Production aggregate cardinality is intentionally bounded:

- immediate hand: at most 4 scopes;
- same-hand revisit: at most 4 scopes;
- coordination: at most 12 scopes;
- tone commit: tone identity only.

Exact token-pair, physical-key-pair, finger, distance, and boundary-cross-product motor aggregates are not part of this policy.

The current timing smoother remains an exponential moving average with alpha `0.25`; the first clean sample initializes the estimate. Best clean timing is retained separately.

## Structural adjacency is not motor evidence

Canonical catalog adjacency is exposed explicitly as `StructuralAdjacencyOccurrence` in `src/relations/structural-adjacency.ts`.

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

A learner may nevertheless type the body as:

```text
ㄝ → ㄩ → ㄒ → ˊ
```

The first sequence is structural evidence. The second is observed motor order. They must never share statistical meaning.

Existing selection and legacy semantic diagnostics receive a compatibility view containing V2 binding/confusion evidence and an intentionally empty legacy transition record.

## Persistence

Product progress schema 7 uses measurement epoch `coordination-v1`.

Schema 6 progress may retain compatible identity and history state during migration, but legacy measurement evidence is reset. Old strict-order errors, confusions, and transitions cannot safely be reinterpreted under unordered syllable semantics.

Persisted V2 aggregates are validated independently, including key/scope consistency and bounded motor identities.

## Curriculum boundary

Current adaptive selection may consume semantic binding evidence. Motor coordination aggregates are diagnostic-only in this version.

A future motor-driven curriculum must explicitly define how an exercise causes or encourages a motor objective. Selecting a word that canonically contains `A → B` is not sufficient evidence that the learner will physically perform `A → B` when body order is free.

## What the model can claim

The current model can state:

- which token binding was successfully completed;
- a confusion pair when intended target attribution is unambiguous;
- how long a syllable body took to coordinate;
- which assigned-hand path occurred between consecutive accepted events;
- when the same hand was used again and whether the other hand intervened;
- tone-commit timing;
- why an observation was excluded from clean timing.

It does **not** claim:

- that canonical token order is required typing order;
- that an ambiguous wrong key reveals which remaining token the learner intended;
- that same-hand revisit duration equals pure finger movement time;
- that one exact token pair is weak from only a few samples;
- that motor aggregates should already drive curriculum selection.
