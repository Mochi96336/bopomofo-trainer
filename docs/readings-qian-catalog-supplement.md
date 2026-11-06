# Source-backed 嵌 qiān catalog supplement

The previous catalog contained `嵌/ㄎㄢ3` and `嵌/ㄑㄧㄢ4`, but omitted the
ordinary embedding reading `嵌/ㄑㄧㄢ1`. This addition retains both existing
identities and adds the missing exact reading with MOE provenance.

## Reading and syntax evidence

[MOE Concised 嵌](https://dict.concised.moe.edu.tw/dictView.jsp?ID=25109)
identifies qiān for embedding. Its separate [kǎn entry](https://dict.concised.moe.edu.tw/dictView.jsp?ID=18430)
points to 赤嵌樓. [MOE Revised 嵌](https://dict.revised.moe.edu.tw/dictView.jsp?ID=4522)
separates embedding qiān, the qiàn adjective and the bound place-name kǎn.
This does not establish arbitrary full-sentence pronunciation labels.

The pinned June source adapters independently matched the three exact readings:

| Reading | Concised bulk ID / physical row | Revised bulk ID / physical row |
| --- | --- | --- |
| ㄑㄧㄢ1 | 3654 / 24724 | 06447 / 6455 |
| ㄑㄧㄢ4 | absent in this projection | 06489 / 6498 |
| ㄎㄢ3 | 2558 / 18147 | 04510A / 4517 |

Metadata and fingerprints are committed in
`data/readings/moe-qian-reading-source-evidence.json`, SHA-256
`ca5350745d4a17ccb557ab54f078672518c127648f21c9dcb7ef44c02f713bd5`.
Original definitions remain private under ignored `data/external/`. These bulk
IDs must not be converted into online dictionary page URLs.

The new identity reuses the already observed exact-form UD profile, not a guessed
new role: VERB, transitive, with `xcomp: 1` and `parataxis: 1` evidence.
The source profile is
`syntax-profile:7f19031ed6675ed77a793fb9bf7db0d3f3e0c9d8bb69c70eedf2502574b1965d`;
the new bound runtime source profile is
`runtime-syntax-profile:97add0d9113bde0edc21802f17d0ed20a73b2838b0a399c8dbd39290baf53d94`.
Dictionary reading attestation and written-form syntax evidence remain distinct.

## Rebuild and preservation boundary

The current projection was regenerated from the existing manifest-linked
160,000-candidate inputs, using the current projector and grammar. Its profile
projection digest remains the existing
`fa54405dba58422be461fffb59e99d6718e376492d93af34ddbe79f5005e1efe`.
The refreshed source index digest is
`f1b4c78dc96ad0bd8f446be372c3023dcb9b489630d32a2c99be37df194b8459`.
The grammar-rules digest is unchanged.

```sh
npx tsx scripts/build-lexicon-syntax-generation.ts --candidates data/generated/lexicon/naer-1141208-top-160000/candidates.csv --candidate-manifest data/generated/lexicon/naer-1141208-top-160000/manifest.json --evidence data/generated/lexicon/naer-1141208-top-160000/ud-evidence.json --profiles-output data/generated/qian-catalog-supplement/syntax-profiles.json --rule-index-output data/generated/qian-catalog-supplement/syntax-rule-index.json
npx tsx scripts/build-app-syntax-legality.ts --rule-index data/generated/qian-catalog-supplement/syntax-rule-index.json --profiles data/generated/qian-catalog-supplement/syntax-profiles.json --preserve-profile-order data/grammar/formal-syntax-active-catalog-profiles.json
```

Refresh morphology and the seven occurrence-capability artifacts with their
existing `--write` migrations before `npm run check:pr`. The source index excludes
206 identities before reviewed runtime capabilities; current product packaging
excludes 205 after those capabilities. Keeping all observed base profiles is
necessary to preserve that legitimately recovered entry.

The compiled source catalog grows from 13,897 to 13,898 identities, its base
profiles from 16,266 to 16,267, and the shipped catalog from 13,692 to 13,693
entries / 16,062 profiles. Every old catalog entry, source profile identity,
syntax-bearing profile field and existing occurrence capability was checked
against the pre-addition snapshot and retained. New profiles are appended to the
prior validated profile order, preserving old compact IDs.

NAER evidence remains written-form keyed. All three 嵌 identities share the same
frequency record; no old word's frequency weight changes. The catalog-based
quantile cut points are recomputed by the existing contract. This moves 短期
from tier 3 to tier 2 and 甘草 from tier 4 to tier 3; other old tier memberships
are unchanged. This is a consequence of adding one catalog identity, not a
change to source frequency evidence.

## Validation and catalog versions

`npm run check:pr` passed 1,387 Vitest tests, 76 Python source-adapter tests,
type checking, catalog validation, production build and the bundle budget.
All 62 Chromium tests passed against the same production asset
`index-Dn5wpS4T.js`; JavaScript gzip size is 481.20 kB (decimal).

A current-catalog 4,096-seed `standard-role-extended-trial` replay completed with
zero generation failures. The new qiān identity appeared naturally at seed
24/slot 3 and 2257/slot 3, and a separate bounded targeted probe also selected it.
These observations prove selection availability, not independently adjudicated
whole-sentence pronunciation or naturalness.

Adding a candidate changes the sampling population: 166 seeds differ from the
pre-addition replay (74 in its first half), with zero root or entry-count changes.
These are catalog-induced redraws, not 166 pronunciation repairs. Polyphonic
occurrences change from 2,062 to 2,058, with 131 ambiguous written forms observed
in each population. The old compact profile IDs are preserved; old source
profile and catalog-entry contents were independently checked unchanged.

| Local artifact | SHA-256 |
| --- | --- |
| `qian-catalog-stable-exposure.json` | `5c1bd8c8770669d671650ec673149f8f2f5dab1dbd264642f6b7a2bd5058beb4` |
| `qian-catalog-stable-diff.json` | `e054f94572b4dd10d29760df10e7954926d8009fe497c78e608053c645eadf8b` |
| `qian-catalog-supplement-check.json` | `41c9f0ffe944f24e35d5c270de60bbbaadb3ee98c2bcaefc76899710df261355` |

Historical role comparisons require their original population. The existing
historical exposure workflow explicitly sets `READING_AUDIT_CATALOG=before-qian`.
`reading-audit-catalog.ts` reconstructs the be37cac catalog by omitting this one
addition, then verifies complete catalog and profile fingerprints; mismatches
fail closed. It does not change product inputs. Outside that historical job the
audits default to the current catalog, and `current-product` targeted probes
reject the historical override.

The full 4,096-seed historical replay was also rerun under that override and
reproduced the original report byte-for-byte, SHA-256
`c1f2c6cdc468a1d409625ec8b0e2a5aeacad8050da7d0a11e6e39ffdc4d6e2d3`.

```powershell
$env:READING_AUDIT_CATALOG = 'current'
npx tsx scripts/audit-polyphonic-context.ts --samples 4096 --policy standard-role-extended-trial --output data/generated/qian-catalog-stable-exposure.json
```

## Independent VERB restriction after the addition

`standard-qian-role-trial` adds one later redraw stage after the frozen extended
policy. It rejects only `嵌/ㄎㄢ3/VERB` and `嵌/ㄑㄧㄢ4/VERB`. The dictionary's
qiàn ADJ and bound 赤嵌樓 readings remain outside that restriction, while qiān
keeps its attested VERB and ADJ uses. This does not invent new runtime profiles.

The before population is the enlarged 13,693-entry catalog at b6e80fb, with
SHA-256 `5c1bd8c8770669d671650ec673149f8f2f5dab1dbd264642f6b7a2bd5058beb4`.
The frozen incompatible position is seed 2864/slot 2, `嵌/ㄎㄢ3/VERB`; qiàn
does not occur in this baseline. Both populations generate 4,096/4,096 sentences.
The one reviewed mismatch becomes zero, and only that one lexical slot changes,
from `word:嵌:ㄎㄢ3` to `word:攔截:ㄌㄢ2-ㄐㄧㄝ2`. The replacement reading
matches committed Concised bulk row `181900003` (physical row 13521). Because
the written word changes, this is candidate exclusion rather than a same-word
tone correction. Sentence roots, entry counts and all other slots are unchanged.

The two qiān selections at 24/3 and 2257/3 remain exact preservation controls.
The comparison also requires complete, unique hit records for every selected
嵌 identity, matching the actual sentence position and the three frozen VERB
profiles. Omitting a bad replacement's hit, inventing another UPOS, or reusing
the old 13,692-entry catalog cannot produce a passing comparison.

```powershell
$env:READING_AUDIT_CATALOG = 'current'
npx tsx scripts/audit-polyphonic-context.ts --samples 4096 --policy standard-qian-role-trial --output data/generated/qian-role-after.json
npx tsx scripts/compare-moe-role-supplement.ts data/generated/qian-catalog-stable-exposure.json data/generated/qian-role-after.json data/generated/qian-role-comparison.json
```

| Local artifact | SHA-256 |
| --- | --- |
| `qian-role-after.json` | `8f6ca923b1e960ecd8c43b458c3deb62d64d5c709853091243d39e15372f7e69` |
| `qian-role-comparison.json` | `3298e8884fd1fd745003149d70307ac34136f307ed9fa8ef9877a4c0df01dede` |

All three reading identities remain in the catalog. The two restricted readings
currently have only VERB profiles, so they no longer have a selectable free-
sentence profile; retaining their IDs does not prove practice availability.
They still require an evidenced adjective/bound-word or separate practice route.
The current targeted audit reports 403 ambiguous reading identities: 195 observed
in the baseline, 104 selected only in targeted probes, 73 not observed after
bounded probes, and 31 with all profiles rejected. None of these statuses is a
human pronunciation label or proof that every rejected reading is invalid.

Follow-up validation: `npm run check:pr` passed 1,400 Vitest tests, 76 Python
source-adapter tests, type checking, catalog validation, build and bundle budget.
JavaScript gzip size is 481.27 kB (decimal). This follow-up does not claim a new
browser test run or independently approved whole-sentence readings.

## Other source-attested preservation cases

The same source review confirmed two legitimate rare cases to preserve:
[藏/cáng](https://dict.revised.moe.edu.tw/dictView.jsp?ID=9592) is an attested
surname, and [弟/tì](https://dict.revised.moe.edu.tw/dictView.jsp?ID=2653) has
a genuine ethical-concept NOUN sense as well as VERB/ADV uses. Their unfamiliar
PROPN/NOUN exposures are not grounds for a new blanket rejection.
