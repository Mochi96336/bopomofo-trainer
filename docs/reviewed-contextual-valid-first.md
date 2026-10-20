# Reviewed contextual reading before learner-weighted lexical selection

This is a **research-only, opt-in** experiment stacked on Draft #425. It
does not alter `src/product/session.ts`, user progress, or scoring
weights. The composer already accepts a local pre-draw policy; we are
testing whether adding the independently reviewed standalone
`好/ADJ` reading alongside the existing adjacent `第N行` policy
is warranted.

## Separation of responsibilities

1. Review a specific word/role or adjacent-word **sense** as a language
   fact, independently of the learner history.
2. Only entries with approved readings for that reviewed context may
   contribute **their own real frequency/weak-token weights** to the
   lexical draw.
3. The selected catalog identity carries its matching written text and
   exact Zhuyin syllables into the exercise.

For a standalone `好` used as the **ADJ** "good/satisfactory" sense,
`ㄏㄠ3` is valid; `ㄏㄠ4` is not. Other roles and multi-character
lexemes are **not globally corrected**. In `第三行`, the standalone
`行` requires `ㄏㄤ2`; other uses of 行 are not globally corrected.

A student's fourth-tone mistakes never justify assigning
`好/ADJ` the incorrect `ㄏㄠ4`, nor may the invalid `ㄏㄠ4`
entry's sampling probability be donated to legal `好/ㄏㄠ3`.
The valid fourth-tone candidate `壞:ㄏㄨㄞ4`, if licensed by the
current slot, remains free to win based on **its own** learning weight.

## Paired evidence

Run:

```sh
npm ci
npm run app:catalog
npx vitest run tests/readings/contextual-pre-draw.test.ts
npx tsx scripts/audit-polyphonic-context.ts --samples 2048 --policy ordinal-line-trial --output data/generated/contextual-before.json
npx tsx scripts/audit-polyphonic-context.ts --samples 2048 --policy contextual-valid-first --output data/generated/contextual-after.json
npx tsx scripts/compare-contextual-valid-first.ts data/generated/contextual-before.json data/generated/contextual-after.json data/generated/contextual-comparison.json
```

The paired seeds are identical. Baseline uses the existing #425
scoped ordinal valid-first policy, while the variant **only adds**
reviewed adjective 好 legality before drawing.

The results must explicitly report **both** already reviewed readings
remaining legal, 0 generation failures, candidate distribution drift
and examples, whether changes are restricted to one lexical slot,
and the number of seeds that changed even without a previously selected
`好/ADJ` entry. This matters because a legal-first frontier
renormalizes a random threshold even when the removed candidate
would not have been selected.

## Important quality caveat

The fixed-seed generator has no independent naturalness or semantic
gold-standard labels. `服務好` is a meaningful local phrase,
but the wider generated sentence around it may still be unnatural.
Correcting the reading of a phrase and generating a natural full
sentence are different problems. **No generated seed may be reported
as a validated natural sentence solely because it has a legal reading.**

Do not activate this experiment in product or merge automatically
merely because CI passes. Review the lexical-distribution cost and
the scarcity of genuinely human-attested target contexts separately.

## Natural short-context review queue (not generated-sentence fluency)

`tests/readings/reviewed-natural-contexts.test.ts` now carries five
**illustrative, manually specified (not independently corpus-attested)** reading examples. They check the
scoped pronunciation policies for `這家餐廳的服務很好`, `他愛好音樂`
(the whole-word lexeme `愛好`), and `請看第三行`. These examples
check a reviewed lexical sense **given manually supplied syntax**,
not an automatic parser's precision or the whole generator's naturalness.

One important open gap is deliberately marked **TODO**, not silently
counted as a successful reading:

- `請把這三行字抄下來` requires `行:ㄏㄤ2` for "three lines
  of writing." The MOE Revised Dictionary records both meanings of
  `三行`, including "three rows/lines" and a historical `三行字`
  phrase (https://dict.revised.moe.edu.tw/dictView.jsp?ID=144541).
  The current rule purposely does not force every bare `三行` to
  `ㄏㄤ2`: it sees the previous numeral, but needs the following
  classifier object `字` or a reviewed semantic construction to
  disambiguate safely.

This explicitly avoids declaring that all examples selected by the
stochastic grammar composer are natural merely because the local
word's pronunciation is valid.
