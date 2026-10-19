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
The pronunciation policy is a **hard validity constraint** on the
selected grammar role, independent of a learner's mistakes. If standalone
好:ㄏㄠ4 is sampled as an ADJ, the system does **not** lend the invalid
fourth-tone entry's learner weight to another entry with the same character.
It uses the existing weighted draw **only among licensed lexical entries
in that same slot**, retaining the grammar shape and prior slots.

The output may still choose 好:ㄏㄠ3 when its actual valid entry weight wins,
or another legal adjective such as 壞:ㄏㄨㄞ4 when that candidate wins.
Whichever written word is selected, its exact catalog entry ID and syllable
tokens remain together. A high learner error rate for tone:4 can boost
the frequency of genuinely legal fourth-tone entries, but cannot make 好:ㄏㄠ4 a legal adjective.

This is a *slot-only* legal redraw, not a wholesale sentence restart.
It also avoids a global pre-filter that changed 215/2048 pinned grammar
seed outcomes in #426's research run, although fixed-seed drift by itself
is not a measure of correctness.

VERB, NOUN, ADV, unrecognized roles and multi-character entries remain
unchanged. All existing closed-class/pronominal eligibility survives.

The 2,048-seed audit verifies no unauthorized 好/ADJ reading is
emitted and unrelated already-licensed seeds keep their selection.
A 1,024-seed **restricted-slot** probe confirms that when a rejected
fourth-tone 好/ADJ is encountered, a legal identity is sampled using
legal candidate weights; existing valid draws remain unchanged.
With synthetic tone:4 mistakes, legitimate four-tone practice must
increase compared with no mistakes. These are synthetic mechanics,
not real-user learning results.

**Important limits:** The audit samples the grammar composer with pinned
seeds, not user traffic or the full frequency-first runtime distribution.
The underlying UD lexical roles are projected from the written form;
an `ADJ` profile cannot substitute for independently reviewed semantics
in arbitrary sentences. Do not report six repaired pronunciation errors
or an accuracy gain from the six excluded candidate selections. Review
post-change full sentences and counterexamples before promoting this
Draft PR. Do not conflate lexical naturalness with pronunciation correctness.
