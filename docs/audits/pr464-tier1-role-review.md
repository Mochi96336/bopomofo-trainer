# PR #464 — Tier 1 licensed-slot exclusion review (2026-11-17)

Scope: exact product head 2bd6e024ee9f58ed6266ddf6dbeae1dde88659e1. Independent audit Draft PR #465. No production policy changed.

## Reproducible structural results

| Sample scope | Filter calls | Calls removing profiles | Removed profile appearances | Share | Distinct word×UPOS | Distinct words |
|---|---:|---:|---:|---:|---:|---:|
| All | 571 | 352 | 18,743 / 819,170 | 2.29% | 185 | 148 |
| Tier 1 | 599 | 336 | 9,253 / 99,224 | 9.33% | 101 | 65 |
| Tier 2 | 547 | 254 | 4,322 / 137,111 | 3.15% | 39 | 35 |
| Tier 3 | 612 | 311 | 3,404 / 199,283 | 1.71% | 32 | 32 |
| Tier 4 | 545 | 200 | 2,188 / 393,152 | 0.56% | 18 | 18 |

Source: docs/audits/pr464-slot-frontier-census.csv, produced from actual 128-delivery product sampling for each scope. Counts are repeated appearances in executed slots/retries, not exercise exposure loss or verified pronunciation errors.

## Decisive evidence granularity issue

ALL 101 Tier-1 blocked written-form×UPOS groups have identical source-projected RuntimeSyntaxProfiles for every reading of that group. Each reading has one profile. The 219 reading×UPOS profiles match on functions, valencyFrames, dependencyEvidence, and provenanceIds inside their own group. The source profile cannot distinguish their reading meanings.

Tier-1 group counts by UPOS: VERB 30, NOUN 30, ADP 10, ADV 9, ADJ 9, PART 8, PROPN 4, PRON 1.

## Five source-supported narrow exact reading×UPOS exclusions (PROPOSED ONLY)

| Group | Exclude exact reading ID | Retain | Observed blocked slot-group visits | MOE evidence |
|---|---|---|---:|---|
| 都/NOUN | word:都:ㄉㄡ1 | ㄉㄨ | 72 | https://dict.revised.moe.edu.tw/dictView.jsp?ID=1986 |
| 說/NOUN | word:說:ㄕㄨㄟ4 | ㄕㄨㄛ | 66 | https://dict.revised.moe.edu.tw/dictView.jsp?ID=9168 |
| 號/NOUN | word:號:ㄏㄠ2 | ㄏㄠˋ | 81 | https://dict.revised.moe.edu.tw/dictView.jsp?ID=4810&ver=4 |
| 了/VERB | word:了:ㄌㄜ5 | ㄌㄧㄠˇ | 21 | https://dict.revised.moe.edu.tw/dictView.jsp?ID=3550 |
| 給/ADP | word:給:ㄐㄧ3 | ㄍㄟˇ | 1 | https://dict.revised.moe.edu.tw/dictView.jsp?ID=3994 |

Reasoning: dōu = ADV/PART vs dū = NOUN; shuì = persuasion VERB vs shuō = NOUN; háo = crying/calling VERB vs hào = NOUN; le = grammatical PART vs liǎo = lexical VERB; jǐ has noun/verb/adjective meaning vs gěi additionally has ADP use. These five restrictions are not blanket word exclusions. Dictionary role matches alone are not held-out sentence-level pronunciation gold.

Counterfactual product-selection probe: tests/readings/pr464-narrow-role-whatif.audit.test.ts, read-only test injection. Before deployment, verify positive and negative sentence contexts, unchanged unrelated UPOS, correct identity bindings, no banned reading exposure, and historical frozen audits.

## Explicit reasons NOT to force common readings

- 給/VERB both gěi and jǐ have verbs, semantics differ: https://dict.revised.moe.edu.tw/dictView.jsp?ID=3994
- 看/VERB kān and kàn both verbs; some reading overlap historically: https://dict.revised.moe.edu.tw/dictView.jsp?ID=4531
- 說/VERB shuō and shuì both verbs, senses differ: https://dict.revised.moe.edu.tw/dictView.jsp?ID=9168
- 東西/NOUN full tone means east-west, neutral tone means things; both nominal: https://dict.concised.moe.edu.tw/dictView.jsp?ID=9785 and https://dict.concised.moe.edu.tw/dictView.jsp?ID=9787
- 人家/NOUN full vs neutral tone usage requires lexical-sense context: https://dict.revised.moe.edu.tw/dictView.jsp?ID=135766
- 女/NOUN rǔ is both historical pronoun and surname; dictionary noun is not automatically UD NOUN vs PROPN: https://dict.revised.moe.edu.tw/dictView.jsp?ID=3170
- 句/NOUN gōu has a noun hook/surname meaning: https://dict.revised.moe.edu.tw/dictView.jsp?ID=4040
- 地/PART dì has historical auxiliary uses; de is structural particle: https://dict.revised.moe.edu.tw/dictView.jsp?ID=2142
- 會/NOUN kuài has surname noun and accounting-related verb; huì has nouns: https://dict.revised.moe.edu.tw/dictView.jsp?ID=4610
- 那/PRON classical nuó and other deictic/question readings require sense: https://dict.revised.moe.edu.tw/dictView.jsp?ID=3142

## Review coverage and gate

All 101 groups (65 words) inventoried and verified for repeated source Profile evidence; NOT all 65 have independent sense adjudication. Full matrix: docs/audits/pr464-tier1-role-review-matrix.csv.

Matrix statuses: 5 source-supported-narrow-role-gate candidates; 5 source-confirmed-overlap-requires-context; 5 source-exception-do-not-ban-by-upos; 86 pending-independent-sense-review.

Keep #464 draft. Do not remove abstention globally, approve only a role/context license backed by reviewed reading sense, and independently assess held-out context-correct pronunciation. Candidate-removal percentage is not learner practice loss.
