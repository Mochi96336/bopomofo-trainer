# Frequency-first grammatical utterance policy

## Product decision

The browser product selects complete grammar-valid utterances. It does not first choose a weak relation and then search for arbitrary supporting words, and it never pads a round with unrelated lexical items.

Selection order is:

1. sample a bounded derivation rooted at the formal `Sentence` category;
2. fill each lexical slot only from compatible admitted syntax profiles;
3. give compatible entries and the completed utterance a frequency base;
4. add bounded learner-specific weight from expected-token errors and identifiable binding timing;
5. apply recent entry and utterance penalties;
6. make one deterministic seeded weighted selection.

## Frequency base

Every syntax-legal entry in the practised commonness levels is eligible in every round. The selector itself has no stage gate and no coarse band: commonness is one continuous weight, and a rarer word is selected less often rather than locked out. Which levels are practised is decided outside selection, by what the learner has unlocked and left switched on; see [commonness levels](./commonness-levels.md).

Reviewed NAER `commonness-v1` evidence supplies that weight. An entry without reviewed evidence weighs the same as the most common word, so a catalog without commonness evidence selects uniformly instead of carrying a second, parallel notion of how common a word is.

## Utterance score

For one grammar-valid candidate:

```text
utteranceWeight = frequencyBase
                × boundedLearnerBoost
                × recentEntryFactor
                × recentUtteranceFactor
```

`frequencyBase` is the geometric mean of the versioned frequency weights of the entries in the utterance. Each entry uses its reviewed `commonnessBase.selectionWeight` when available, then falls back to its band weight. The geometric mean avoids automatically rewarding or punishing a candidate merely because it has more words.

The fallback band weights are:

```text
band 1 = 1.00
band 2 = 0.50
band 3 = 0.25
```

The maximum combined learner boost is `1.50`. Level eligibility is absolute: no learner boost can admit an entry from a commonness level the learner has not unlocked or has switched off, because such an entry is not in the pool the selector is given. Inside the practised levels, learner evidence remains a bounded modifier of the reviewed frequency base.

## Expected-token evidence

A mapped incorrect input updates the binding aggregate of the expected token. The selector may raise utterances containing that expected token after the minimum sample gate.

The actual wrong token is deliberately ignored by curriculum scoring.

Example:

```text
expected ㄓ, actual ㄗ
```

This may raise the weight of utterances containing `ㄓ`. It does not raise `ㄗ`, and it does not create a `ㄓ → ㄗ` practice target. The existing directional confusion aggregate remains available for diagnostics and export only. Confusion observations include mapped incorrect inputs at syllable starts as well as within-syllable and tone positions; this broader diagnostic scope does not change the narrower motor-timing policy.

## Binding timing

Only timing already accepted by the Phase 3 measurement policy can affect selection. Entry starts, syllable starts, recovery input, incorrect input, and interaction-noise-contaminated intervals remain excluded.

For an identifiable token timing aggregate, the selector compares current clean timing to that token's own best clean timing. The contribution is sample-gated and capped.

## Transition timing boundary

Transition measurements remain available to diagnostics, archived research, and legacy selector compatibility, but they do not influence current browser selection.

The production entry point is `selectFormalSyntaxUtterance(...)`. It supplies Measurement V2 binding evidence and explicitly sets legacy transition evidence to `null`. Production selections therefore keep a neutral transition contribution (`transitionBoost = 1`, empty transition trace) even though the shared legacy-compatible score shape still contains transition fields.

This boundary is intentional: current product selection may react to expected-token correctness and identifiable binding timing, but it must not reinterpret historical canonical-order transition measurements as learner-selection evidence.

## Grammar boundary

The production selector requires compact profiles admitted by the full formal
rule index. It cannot bypass slot compatibility to obtain a higher weakness
score, and it has no template, standalone utterance, lexical prompt, or random
word-list fallback. If no complete `Sentence` derivation can be realized, the
round fails closed with explicit reasons.

Caller-supplied template and standalone behavior remains isolated in legacy
compatibility APIs and tests; `product/session.ts` calls only the formal syntax
selector.

## Product catalog boundary

Every syntax-legal runtime entry belongs to the ordinary practice catalog. The browser does not reserve a held-out vocabulary pool or insert automatic evaluation rounds. It does narrow the catalog it draws from to the practised commonness levels, which is a filter over that one catalog rather than a second pool. Research partitions and simulation evaluation remain archived experiment infrastructure and are not part of the browser selection loop.

## Persistence boundary

Current product progress uses schema 7 and measurement epoch `coordination-v1`. It persists Measurement V2 data, selection recency, round count, recent summaries, and the still-present legacy curriculum envelope.

Schema 6 is accepted only at the migration boundary. Its measurement-derived records are discarded because they were gathered under incompatible strict canonical-input semantics; the loader preserves identity, completed-round count, curriculum recency, and frequency-first selection continuity, then starts a fresh Measurement V2 epoch and clears migrated recent summaries.

Schemas 1 through 5 are rejected. The browser does not revive their measurement or selection state.

## Explainability

Every selected utterance retains:

- frequency base;
- expected-token traces and boosts;
- the neutral production transition fields retained by the legacy-compatible score shape;
- combined learner cap;
- repetition factors;
- total weight;
- canonical candidate ordering;
- grammar candidate and fallback identity.

These are selection diagnostics, not claims of learning effectiveness.
