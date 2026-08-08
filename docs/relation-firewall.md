# Relation firewall

The input-order v2 architecture distinguishes two kinds of directional-looking evidence that must not share a type or statistical meaning.

## Structural adjacency

`StructuralAdjacencyOccurrence` is derived only from the canonical token sequence stored in a catalog syllable. For `ㄒ ㄩ ㄝ ˊ`, the catalog can therefore contain structural adjacencies such as `ㄒ → ㄩ` regardless of how a learner physically enters the syllable.

Structural adjacency is suitable for catalog indexing, linguistic retrieval, support analysis, and future phonological curriculum work. It is not a motor observation and carries no timestamp, physical key, hand, or observed ordinal.

The older relational research subsystem still exposes `transition` names for compatibility with archived experiments. New production code must use the explicit structural API when it means canonical adjacency.

## Motor observations

Motor evidence is derived only from `InteractionTraceV2` in actual event order. The first implemented motor projections are:

- syllable coordination span;
- immediate assigned-hand transition;
- same-hand revisit;
- tone commit.

These observations may contain actual event timing and physical-key ergonomics. They do not infer order from catalog token indices.

## Firewall rule

Production measurement must never import canonical adjacency as motor timing evidence. The compatibility view used by existing semantic selection and diagnostics deliberately publishes an empty legacy transition record. A future motor-driven curriculum must define its own objective semantics rather than reviving canonical token-pair transitions under the old name.
