# Formal Syntax V2 valency capability migration

This is the first executable follow-up to the valency evidence semantics audit.

## Decision

`valencySignatureCounts` contains occurrence shapes. A missing complement in one occurrence is argument-realization evidence; it is not sufficient to manufacture a second lexical capability for the same predicate profile.

The source-profile projection therefore now follows these rules:

- observed `obj` -> `transitive`
- observed `iobj` -> `ditransitive`
- observed `ccomp` -> `clausal-complement`
- observed `xcomp` -> `open-clausal-complement`
- observed `obl` keeps the existing provisional `adpositional-complement` projection for now
- complementless-only predicate evidence keeps the existing provisional `intransitive` fallback
- complementless occurrences do **not** add `intransitive` when strong positive complement evidence (`obj`, `iobj`, `ccomp`, or `xcomp`) exists in the same profile
- generic `obl` does not by itself suppress an otherwise observed complementless `intransitive` fallback while its selected-complement vs adjunct distinction remains unresolved
- mixed object-bearing/complementless occurrences do **not** synthesize `ambitransitive`

## Why `obl` is deliberately weaker here

The current evidence projector stores child-side relation bases, so construction-specific, selected and ordinary adjunct-like obliques are not distinguishable at this aggregate layer. Treating every generic `obl` as strong positive complement evidence would let a provisional projection erase an independently observed complementless realization.

For example, a profile with both `none` and `obl=1` occurrence signatures keeps `adpositional-complement` **and** the provisional `intransitive` fallback. A profile with `obj=1` plus `none`, by contrast, keeps `transitive` and does not manufacture `intransitive` or `ambitransitive` from the omitted-object occurrence.

The next `obl` slice should first preserve enough relation detail, or introduce an explicit unresolved state, and only then decide whether a particular oblique occurrence licenses or suppresses a lexical frame. Until then the generic `obl -> adpositional-complement` projection remains provisional and neutral to this suppression decision.

## Runtime boundary

This change affects `projectSyntaxProfiles*()` for newly generated source-profile artifacts. It does not rewrite the committed active runtime profile artifact, change product selection, activate any construction, modify Measurement V2, or alter #221.

Before landing, the affected active-profile set and product reachability must be measured against the committed runtime artifact rather than assuming this projection change is distribution-neutral.
