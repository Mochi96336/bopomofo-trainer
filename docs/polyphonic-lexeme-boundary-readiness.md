# Whole-lexeme readiness: research-only diagnostic after #414

The existing generated catalog uses exact text-and-reading entry IDs, and the
polyphonic exposure audit already treats multi-character entries as atomic.
**This does not mean a visible string always has one tokenization.** For
example, the sentence text "遊說" is insufficient to distinguish an actual
selected 遊說 entry from independently selected 遊 + 說. No substring match
may authorize 說/ㄕㄨㄟ4 in an unrelated VERB slot.

The independent MOE public headword cross-check in #413 provides three
examples of a target character pronunciation in a larger host lexeme.
Those examples remain dictionary evidence, not approved sentence labels.

## Initial coverage observation (main after #414)

| Attested host | Active catalog | Source-projected syntax profile |
|---|---|---|
| 遊說 (說 ㄕㄨㄟ4) | Present, as its own full-word reading ID | Present |
| 自給自足 (給 ㄐㄧ3) | Absent | Absent |
| 成為 (為 ㄨㄟ2) | Absent | Absent |

This list is not exhaustive. In particular, 遊說's variant 游說 and the
compound 補給 are separate existing catalog entries, but do not justify a
blanket prohibition on the single-character senses of 說 or 給.

A profile's presence only shows a possible grammar evidence path; it is NOT
proof that the composer can or will generate the host. The 2,048-seed
sample may miss a reachable host. A surface-text collision is also not proof
of incorrect pronunciation.

## Reproduce without modifying the product

First produce the already-established reviewed-role exposure audit:

    npm run app:catalog
    npm run readings:audit -- --policy reviewed-roles --output data/generated/polyphonic-context-reviewed-roles.json

Then run the offline inspection:

    npx tsx scripts/audit-lexeme-boundary-readiness.ts

The output is gitignored at
data/generated/polyphonic-lexeme-boundary-readiness.json.
For each of the three host lexemes, it records exact catalog IDs,
profile presence, genuinely selected atomic tokens, misleading surface-only
strings, and separately drawn target-character identities.

This **never modifies** catalog entries, syntax templates, selection weights,
reading eligibility, learner progress, or browser assets.

## Next scientific gates

1. Reconcile exact host readings against the SHA-pinned September MOE version
   and obtain independently reviewed natural usage/counterexamples.
2. Decide whether missing *whole words* need source-backed catalog activation
   and syntactic evidence. Do not fabricate a compound from individual entries.
3. For already-present hosts, prove actual reachability and reading fidelity
   with targeted, structurally legal probes; do not turn biased probes into a
   claim about unbiased frequency.
4. Keep the isolated-character rare readings unclassified until independent
   positive and negative contexts exist.
5. Only then trial a bounded recognition/abstention mechanism, with same-seed
   drift, failure counts, commonness coverage, and browser cost measured.

"東西" is deliberately excluded from this compound-host diagnostic: its
problem is *different senses of the same whole lexeme*, not recognizing a
larger enclosing word. It needs a separate context-sense experiment.
