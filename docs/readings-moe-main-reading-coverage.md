# Main-reading coverage leads from the active catalog

Snapshot: 7347db8, 13,693 packaged reading identities / 13,472 exact written
forms. This inventory compares actual `PRACTICE_CATALOG` readings with the
main Bopomofo field of exact-headword rows in the checksum-pinned June MOE
sources. It does not activate readings, infer new syntax roles, adjudicate
sentence pronunciation, or claim complete dictionary coverage.

## Source scope and result

| Source | Version | All source rows | Rows matching packaged written forms | Matched written forms |
| --- | --- | ---: | ---: | ---: |
| Concised | 2014_20260626 | 45,130 | 9,501 | 9,211 |
| Revised | 2015_20260625 | 163,920 | 11,465 | 10,812 |

Archive SHA-256 pins:

- Concised: `fc83d27eb3fbf6fcfdb791e7d05ef60946b58ef8e8857ed165b612217b392806`.
- Revised: `64003a98fcc7097940e5a536c999bc08ba7c07e2c1be66448f01bf1ae10a53fc`.

The original adapters verify archives, workbooks, dimensions and headers.
Main source Bopomofo is converted using their existing `trainer_reading`;
zero scoped readings failed conversion. Definitions are not emitted. This
inventory does not expand variant-reading columns or resolve cross-references,
so it is a main-row comparison rather than an exhaustive source-reading index.
Proper names and other unmatched forms are not classified as errors.

There are **110 absent Concised main-row readings across 97 packaged forms**;
102 also match a Revised main row exactly. Twenty-six candidate readings belong
to 23 multi-character words. These counts describe source coverage leads,
not 110 incorrect pronunciations or 110 immediately usable practice entries.
Many are bound readings, old usages, distinct lexical functions, or full-tone /
neutral-tone alternatives that need separate context review.

The local metadata report is `data/generated/moe-active-reading-gaps.json`,
SHA-256 `36fb1a6fafda1e718ce27e59598b6e8831c687250016e878082491b4d626bace`.
The just-added `嵌/ㄑㄧㄢ1` is no longer a missing-source-reading candidate.

## Concrete follow-up leads

| Written form | Current catalog readings | Absent Concised reading | Concised / Revised bulk IDs |
| --- | --- | --- | --- |
| 和 | ㄏㄜ2, ㄏㄜ4, ㄏㄨ2, ㄏㄨㄛ2, ㄏㄨㄛ4 | ㄏㄢ4 | 2771 / 04883 |
| 和 | same | ㄏㄨㄛ5 | 2877 / 05069 |
| 比 | ㄅㄧ1, ㄅㄧ3 | ㄅㄧ4 | 0170 / 00330 |
| 比 | same | ㄆㄧ2 | 0422 / 00816 |
| 那裡 | ㄋㄚ4 ㄌㄧ5 | ㄋㄚ4 ㄌㄧ3 | 1590000012 / 029300016 |
| 那裡 | same | ㄋㄚ3 ㄌㄧ3 | 158400003 / 029200012 |
| 姑娘 | ㄍㄨ1 ㄋㄧㄤ5 | ㄍㄨ1 ㄋㄧㄤ2 | 2334000031 / 041360012 |
| 便宜 | ㄅㄧㄢ4 ㄧ2, ㄆㄧㄢ2 ㄧ5 | ㄆㄧㄢ2 ㄧ2 | 047300002 / no main-row match |

These bulk IDs are not online dictionary page IDs. A missing Revised main-row
match is not evidence against the Concised reading.

The hàn coordinator is the first source-confirmed construction lead:
[Concised 和/hàn](https://dict.concised.moe.edu.tw/dictView.jsp?ID=19725)
identifies it as the spoken pronunciation of sense 7 under
[和/hé](https://dict.concised.moe.edu.tw/dictView.jsp?ID=19016), the coordinating
usage. The active catalog lacks that identity, and the current
`CONSTRUCTION_READINGS["和"]` allows only `ㄏㄜ2`. Adding a catalog row alone
would therefore not provide correct coordination practice. A follow-up should
add the source-backed identity and its reviewed coordinator license together,
confirm real coordinator dependency evidence, retain hé, and leave other hàn
roles context-required until separately supported.

The separate [和/huo](https://dict.concised.moe.edu.tw/dictView.jsp?ID=20436)
entry is bound in warming words such as 暖和. It is not a reason to permit a
neutral-tone standalone coordinator. Similarly, the standard 比 identity gate
already recognizes ㄅㄧ4 and ㄆㄧ2, but those IDs are absent from the actual
catalog. Tests that construct either identity demonstrate policy behavior only;
they do not establish real practice availability.

## Reproduction boundary

Build the input from actual packaged entry IDs, reversing each reading exactly
through `catalogEntryId`; do not derive targets from provisional CSV readings or
from the five-word sense pilot. Group by exact written form, preserving every
existing reading identity and its observed profiles. Call `load_adapter` and
`read_source_rows` from the existing offline MOE adapters with this written-form
set, then compare converted main readings with the catalog's full reading set.
Keep every matching source ID and physical row. The five-word CLI's target
validation remains unchanged.

Any activation still needs explicit reading evidence, appropriate observed
syntax, ordered product licensing, preservation of existing identities and
compact profile order, a new current-catalog replay, and accurate distinction
between source attestation, static eligibility, observed selection and reviewed
contextual correctness. This inventory supplies no human-approved labels.
