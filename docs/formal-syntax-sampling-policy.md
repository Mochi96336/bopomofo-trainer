# Formal syntax sampling policy

The formal grammar and the product sampling policy are different layers.

`src/syntax` answers whether a derivation is legal. It does not assign product frequency to a construction. The curriculum taxonomy classifies legal productions as:

```text
kind -> construction family -> production variant
```

The product policy assigns probability above the raw production level. Variants only divide the mass already assigned to their construction family.

## Why this exists

The raw structural sampler randomizes reachable productions. With the current grammar, ten root `Sentence` productions otherwise behave like ten equal tickets before reachability effects:

- statement: 2/10 = 20%
- question: 6/10 = 60%
- request: 1/10 = 10%
- exclamative: 1/10 = 10%

`question.a-not-a` owns two raw tickets only because its intransitive and transitive forms are separate executable productions. That grammar representation detail must not become product frequency.

## Product prior

`PRODUCT_FORMAL_SYNTAX_SAMPLING_POLICY` is a training prior, not a claim about natural Mandarin corpus frequencies.

Root kinds start at:

- statement: 64%
- question: 26%
- request: 6%
- exclamative: 4%

Question mass is divided by construction family:

- polar: 35% of question mass
- constituent: 30%
- A-not-A: 25%
- alternative: 10%

So the nominal A-not-A prior is:

```text
0.26 × 0.25 = 0.065 = 6.5%
```

Both A-not-A productions share that one family mass. Adding another executable A-not-A variant does not create another top-level ticket.

Clause kinds start at 60% core predication, 20% marked, 8% complex-predicate, 7% information-structure, and 5% embedded-content. Current Clause families begin equal inside each kind; variants still divide family mass rather than create mass.

## Bounded family-local search

A second bias appeared after family weights were introduced. One structural attempt per family was not enough: a selected polar question or declarative could fail because one randomly chosen inner Clause expansion was unreachable, and the sampler would immediately fall through to another root family. Constructions that are short and easy to realize, including A-not-A, then absorbed that failed probability.

The product therefore separates **family choice** from **search inside that family**:

1. build one weighted root plan: kind → family → variants;
2. target only the current root family while keeping all descendant grammar available;
3. retry inner derivations within that family up to the versioned `maximumRootFamilyAttempts` budget;
4. only then advance to the next already-ranked family;
5. after one candidate is accepted, build a fresh root plan for the next candidate.

`rootProductionRuleIds` in the structural sampler scopes only the root choice point. It does not remove descendant rules and does not change grammar legality. External rule orderers are still required to be pure permutations of the eligible rules they receive.

Product-only rejection, such as the current minimum of two practice lexical entries, counts against the same family-local budget instead of causing an immediate fresh family draw.

Custom grammar callers keep the raw sampler behavior unless they explicitly opt into these curriculum controls.

## Effective-distribution guard

The tests exercise the packaged practice catalog and runtime syntax profiles with the real product derivation bounds and minimum practice length. This is separate from nominal-prior unit tests: it catches distortion caused by lexical reachability, structural failover, and product filters.

The regression requires effective A-not-A share to remain below 12% and total question share below 40% on the deterministic real-catalog sample. A failure should be investigated as sampling semantics; the threshold or A-not-A weight should not simply be relaxed to hide the mismatch.

## Contract

1. Formal grammar remains the legality source of truth.
2. Sampling taxonomy and probability live outside `src/syntax` grammar definitions.
3. Adding or splitting a controlled production requires an explicit taxonomy update.
4. Kind and family weights belong to versioned curriculum policy.
5. Variant count must not silently change family probability.
6. Root-family search is bounded and family-local before fallback.
7. Root targeting never removes descendant grammar.
8. Learner adaptation and construction recency remain later policy layers; they do not legalize or invalidate grammar.

Run the diagnostic with:

```sh
npx tsx scripts/audit-formal-syntax-sampling.ts
```

It reports the old equal-production ticket shares and the nominal product family priors. Realized frequencies are guarded separately rather than baked back into grammar.
