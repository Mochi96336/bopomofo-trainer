# Formal syntax sampling taxonomy

The formal grammar and the product sampling policy are different layers.

`src/syntax` answers whether a derivation is legal. It must not assign product frequency to a construction. The production sampler currently tries reachable rules in randomized order, so splitting one linguistic construction into more `ProductionRule`s can accidentally give that construction more raw sampling tickets.

The curriculum-side registry in `src/curriculum/formal-syntax-taxonomy.ts` makes that coupling explicit before the behavior is changed. It classifies current `Sentence` and `Clause` productions in a hierarchy:

```text
kind -> construction family -> production variant
```

This lets later curriculum policy assign mass above the raw production level. Adding or splitting a production must not silently change the mass of its construction family.

## Current equal-rule ticket audit

The current grammar contains ten root `Sentence` productions. Treating those ten production slots as equal raw tickets gives this **inventory share before reachability/failover effects**:

- statement: 2/10 = 20%
- question: 6/10 = 60%
- request: 1/10 = 10%
- exclamative: 1/10 = 10%

Within that root production inventory, `question.a-not-a` occupies two raw tickets (20% of all root productions) because its intransitive and transitive variants are separate grammar rules. `question.constituent` has the same structural duplication.

This is an audit of rule inventory and sampler mechanics, not a claim that all ten productions are reachable under every product bound or that realized output follows these percentages. Reachability, derivation bounds, lexical availability, and realization failures can all change effective shares.

The same risk exists below the root. The complete grammar currently has 24 `Clause` productions, including four embedded/content-clause rules declared in `complement-rules.ts`. Their raw equal-ticket coarse-kind inventory shares are:

- core predication: 8/24 = 33.3%
- marked constructions: 6/24 = 25%
- embedded/content clauses: 4/24 = 16.7%
- complex predicates: 3/24 = 12.5%
- information structure/omission: 3/24 = 12.5%

Each current Clause production also has its own specific construction family (`core.transitive`, `marked.ba`, `embedded.object-content`, and so on). That extra level matters because a future split of one construction into several executable variants should not make that construction more common inside its coarse kind.

Again, the percentages above are implementation inventory/ticket counts, not desired product weights or realized output frequencies.

## Contract

1. Formal grammar remains the legality source of truth.
2. Sampling taxonomy lives outside `src/syntax`.
3. Adding or splitting a controlled grammar production requires an explicit taxonomy update.
4. Curriculum policy may assign mass to kinds and construction families, then normalize production variants inside a family.
5. Variant count must not silently change family probability.
6. Learner adaptation and recency penalties remain later policy layers; they do not legalize or invalidate grammar.

Run the diagnostic directly with:

```sh
npx tsx scripts/audit-formal-syntax-sampling.ts
```

This change is deliberately diagnostic-only. It does not alter generated utterances or sampling probabilities yet.
