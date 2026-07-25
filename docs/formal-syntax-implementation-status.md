# Formal syntax implementation status

## Current state

`mandarin-formal-grammar-v1` is the only built-in sentence-structure inventory. The former 11-item default template list and its obsolete removal gate are gone. Compatibility functions still accept caller-supplied templates for isolated tests or extensions, but production source contains no default template set.

The formal grammar provides:

- all 17 UD UPOS values and per-UPOS `SyntaxProfile` projection;
- phrase, clause, question, complement, embedded-clause, and recursive complex-clause rules;
- bounded structural derivation and sampling;
- lazy lexical realization;
- deterministic catalog coverage artifacts;
- manifest-scale profile and rule-reachability generation.

## Top-N lexical generation

`npm run lexicon:generation-pipeline` now runs:

```text
ranked candidates
→ reading evidence
→ UD syntax evidence
→ SyntaxProfile projection
→ formal rule reachability index
→ activation review
```

The syntax step writes `syntax-profiles.json` and `syntax-rule-index.json` inside the ignored generation workspace. It validates candidate CSV, manifest rows and digest, candidate checksum, manifest checksum, evidence lineage, evidence schema, rank identity, and row identity before producing output.

The rule index uses fixed-point category reachability rather than enumerating the bounded sentence universe. Each candidate row records:

- every projected profile and UPOS;
- direct lexical rule positions;
- reachable production rules;
- reachable `Sentence` rules;
- an explicit status.

Statuses are `indexed`, `no-ud-evidence`, `no-compatible-rule-position`, or `no-reachable-sentence-rule`. Missing evidence never becomes a guessed POS. Lexical requirements not represented by UD evidence fail closed; structural construction features remain rule-level constraints instead of being mistaken for lexical facts.

Generation outputs are disposable and are not committed. They can be reproduced from the pinned inputs through the one-command pipeline, so no run's counts are recorded here — the committed allowlist below is the artifact that matters.

## Product packaging gate

The browser catalog is now fail-closed. `npm run app:syntax-legality` projects the
full top-10,000 rule index into the compact committed
`formal-syntax-active-catalog-legality.json` allowlist. `npm run app:catalog`
validates that artifact against the exact compiled catalog digest and packages
only identities whose source rule-index status is `indexed`, meaning the written
form reaches at least one `Sentence` production. Missing generation rows,
missing UD evidence, incompatible rule positions, and unreachable sentence
rules are exclusions.

The site bundle currently packages **13,897 practice entries with 0 syntax
exclusions**, and **16,266 compact runtime syntax profiles**. There is no
held-out evaluation catalog: that split was removed along with automatic
evaluation rounds, and the packaged evaluation catalog is empty.

Zero exclusions is a result of the current data, not a bypass. An incomplete,
duplicated, stale, or digest-mismatched allowlist makes the build fail.

Runtime profiles retain only UPOS, syntactic functions, valency,
dependency-relation counts, and surface-position counts needed for lexical-slot
compatibility. The complete UD evidence artifact stays outside the browser
bundle. Product selection samples a bounded `Sentence` derivation and fills
every lexical slot from these profiles; the old template and standalone
fallback path is not reachable from `product/session.ts`.

This allowlist is the only formal-syntax legality gate. Its digest checks inside
`applyCatalogSyntaxLegalityArtifact` fail the build on any stale or incomplete
allowlist, so `npm run build` alone verifies it.

Counts change whenever the catalog is regenerated; `npm run app:catalog` prints
the current ones.
