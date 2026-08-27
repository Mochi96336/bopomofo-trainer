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
- complementless occurrences do **not** add `intransitive` when any positive complement evidence exists in the same profile
- mixed complement-bearing/complementless occurrences do **not** synthesize `ambitransitive`

## Why `obl` is not changed here

The current evidence projector stores child-side relation bases, so construction-specific and ordinary obliques are not distinguishable at this aggregate layer. Removing `adpositional-complement` immediately would force those profiles into another misleading fallback (`avalent` or `intransitive`) because the current frame model has no unresolved/unknown oblique state.

The next `obl` slice should first preserve enough relation detail, or introduce an explicit unresolved state, and only then retire the generic `obl -> adpositional-complement` projection.

## Runtime boundary

This change affects `projectSyntaxProfiles*()` for newly generated source-profile artifacts. It does not rewrite the committed active runtime profile artifact, change product selection, activate any construction, modify Measurement V2, or alter #221.
