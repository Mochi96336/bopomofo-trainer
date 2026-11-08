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

Statuses are `indexed`, `no-ud-evidence`, `no-compatible-rule-position`, or `no-reachable-sentence-rule`. Missing evidence never becomes a guessed POS. Ordinary lexical requirements not represented by profile evidence fail closed. Structural construction features remain rule-level constraints, while the small set of construction features that must be realized by a concrete closed-class lexeme are checked by a shared lexical construction matcher using exact written form plus compact UD relation evidence. This matcher is used by both rule indexing and browser realization so generation-time and runtime legality cannot diverge.

The construction matcher is intentionally not a semantic layer. It licenses formal items such as negative/aspect markers, disposal/passive/comparative markers, question particles, complement markers, relative/nominalization markers, and bounded discourse connectors. It does not use definitions, semantic roles, plausibility, embeddings, or collocational meaning.

Generation outputs are disposable and are not committed. They can be reproduced from the pinned inputs through the one-command pipeline, so no run's counts are recorded here — the committed allowlist below is the artifact that matters.

## Product packaging gate

The browser catalog is fail-closed. `npm run app:syntax-legality` accepts a
manifest-linked generation's rule index and profiles through explicit CLI paths
and writes the compact source artifacts. The source legality result records the
generation's reachability, while the base profile artifact retains every observed
profile for the active written forms, including forms not yet reachable there.
No profile is invented when UD evidence is absent.

`npm run app:catalog` validates the source artifacts against the exact compiled
catalog digest, applies the separately reviewed runtime capability sidecars,
then recomputes reachability using the current executable grammar. Only entries
that reach `Sentence` after those projections are packaged. Discarding a base
profile before capability projection could otherwise remove an entry that a
reviewed construction makes reachable. An incomplete, duplicated, stale, or
digest-mismatched source artifact still makes the build fail.

When adding readings, `--preserve-profile-order <previous-profile-artifact>`
keeps existing compact profile numbers and appends new profiles. It validates the
previous artifact digest and rejects missing or changed existing profile syntax;
runtime morphology is independently refreshed afterwards. This avoids unrelated
lexical redraws caused solely by compact profile renumbering.

There is no held-out evaluation catalog: that split was removed along with
automatic evaluation rounds, and the packaged evaluation catalog is empty.

Runtime profiles retain only UPOS, syntactic functions, valency,
dependency-relation counts, and surface-position counts needed for lexical-slot
compatibility, plus reviewed sparse morphology and occurrence capabilities.
The complete UD evidence artifact stays outside the browser
bundle. Closed-class construction matching derives its licenses from these
compact fields together with the exact catalog text, so no second runtime
profile schema or duplicated construction artifact is required. Product
selection samples a bounded `Sentence` derivation and fills every lexical slot
from these profiles; the old template and standalone fallback path is not
reachable from `product/session.ts`.

Source artifact integrity and current executable reachability are both build
requirements. `npm run build` runs catalog compilation and verifies those gates.

Counts change whenever the catalog is regenerated; `npm run app:catalog` prints
the current ones.
