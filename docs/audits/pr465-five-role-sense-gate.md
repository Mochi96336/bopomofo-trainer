# PR #465 — Five-role sense / whole-lexeme boundary gate (2026-11-18)

## Answer and release decision

**DO NOT restore isolated words just because the MOE dictionary attests a reading × POS.**
The canonical full-grammar biased probe confirmed structural reachability for 5/5 cases, but produced ungrammatical/semantically incoherent sentences. The dictionary attests selected senses and host examples, not arbitrary word×UPOS contexts. The current CI's correctness is syntactic/engineering, NOT educational content correctness.

Baseline: #464 head `2bd6e024ee9f58ed6266ddf6dbeae1dde88659e1`. This audit only modifies draft #465; shipped policy and main catalog are unchanged.

## Exact active lexical-host inventory

Read-only test: `tests/readings/pr465-five-role-host-coverage.audit.test.ts`.
Evidence file: `docs/audits/pr465-five-role-host-coverage.csv`.
Data: real compiled `PRACTICE_CATALOG`, `SYNTAX_PROFILES`, `inspectHostLexemeReadiness`, and `productReadingEligibleWithoutPreviousEntry`.

| Isolated reading/role under review | Checked illustrative hosts | Exact host entries in active catalog | Hosts with a matching UPOS |
|---|---:|---:|---:|
| 都/ㄉㄨ/NOUN | 5 | 2 — 首都、都城 | 2 |
| 說/ㄕㄨㄛ/NOUN | 5 | 2 — 說法、說明 | 1 — 說法 |
| 號/ㄏㄠ4/NOUN | 5 | 3 — 編號、稱號、外號 | 3 |
| 了/ㄌㄧㄠ3/VERB | 4 | 0 | 0 |
| 給/ㄍㄟ3/ADP | 4 | 1 — 送給 | 0 |
| **Total** | **23** | **8** | **6** |

The 15 missing hosts are NOT a list of 15 observed product failures or a mandate to add 15 words. The hosts are a deliberately non-exhaustive *illustrative* sample. `給他` is a dictionary-example phrase, not assumed a standalone word. Distinguish exact selected entry IDs from substrings in rendered text.

### Why the 8 present hosts do not license the 5 isolated readings

- 首都、都城 are atomic NOUN identities with ㄉㄨ. Their attestations cannot license arbitrary isolated 都/NOUN usage (e.g. `請像都存在神話`). Source: https://dict.revised.moe.edu.tw/dictView.jsp?ID=2280
- 說法 is a NOUN whole word with ㄕㄨㄛ, while 說明 is VERB. Neither licenses a standalone 說/NOUN in arbitrary compositional slots, and unrelated `遊說` requires ㄕㄨㄟˋ and its own token identity. Source: https://dict.revised.moe.edu.tw/dictView.jsp?ID=9136
- 編號、稱號、外號 are whole words with ㄏㄠˋ, not general proof of isolated 號/NOUN usability. Source: https://dict.revised.moe.edu.tw/dictView.jsp?ID=4827
- 了/ㄌㄧㄠˇ has lexical completion/understanding senses (e.g. the documented `責任未了`), but none of four illustrative complete hosts are currently an atomic catalog entry; an unattested arbitrary `了` verb slot must not be enabled. Source: https://dict.revised.moe.edu.tw/dictView.jsp?ID=3550
- 送給 is an existing **VERB** whole-word identity, NOT evidence that a standalone 給/ADP forms a valid general locative AdpositionPhrase. The canonical targeted example `給學業存在壽宴與象牙` was structurally legal but not educationally usable. Source: https://dict.revised.moe.edu.tw/dictView.jsp?ID=3994

## Separate frequency boundary

The source NAER `data/commonness/naer-1141208-active-catalog-rows.json` reports these written-form ranks: 了=9, 都=16, 說=17, 給=111, 號=1026. These are **not pronunciation-specific or sense-specific ranks**.
`src/commonness/tiers.ts` explicitly assigns equal commonness to every reading of the same written form; `src/curriculum/lexical-selection.ts` is written-form-first.
Therefore Tier-1 exclusion is NOT automatically frequent *sense* suppression. Do not relabel the 9.33% candidate-occurrence removal as lost valid user practice.

## Which evidence is missing

| Gate | Existing evidence | Passed? |
|---|---|---|
| Dictionary reading and a part-of-speech gloss | Official MOE entries above | Yes, narrow word/reading/role only |
| Exact active catalog host identity | 23-host compiled catalog inventory | 8/23 present, 15/23 absent |
| Comparable runtime syntax profile | Current identity projection | 6/23 host cases have matching UPOS |
| Isolated word has correct intended meaning in this exact construction | No independent context-labeled corpus or role/sense annotation | No |
| Full generated sentence is idiomatic and educationally valid | Counterexamples from canonical output; no human-reviewed positives | No |

## Sound next implementation boundary

1. Reuse already-present atomic hosts **as full word entry IDs** for coverage. Never concatenate characters or infer host success from `candidate.text.includes(host)`.
2. For a standalone polyphonic reading, require independently sourced **whole occurrence-level** sense/role evidence, ideally from verified word segmentation + pronunciation + semantic frame or a carefully reviewed natural-sentence fixture. Exact sentence context is necessary; bare UPOS and adjacent surface string are insufficient.
3. Formalize a *review-only* context fixture schema: `source sentence, token boundaries, target catalog entryId, UPOS, reading, semantic relation/frame, attestation URL/license, source date, negative contrasts, label status, independent reviewer, release-eligible=false`. Do not mark generated examples or dictionary compound headwords as sentence gold.
4. In the product pipeline use fail-closed behavior whenever reading/sense cannot be disambiguated. A reading-specific prior can be introduced only from actual reading-labeled exposure; borrowing written-form rank is not evidence.
5. Before changing any policy, freeze a small, independent held-out set of natural sentences and compare correct accepted versus wrongly accepted at the **selected lexical entry ID** boundary. Keep the existing 2048-seed history and the original full-grammar same-seed regression frozen.

## Fixed counterexamples from canonical full-grammar audit

- `請像都存在神話` — 都/ㄉㄨ/NOUN appears; not evidence of a coherent nominal sense.
- `說李` — 說/ㄕㄨㄛ/NOUN appears; bare noun+proper name does not establish idiomatic usage.
- `號嚴峻` — 號/ㄏㄠ4/NOUN appears; lacks established meaning in context.
- `妳了過嗎` — 了/ㄌㄧㄠ3/VERB appears; no licensed completion construction.
- `給學業存在壽宴與象牙` — 給/ㄍㄟ3/ADP appears in a canonical existential/adposition phrase, but its usage is implausible.

These are examples selected from actual CI logs, not hypothetical sentences and not necessarily an exhaustive list of the generator's errors. The recognition of a formal grammar production is **not** a language acceptability judgement.

## Final acceptance

**Lexical identity and boundary inventory PASS (documentary); sense-context and educational sentence acceptance NOT PASSED.**
Do not merge #464/#465 as a sense-licensing production change. Preserve Draft, exact evidence IDs, source references and failure status.
