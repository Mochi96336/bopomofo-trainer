# Word + oracle-UPOS: how much genuine disambiguation exists?

This independent Draft follows the 18 pinned actual UD Chinese GSD
contexts from #433. It asks a sharper question: **if we give the
current shipping catalog the original *whole written word* and its
corpus UPOS tag, can the *current* reviewed role-based reading license
uniquely determine the correct target-character Zhuyin?**

Only after the candidate set has been computed do we consult the
separately recorded MOE target reading to classify the result.

## How to run

```sh
npm ci --include=dev --ignore-scripts
npm run app:catalog
npx vitest run tests/readings/attested-gold-blind-diagnostic.test.ts
npx tsx scripts/audit-attested-gold-blind-reading.ts \
  research/attested-reading-pilot/cases.json \
  data/generated/attested-gold-blind-diagnostic.json
```

For each row:
1. Look up **exact** attested word form from UD (not a rewritten
   natural-sounding sample sentence).
2. Keep catalog identities with the same number of syllables.
3. Join the existing runtime syntax profiles by **UD UPOS**. This is
   **oracle metadata**, not a POS prediction by the product.
4. Apply only the current shipping `reviewedRoleReadingEligible`
   policy and deduplicate exact target-character Zhuyin sequences.
5. Record whether exactly one reading remains, multiple readings
   remain, or no compatible candidate is possible.
6. **Only after step 5**, compare with the independently reviewed
   target pronunciation in `cases.json`.

The status `unique-matches-reviewed-gold` means **unique given
correctly supplied source token + UD UPOS**; it is **not** natural
full-sentence G2P accuracy. `ambiguous-includes-reviewed-gold` is a
*failure to decide*, not success. A target with no compatible profile
is *unsupported*, not an incorrect G2P prediction.

Tested reading is **one target character** per natural original
sentence. This does not label complete sentence syllables.

## Why this is necessary

The earlier exact-word availability audit on 18 real contexts found:
- 15 with the reviewed reading and no other aligned pronunciation in
  the *same written word*;
- 3 with multiple catalog pronunciations despite including the gold:
  `兩種`, `給行為分析`, `交工資給叔父`.

The follow-up must investigate whether *existing grammatical evidence
alone* disambiguates these cases, or whether following-word and
full-clause semantic context is actually needed.

Critically, the old generation sampler **does not take an existing
natural sentence as input**. This is a candidate diagnostic — it
cannot be presented as a working natural-context model. No formal
grammar, catalog or production selector is modified.

**Keep Draft; do not merge automatically or treat the raw rate as
production reading accuracy.**

## Measured result on the 18 pinned source occurrences

The first exact-source diagnostic CI succeeded. Existing
**whole-word + oracle UD UPOS + shipping role gate** yielded:

| Outcome | Attested target-character cases |
|---|---:|
| A single candidate equal to independently reviewed MOE target | 15 |
| More than one reading, with the gold among the candidates | **3** |
| A single candidate that conflicts with gold | 0 |
| No licensed candidate under oracle UPOS | 0 |

**This is NOT 15/18 end-to-end context G2P accuracy.** The system was
given gold-quality original word boundaries and UD POS annotations,
neither of which is produced for a new natural sentence by the
current question generator. The three rows left unresolved are:

- `dev-s241` `兩種` (exact standalone `種/NOUN`):
  reviewed `ㄓㄨㄥˇ`; surviving
  `ㄓㄨㄥˇ` **and** `ㄓㄨㄥˋ`.
- `dev-s5` `給行為分析提供` (`給/VERB`):
  reviewed `ㄍㄟˇ`; surviving
  `ㄍㄟˇ` **and** `ㄐㄧˇ`.
- `dev-s287` `交工資給叔父` (`給/VERB`):
  reviewed `ㄍㄟˇ`; surviving
  `ㄍㄟˇ` **and** `ㄐㄧˇ`.

**Next evidence already pinned** in
`unresolved-context-evidence.json`:

- Raw UD `兩/NUM → 種/NOUN` nummod relation, plus ingredient
  phrase, suggests a numeral-class relation for future review.
- Raw UD `給/VERB → 提供/VERB` advcl with `分析` as an
  object suggests a possible beneficiary phrase.
- `交/VERB` modifies `給/VERB` and `叔父` is its object:
  a possible transfer recipient cue.

These are **hypotheses, not proved universal reading rules**.
Source dependency annotations also can be imperfect; an independent
linguistic review or additional contrastive natural contexts are
required before turning any of these patterns into automatic
pronunciation permissions.

A second limitation: the current 18-example set has two naturally
attested `給/ㄍㄟˇ` examples with the **same exact written single
word and POS**, but no contrasting naturally attested standalone
`給/ㄐㄧˇ` in the same comparison set. The already collected
multi-character `給予` and `補給` examples are useful
lexical contrast but cannot by themselves validate *same-word*
context disambiguation.

**Recommendation:** gather true opposing natural contexts of the
*same word + UPOS*, keep a held-out test split, and implement a
context reader only when it can be evaluated without label leakage.
Continue to keep Draft #434 and Draft #433 unmerged.


## Source-integrity gate and gold-free candidate collection

Before the dependency cues are treated as evidence, the diagnostic CI now
checks out an exact upstream UD commit (`22f73e87f7ddc530bb131a6b7587971a03e1a712`)
and independently verifies the Git blob SHA of the original `dev` file.
For all 18 target occurrences, it compares the original sentence, token ID,
form, UPOS, source Translit **as untrusted provenance only**, and recorded
character span. For each of the three ambiguous cases, it additionally checks
every copied UD dependency token's exact HEAD and DEPREL against the original
CoNLL-U. The checker never consults the reviewed pronunciation; unit tests
exercise corpus drift, altered edges, and altered gold annotations.

A second read-only step now mines every **standalone exact-token** occurrence
of `種` and `給` in the pinned `train` split. The JSON artifact preserves
original text, sentence/token identity, original UPOS and dependency fields,
but gives every row `reviewStatus: unlabeled`. Neither UD Translit nor MOE
gold is copied into this review queue. The `dev` and `test` splits contribute
**group counts only**, with no held-out sentence content in the queue.

This is a search for review material, **not** yet a count of examples of
`ㄓㄨㄥˇ/ㄓㄨㄥˋ` or `ㄍㄟˇ/ㄐㄧˇ`. A source annotation or written-form match
must never become a phonetic label without independent contextual review.

### Why the remaining three need different analyses

The MOE dictionary lists `種/ㄓㄨㄥˇ` as noun (including type and classifier
uses), while `種/ㄓㄨㄥˋ` is verbal planting/inoculating. Thus the current
`種/NOUN` ambiguity may reflect an over-permissive catalog role/readings
mapping even *before* building a larger context model. Investigate the two
surviving catalog identities and their syntax profiles; do not assume the
extra fourth-tone candidate is legitimate in this **noun** use.

For `給`, both `ㄍㄟˇ` and `ㄐㄧˇ` have verbal senses in the MOE dictionary.
In actual contemporary transfer/beneficiary uses the reviewed reading is
`ㄍㄟˇ`, but UPOS=VERB alone cannot prove the distinction. A UD `VERB` tag
also does not settle the dictionary's finer verb/preposition distinctions.
The `給` examples therefore call for meaningful semantic/argument contrasts,
not merely an additional POS check.

Dictionary references:
- 種: https://dict.revised.moe.edu.tw/dictView.jsp?ID=8174
- 給: https://dict.revised.moe.edu.tw/dictView.jsp?ID=5423

**Next gate:** review `train` candidates without looking at original Translit
as an answer, document which actually represent independent contrasting
readings, and reserve a separate, genuinely disjoint evaluation split.
If GSD contains no suitable `給/ㄐㄧˇ` standalone comparator, record that
absence instead of constructing or relabeling examples to make the benchmark
look balanced.


## Independent follow-up: actual catalog identities and original corpus review

The source-provenance audit now prints the exact catalog identities, runtime
UPOS profiles, available syntactic functions, valency frames and whether a
reading-specific reviewed gate applies. It identifies **no such active gate**
for \`種\` or \`給\`; both pronunciation identities inherit matching runtime
profiles. The reason is structural, not a simple missing hard-coded exception:
\`src/syntax/profile-projection.ts\` joins upstream syntactic evidence by
**written form**, then projects it onto each reading-specific identity.

The original pinned train corpus supplied 190 unlabelled standalone
occurrences across five raw written-form/UPOS groups:
- \`種/NOUN\`: 148; \`種/PART\`: 5; \`種/VERB\`: 1.
- \`給/VERB\`: 35; \`給/ADP\`: 1.

The first deterministic, train-only review sample reveals potential
**UPOS source annotation mistakes**, not merely missing target readings:

| Source | Original snippet | Raw UPOS | Provisional linguistic finding |
|---|---|---|---|
| train-s3887#2 | 有些種的花是兩性同花的 | VERB | \`種\` refers to species, likely nominal, not a planting action |
| train-s2794#9 | 聖赫勒拿島的特有種 | PART | \`種\` is the noun in \`特有種\`, not a grammatical particle |
| train-s344#7 | 地方特有種 | PART | Same nominal usage |
| train-s411#26 | 為特有種 | PART | Same nominal usage |
| train-s712#32 | 為特有種 | PART | Same nominal usage |
| train-s3068#6 | 歐亞種葡萄 | PART | Taxonomic noun/class compound, not grammatical particle |
| train-s3250#21 | 提供給用戶 | ADP | Likely recipient marking (a plausible ADP role), with no automatic gold reading |
| train-s1055#7 | 都給殺掉 | VERB | A constructional/functional \`給\` usage, not equivalent to every lexical transfer verb |

These are **inspection flags**, not a second independent reviewer, not
official MOE-approved per-sentence labels, and not training supervision.
In particular, **the only standalone \`種/VERB\` in train appears
to be nominal**. Do not use this apparent class balance as evidence
that an unconditional \`VERB -> ㄓㄨㄥˋ\` rule is safe.

The repository already has an **opt-in** \`reviewedZhongRolePilotEligible\`
policy with \`NOUN -> ㄓㄨㄥ3\` and \`VERB -> ㄓㄨㄥ4\`. The new
\`compare-attested-zhong-role-ablation.ts\` measures that existing policy
on the pinned diagnostic cases without enabling it in shipping code.
It must not be promoted merely because it resolves the exploratory
\`種/NOUN\` example: generated grammar roles are inherited from the
same surface-keyed evidence, which may not be reading-specific.

**Split accounting correction:** the 18 already-labelled cases
in \`cases.json\` come from **dev**, and have been inspected repeatedly
to decide the next hypothesis. That makes dev an **exploratory
diagnostic**, not a pristine held-out final benchmark. \`train\`
can support independent review and development. No original \`test\`
sentence text has been exposed through the queue or sample (group
counts alone were inspected), so keep the future \`test\` evaluation
sealed from manual rule crafting. Even a successful dev ablation must
not be called unseen test accuracy.

Next hard gate: independently validate suspicious train labels, seek true
opposing same-form/same-role readings (especially standalone \`給/ㄐㄧˇ\`),
then evaluate untouched test contexts only after method/threshold freeze.


## Word-boundary evidence for 給 (official MOE review, research-only)

The Ministry of Education's **國語一字多音審訂表**, item 2508 給 (printed
page 157, PDF index 172), explicitly states that isolated verbal / newer
colloquial usages are **more often** ㄍㄟˇ, while compound words are **more often**
ㄐㄧˇ. The key phrase is **多音**, not *always*. We must not turn this into
an exceptionless one-character rule.

- Primary source: https://language.moe.gov.tw/001/Upload/Files/wxiao89/a.pdf
- Dictionary: https://dict.revised.moe.edu.tw/dictView.jsp?ID=5423
- Concised entries: https://dict.concised.moe.edu.tw/dictView.jsp?ID=21535 and
  https://dict.concised.moe.edu.tw/dictView.jsp?ID=16048

The new **read-only** `audit-attested-give-lexical-boundary.ts` compares
original source token boundaries before reading MOE-reviewed gold. On the
already-opened **dev** diagnostic, the four target-character occurrences are:

| Case ID | Source lexical token | Boundary type | Reviewed target |
|---|---|---|---|
| gsd-013 | 給 | standalone | ㄍㄟˇ |
| gsd-014 | 給予 | multi-character lexeme | ㄐㄧˇ |
| gsd-015 | 給 | standalone | ㄍㄟˇ |
| gsd-016 | 補給 | multi-character lexeme | ㄐㄧˇ |

The source-provided **word boundaries are oracle inputs**. Existing catalog
filtering still leaves the standalone tokens ambiguous; the two compounds
have their lexical readings. No sentence parser, automatic POS predictor,
learned context classifier, or new product reading gate is implemented.
Altered-gold tests assert that both the token boundary and candidate frontier
stay unchanged. Neither source `Translit` nor learner weakness history is used
for the candidate frontier.

**Research decision:** stop treating an opposing same-word+same-UPOS standalone
`給/ㄐㄧˇ` as an assumed plentiful modern contrast. It may be rare, historical,
or tied to register; investigate those possibilities separately, without
relabelling existing contexts or cherry-picking balancing examples. Prioritize
whole-lexeme identification and independent registration of grammatical
functions, with a genuinely sealed evaluation set before any deployment.

## Quality gate correction

The preceding Draft head `a288d1058b793b7b88967b316132bee8f2094a77`
had green specialist audits but failed the **full** `check` workflow at
TypeScript compile time, with eight errors in the new UD source checker/test.
The follow-up changes address strict CoNLL-U column types, the source-file
property in the test-bank schema, and safe test-only mutation typing. Do not
claim the new head is globally green until its exact-head `check` completes.


## Full train frontier audit: uniqueness is not correctness

The fixed, source-verified GSD train queue contains **190 standalone tokens**
of `種` / `給`. The read-only risk audit now groups **only by original
whole token + oracle source UPOS**, then uses the **shipping catalog and
reading gate** to inspect candidate sets, with no gold consulted.

| Token / raw UPOS | Occurrences | Shipping frontier | Existing opt-in 種 trial |
|---|---:|---|---|
| 種 / NOUN | 148 | ambiguous 3rd/4th tone | uniquely 3rd tone |
| 種 / VERB | 1 | ambiguous 3rd/4th tone | uniquely 4th tone |
| 種 / PART | 5 | ambiguous 3rd/4th tone | ambiguous |
| 給 / VERB | 35 | ambiguous gěi / jǐ | ambiguous |
| 給 / ADP | 1 | ambiguous gěi / jǐ | ambiguous |

**Total: shipping 0/190 unique; trial 149/190 unique, with ZERO
independently approved phonetic labels among these 190 train rows.**
These numbers indicate only the effect of a candidate **filter**, not
pronunciation correctness or an app end-to-end prediction rate.

The real `train-s3887#2` nominal-species source annotation is `VERB`,
and its provisional ㄓㄨㄥˇ lexical-sense interpretation directly
contradicts the trial's forced ㄓㄨㄥˋ. In addition, five apparent species
noun contexts are marked `PART`; they provide no reliable supporting
evidence for an asserted POS-to-pronunciation rule.

### Exhaustive first pass on standalone 給 in train

We inspected the **complete original sentences** for all **36** standalone
`給` occurrences available in the pinned train source: 35 raw VERB,
1 raw ADP. The first-pass contextual reading is provisionally ㄍㄟˇ for
all 36. Situations include everyday giving/transfer, recipient and
benefactive functions, and the constructional `給搞錯` / `給殺掉`.
Neither source's `Translit` nor the catalog-selected reading was used as
the answer source. **No clear standalone ㄐㄧˇ counterexample was seen
within these 36**. That is a limitation of this corpus slice, not
evidence that such a reading is universally impossible.

The researcher-first-pass rows are in
`train-give-preliminary-review.json`, with exact `sentenceId/tokenId`,
tentative reading and contextual category. CI validates **all 36**
against the pinned original train queue and fails if a case is fabricated,
omitted or duplicated. Its status is deliberately:
- `independentSecondReviewComplete: false`;
- `eligibleAsGold: false`;
- `eligibleForModelTraining: false`;
- `shouldTriggerProductionReadingGate: false`.

This is **not 36 newly verified gold labels**. The only original
18 MOE-checked dev targets remain exploratory. Test stays sealed.

**Decision:** no supervised binary model may claim a `給/VERB` ㄐㄧˇ
class based on this train queue; `給予` and `補給` are whole compounds,
not standalone positive examples of the same input. Seek truly attested,
licensable opposing tokens or move the disambiguation target to
**word identity and register**, while keeping weak-key selection downstream
of approved pronunciation.


## Bridge back to actual generated practice: 2,048 seeded utterances

The existing **product-family formal-syntax composer**, with its **reviewed
role reading policy** applied, already has 2,048 deterministic sampled
outputs under \`formal-syntax-v2-phase1-product-baseline-v1\`.
These are generated candidates **not actual user practice sessions**, and
their fluency/naturalness has not been verified.

A read-only inspection of the saved CI artifact at head \`644f9aff\`
found among these generated sentences:

| Candidate identity / supplied generated UPOS | Seen in 2,048 outputs |
|---|---:|
| 種 / NOUN / ㄓㄨㄥˋ | **6** |
| 種 / NOUN / ㄓㄨㄥˇ | 5 |
| 種 / VERB / ㄓㄨㄥˋ | 1 |
| 給 / VERB / ㄐㄧˇ | **8** |
| 給 / VERB / ㄍㄟˇ | 10 |

Examples from actual logged generated outputs:

- Seed 1783: \`他們給對方\` — identity \`word:給:ㄐㄧ3\`, VERB.
- Seed 443: \`多少種那為必須李\` — identity \`word:種:ㄓㄨㄥ4\`, NOUN.
- Seed 872: \`她給第十三摩登\` — identity \`word:給:ㄐㄧ3\`, VERB.

These sentences include significant syntax/semantic problems. **Do not
call them human-reviewed wrong pronunciations or coherent natural contexts.**
Yet they do show that the generator *can select* such combinations; the
previous train-only ambiguity problem is not isolated from the product
candidate pipeline. Weakness-based selection must not be asked to decide
their phonetic correctness.

The new \`audit-generated-polyphonic-risk.ts\` is now added to the existing
2,048-seed polyphonic-exposure workflow, consuming the
\`polyphonic-context-reviewed-roles.json\` and
\`polyphonic-context-zhong-role-trial.json\` files already produced there.
It checks exact seed/entry identity and exports each flagged sentence to
\`generated-attested-polyphonic-risk.json\`. Counts are **exposures**, with
\`reviewedWrongReadingCount: null\` and \`contextReadingVerified: false\`,
not errors, accuracy, or human review. The noun/verb trial may reduce a
candidate's presence without making the resulting utterance natural.

**Research decision:** before applying new sense gates to product practice,
establish acceptable *utterance/lexical collocation* evidence, and test
phonetic reliability separately from sentence naturalness. A candidate
with an explicit wrong/unknown context must not be treated as a safe
one-answer practice item just because its reading identity exists
in the lexical catalog.


## 2026-10-23: generated exercise usability is a separate blocking dimension

The latest 2,048-seed **reviewed-roles** output contains 30 occurrences of
`種` / `給` (12 and 18, respectively). Of these, 14 match predefined
reading-identity risk signatures. The full output was inspected (not only
the 14 flagged examples) before making a first-pass naturalness assessment:

| Provisional issue type | Occurrences |
|---|---:|
| Clearly incoherent lexical sequence | 22 |
| Incomplete clause / missing complement | 6 |
| Fragment requiring earlier discourse | 2 |
| **Total examined** | **30** |

All 30 are **unsuitable to accept automatically as independently verified,
self-contained practice sentences without further review**. This is a
**qualitative first-pass** assessment of this **biased target-word subset**,
NOT a random sample of all generated sentences. Some fragments may be valid
in a larger discourse, and this report does not assert that every
pronunciation in them is incorrect. Separate sentence-naturalness and
phonetic-reading approval are both still pending.

The exact first-pass judgments and concise reasons are in
`generated-2048-first-pass-naturalness.json`. CI compares all 30
`seedIndex + original generated text` pairs with the source-generated JSON
artifact, including all 16 non-flagged controls. It rejects omissions,
fabricated sentences, duplicate annotations or a claim of validated gold.
It does not repair/rewrite the source utterances.

### Concrete generator boundary identified

The product `selectFormalSyntaxUtterance` passes a reviewed reading
eligibility gate and curriculum weights into
`composeFormalSyntaxUtterances`, but does **not** pass an
`input.lexicalCompatibility` evidence index. The composer has this
optional interface, and `src/compatibility/lexical-pairs.ts` implements
positive corpus-attested adjacent-word bonuses. Existing
`docs/lexical-compatibility.md` explicitly states that the browser
catalog does **not** yet ship a reviewed compatibility artifact. Thus
sentence selection currently has no active co-occurrence score from that
feature.

Even activating its existing formula, `1 + score * maximumBoost`,
would **not** be a semantic legality filter:
missing pairs remain neutral and a boost to adjacent words cannot
guarantee coherent multiword clauses, argument structure, word sense,
or complete self-contained exercise text.

**Bounded next decision:** independently review a controlled sample of
generated practice utterances and their lexical roles **before** any
production compatibility activation; distinguish
(A) whole-lexeme target reading evidence,
(B) sentence/slot lexical selectional compatibility,
(C) discourse-complete exercise suitability,
and (D) downstream learner weakness weighting.
Keep training gold and production authorization **false** on these
30 first-pass annotations. Do not use "unique pronunciation count",
"positive corpus pair score" or "syntactically legal" alone as proof
of a usable exercise.
