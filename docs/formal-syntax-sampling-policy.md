# Formal syntax sampling taxonomy

The formal grammar and the product sampling policy are different layers.

`src/syntax` answers whether a derivation is legal. It must not assign product frequency to a construction. The production sampler currently tries reachable rules in randomized order, so splitting one linguistic construction into more `ProductionRule`s can accidentally give that construction more raw sampling tickets.

The curriculum-side registry in `src/curriculum/formal-syntax-taxonomy.ts` makes that coupling explicit before the behavior is changed. It classifies every current `Sentence` and `Clause` production into stable product-facing families and fails closed when a new controlled production is added without a classification.

## Current equal-rule ticket audit

With the current grammar, ten `Sentence` productions are reachable at the root. If all are reachable and each production behaves like one equal ticket, the raw structural distribution is:

- statement: 2/10 = 20%
- question: 6/10 = 60%
- request: 1/10 = 10%
- exclamative: 1/10 = 10%

Within the root rules, `question.a-not-a` owns two tickets (20% of all root productions) because its intransitive and transitive variants are separate grammar rules. `question.constituent` has the same structural duplication.

This is an audit of the current sampler mechanics, not an intended language or curriculum distribution. Realized shares can differ further because lexical reachability, derivation bounds, and realization failures cause retry/failover.

The same risk exists below the root. Current `Clause` productions classify as:

- core predication: 8/20 = 40%
- marked constructions: 6/20 = 30%
- complex predicates: 3/20 = 15%
- information structure/omission: 3/20 = 15%

Again, these are implementation ticket counts, not desired product weights.

## Contract

1. Formal grammar remains the legality source of truth.
2. Sampling taxonomy lives outside `src/syntax`.
3. Adding or splitting a grammar production must require an explicit taxonomy update.
4. A later curriculum policy will assign mass to construction families and normalize variants inside a family, so variant count cannot silently change family probability.
5. Learner adaptation and recency penalties remain later policy layers; they do not legalize or invalidate grammar.

Run the diagnostic directly with:

```sh
npx tsx scripts/audit-formal-syntax-sampling.ts
```

This change is deliberately diagnostic-only. It does not alter generated utterances or sampling probabilities yet.
