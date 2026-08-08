# Lexical compatibility

## Purpose

Formal syntax answers whether a token can occupy a grammatical slot. It does not answer whether two individually legal words are a natural lexical combination. The lexical-compatibility layer adds a separate, corpus-backed signal for that second question without turning a small treebank into a semantic allowlist.

Examples of the distinction:

- `睡` is rejected from a transitive predicate by formal syntax/valency.
- `吃` + `飯` and `吃` + `理論` can both pass the same transitive syntax gate.
- observed pair evidence may boost `吃飯`; absence of an observed `吃理論` pair remains neutral rather than illegal.

This layer is deliberately narrower than a semantic ontology. It does not claim animacy, edibility, world knowledge, dictionary senses, embeddings, or LLM plausibility.

## Evidence projection

`npm run compatibility:ud-evidence-generation -- ...` projects a manifest-linked candidate set against the same pinned UD Chinese GSD source used by formal syntax.

The disposable `ud-lexical-compatibility-v1` artifact contains two sparse tables:

- `surfacePairs`: directed adjacent candidate-token pairs in source order;
- `dependencyPairs`: directed head/dependent candidate-token pairs with their UD relation.

Only aggregate candidate text, counts, and bounded association scores are written. Complete CoNLL-U files and source sentences remain local. Pairs below the configured occurrence threshold are omitted.

Association uses positive PMI, normalized and shrunk toward zero for low counts. Scores are bounded to `[0, 1]`. A score of zero is valid evidence; a missing pair means only that the sparse artifact has no retained evidence for that pair.

`npm run lexicon:generation-pipeline` now produces `lexical-compatibility.json` alongside the syntax profiles and rule index.

## Runtime contract

`src/compatibility/lexical-pairs.ts` owns artifact validation and sparse lookup. It is intentionally outside `src/syntax`.

The formal-syntax composer accepts an optional `LexicalCompatibilityIndex`. When present, the score for the previous selected lexical entry and the current candidate multiplies the existing curriculum weight by:

```text
1 + score * maximumBoost
```

Therefore:

- no evidence leaves the original weight unchanged;
- positive evidence can prefer an observed lexical combination;
- syntax legality is never relaxed;
- corpus absence never becomes a hard rejection;
- frequency, learner weakness, recency, and other curriculum signals retain their existing role.

The dependency-pair table is retained for a later relation-aware selectional-preference layer. The current composer uses only surface pairs because the structural derivation does not yet expose a stable lexical dependency graph, and inventing one inside the compatibility layer would couple semantics back into grammar.

## Product activation boundary

The code path is ready to consume a validated compatibility index, but the committed browser catalog does not yet package a lexical-compatibility artifact. Activating it requires regenerating the pinned candidate workspace from the external UD source, reviewing artifact size/coverage, projecting the sparse pairs onto the active catalog, and then adding that compact artifact to `app:catalog`.

Keeping this activation separate is intentional: landing a scorer without real evidence would pretend the semantic layer exists, while checking in an unreviewed full pair matrix would turn a small improvement into bundle and maintenance debt.
