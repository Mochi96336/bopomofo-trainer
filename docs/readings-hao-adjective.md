# Reviewed standalone 好 / ADJ: targeted production reading repair

## One auditable regression, not a general G2P accuracy claim

In the archived 2,048-seed grammar-generation report
(`polyphonic-context-reviewed-roles.json` from workflow
`Polyphonic reading exposure`, run `38894259772`), seed **10** produced
`服務好` with standalone entry `word:好:ㄏㄠ4` selected as `ADJ`.
In that straightforward predicative-adjective context, the reading is
**ㄏㄠ3**. Of ten `好/ADJ` occurrences, six selected `ㄏㄠ4`.
Only `服務好` is used as the clear whole-utterance regression here;
other fragments come from sentences of mixed naturalness and must not be
reported as independently confirmed natural-sentence errors.

Authoritative reading senses:
- [MOE Concised ㄏㄠ3](https://dict.concised.moe.edu.tw/dictView.jsp?ID=19419):
  good/satisfactory and related predicative/adverbial senses.
- [MOE Concised ㄏㄠ4](https://dict.concised.moe.edu.tw/dictView.jsp?ID=19462):
  liking/fondness, plus nominal use.

## Narrow repair

Keep the original `(surface, reading)` catalog entry identities.
The existing production eligibility callback now checks one *selected*
role only: **standalone 好 / ADJ** accepts `ㄏㄠ3` and rejects `ㄏㄠ4`.
VERB, NOUN, ADV, unrecognized roles and multi-character entries remain
unchanged. All existing closed-class/pronominal eligibility survives.

The 2,048-seed audit and its exact-seed comparison will verify
that changed candidates originate from an excluded `好/ADJ` or
earlier reviewed role mismatch, without unrelated drift or
generation failure. Tests pin accepted and rejected entry IDs,
unreviewed roles and mismatched profile identity.

**Important limits:** The audit samples the grammar composer with pinned
seeds, not user traffic or the full frequency-first runtime distribution.
The underlying UD lexical roles are projected from the written form;
an `ADJ` profile cannot substitute for independently reviewed semantics
in arbitrary sentences. Do not report six repaired pronunciation errors
or an accuracy gain from the six excluded candidate selections. Review
post-change full sentences and counterexamples before promoting this
Draft PR. Do not conflate lexical naturalness with pronunciation correctness.
