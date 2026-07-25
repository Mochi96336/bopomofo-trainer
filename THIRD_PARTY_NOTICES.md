# 第三方資料來源與授權聲明

## 這份文件的效力範圍

- 根目錄的 [MIT License](LICENSE) **只涵蓋**本專案作者原創、且未在本文件或檔案內另行標示的程式碼與文件。
- 本 repository 收錄或引用的第三方辭典、語料、詞頻表、資料集，以及由它們衍生的**投影產物（projections）**，**仍受各自原始授權與使用規範拘束**，不因被收錄、被轉換格式或被縮減範圍而改採 MIT License。
- 一份檔案同時包含本專案的結構與第三方的內容時，結構屬於 MIT，內容屬於原始授權；兩者不互相覆蓋。
- 本專案與教育部、國家教育研究院、CC-CEDICT 專案、Universal Dependencies 專案之間**沒有任何隸屬、合作、認可或背書關係**。列出這些來源是為了 attribution 與可追溯性，不代表對方認可本專案的處理方式或成果。
- 本文件是工程與 provenance 紀錄，**不是法律意見**。正式對外發布、重新散布或商業使用前，應自行向各來源機構確認當時的使用規範。

## 名詞

- **完整原始資料（source archive）**：官方提供的原始壓縮檔、工作簿或語料檔。本 repository **一律不提交**，全部保留在本機的 `data/external/`（已列入 `.gitignore`）。
- **候選範圍產物（catalog-scoped artifact）**：只針對本專案 catalog 中實際存在的詞條，投影出產品所需最小欄位的小型檔案。這類檔案會提交。
- **網站產物（shipped artifact）**：`npm run build` 產生、部署到 GitHub Pages 的 bundle。其中的 `src/app/generated/catalog.ts` 嵌入了下列來源的衍生資料（讀音、常用度權重、句法 profile）。

## 來源總表

| 名稱 | source ID | 版本 / release | 已確認授權 | 是否提交完整原始資料 | 是否提交候選範圍產物 |
| --- | --- | --- | --- | --- | --- |
| 教育部《國語辭典簡編本》 | `moe:concised-dictionary` | `2014_20260626` | CC BY-ND 3.0 TW | 否 | 是 |
| 教育部《重編國語辭典修訂本》 | `moe:revised-dictionary` | `2015_20260625` | CC BY-ND 3.0 TW | 否 | 是 |
| 教育部《國語注音符號手冊》 | `moe:phonetic-symbols-manual` | 未固定版本 | CC BY-ND 3.0 TW | 否 | 否（僅作方法參考） |
| CC-CEDICT | `cc-cedict:manual-release` | `2026-07-21T11:22:36Z`（MDBG release） | CC BY-SA 4.0 | 否 | 是 |
| Universal Dependencies Chinese GSD | `ud:chinese-gsd-r2.18` | `r2.18` | CC BY-SA 4.0 | 否 | 是（僅 aggregate evidence） |
| 國家教育研究院 通用詞頻表 | `naer:coct-general-frequency` | `1141208`（定稿） | **待確認** | 否 | 是 |
| 國家教育研究院 三等七級詞語表 | `naer:graded-words:2025-04` | `14452詞語表202504` | **待確認** | 否 | 否（僅登記，未使用） |

---

## 1. 教育部《國語辭典簡編本》

- **名稱**：國語辭典簡編本
- **提供者**：中華民國教育部（Ministry of Education, R.O.C. (Taiwan)）
- **source ID**：`moe:concised-dictionary`
- **使用版本**：`2014_20260626`
- **官方來源網址**：
  - 下載頁：<https://language.moe.gov.tw/001/Upload/Files/site_content/M0001/respub/dict_concised_download.html>
  - 本次取得的檔案：`.../download/dict_concised_2014_20260626.zip`
  - 外層 ZIP SHA-256：`fc83d27eb3fbf6fcfdb791e7d05ef60946b58ef8e8857ed165b612217b392806`
  - 內部 XLSX（`dict_concised_2014_20260626.xlsx`）SHA-256：`a9a4fd7259180113bfae2e94110eae87ac4dcf0bfcc91a6437c3ad4773ab7865`
- **使用目的**：作為現代臺灣華語詞目與讀音的**主要**權威來源，用於確定候選詞的注音。
- **實際使用的欄位**（工作表 `辭典匯出_1150626`，範圍 `A1:O45131`）：
  - `A:字詞名`（詞目）
  - `B:字詞號`（來源詞條 ID）
  - `F:多音排序`
  - `G:注音一式`
  - `O:多音參見訊息`
- **未使用的內容**：釋義、例句、相似詞、相反詞、漢語拼音、圖片、音訊。
- **本專案如何轉換／篩選／投影**：
  - 以 `NFC(trim(text))` 精確比對詞目，只保留 catalog 中實際存在的候選詞；
  - 保留來源詞目與來源注音字串原文作為證據；
  - 另以獨立欄位記錄本專案自行推導的查詢鍵與**注音聲調符號轉數字**的內部表示（例如 `ㄅㄚˊ` → `ㄅㄚ2`、輕聲 `˙ㄇㄚ` → `ㄇㄚ5`）。
- **是否提交完整原始資料**：**否**。官方 ZIP／XLSX 一律留在本機 `data/external/moe/concised/`。
- **是否提交候選範圍產物**：**是** — [`data/readings/moe-concised-2014_20260626-active-catalog.json`](data/readings/moe-concised-2014_20260626-active-catalog.json)。
- **已確認的授權**：`CC BY-ND 3.0 TW`（依 repository 現有 provenance 紀錄：[`data/provenance.csv`](data/provenance.csv) 與 [`docs/reference-sources/moe-concised-download-and-provenance.md`](docs/reference-sources/moe-concised-download-and-provenance.md)）。官方公眾授權頁面允許重製、散布、傳輸與商業使用，但**禁止改作**，並要求標示出處與遵守使用須知。
- **attribution 要求**：需標示教育部為來源並標示原授權。本文件與網站「關於」區塊即為此標示。
- **redistribution boundary**：
  - 不散布完整釋義、例句、圖片、音訊或完整辭典；
  - 不散布整份改寫後的辭典；
  - 只投影候選詞所需的讀音與來源證據；
  - 不爬取線上辭典，也不依賴非官方的 runtime API。
- **尚未確認的法律或授權問題**：
  - CC BY-ND 禁止改作。本專案將注音聲調符號轉為內部數字格式，**在工程上屬於記法（notation）層級的格式轉換**，不推導變調、不選擇讀音、不改變讀音內容。**本專案不主張這一定不構成 CC BY-ND 意義下的「改作」**，此判斷未經任何法律確認。
  - 候選範圍投影是否落在 BY-ND 允許的「重製與散布」範圍內，亦未經確認。
  - **正式對外發布或商業使用前，仍應再次確認教育部當時的公眾授權條款與使用須知。**

## 2. 教育部《重編國語辭典修訂本》

- **名稱**：重編國語辭典修訂本
- **提供者**：中華民國教育部
- **source ID**：`moe:revised-dictionary`
- **使用版本**：`2015_20260625`
- **官方來源網址**：
  - 下載頁：<https://language.moe.gov.tw/001/Upload/Files/site_content/M0001/respub/dict_reviseddict_download.html>
  - 本次取得的檔案：`.../download/dict_revised_2015_20260625.zip`
  - 外層 ZIP SHA-256：`64003a98fcc7097940e5a536c999bc08ba7c07e2c1be66448f01bf1ae10a53fc`
  - 主工作簿（`dict_revised_2015_20260625.xlsx`）SHA-256：`df94ae4384ae3f33f573ded5c2f142041ea7530d381a285163593d6252ea4a9a`
- **使用目的**：**僅**作為簡編本未收錄時的**暫定（provisional）** 讀音 fallback，權威性低於簡編本。
- **實際使用的欄位**（工作表 `1150625辭典匯出`，範圍 `A1:R163921`）：
  - `A:字詞名`、`D:字詞號`、`H:多音排序`、`I:注音一式`、`Q:多音參見訊息`
- **未使用的內容**：釋義、例句、異體字說明、圖片、音訊。
- **本專案如何轉換／篩選／投影**：與簡編本相同的精確詞目比對與注音數字化；只處理簡編本無法解析的候選詞；歷史或存古讀音一律不自動採用。
- **是否提交完整原始資料**：**否**（留在 `data/external/moe/revised/`）。
- **是否提交候選範圍產物**：**是** — [`data/readings/moe-revised-2015_20260625-active-catalog-fallback.json`](data/readings/moe-revised-2015_20260625-active-catalog-fallback.json)。
- **已確認的授權**：`CC BY-ND 3.0 TW`（依 [`data/provenance.csv`](data/provenance.csv) 與 [`docs/reference-sources/moe-revised-download-and-provenance.md`](docs/reference-sources/moe-revised-download-and-provenance.md)）。
- **attribution 要求**：同簡編本。
- **redistribution boundary**：同簡編本；額外限制為所有 fallback 讀音皆標記為暫定，且不散布任何釋義內容。
- **尚未確認的法律或授權問題**：與簡編本相同的 BY-ND 改作疑慮，包含注音數字化的定性問題，同樣**未經法律確認**，正式發布前需再次向教育部確認。

## 3. 教育部《國語注音符號手冊》

- **名稱**：國語注音符號手冊
- **提供者**：中華民國教育部
- **source ID**：`moe:phonetic-symbols-manual`
- **使用版本**：未固定特定版本（作為方法參考）
- **使用目的**：定義音節表驗證方法的參考依據。
- **實際使用的欄位或內容**：**無**。本專案自行實作獨立的程式表示，未匯入手冊內容。
- **是否提交完整原始資料**：否。
- **是否提交候選範圍產物**：否 — 手冊的表格內容**未以任何形式重製**於本 repository。
- **已確認的授權**：`CC BY-ND 3.0 TW`（依 [`data/provenance.csv`](data/provenance.csv)）。
- **attribution 要求**：本文件即為出處標示。
- **redistribution boundary**：不重製手冊表格。
- **尚未確認的法律或授權問題**：無額外問題（因未重製任何內容）。

## 4. CC-CEDICT

- **名稱**：CC-CEDICT（Creative Commons Chinese-English Dictionary）
- **提供者**：CC-CEDICT 專案／MDBG 提供下載
- **source ID**：`cc-cedict:manual-release`
- **使用版本**：MDBG release `2026-07-21T11:22:36Z`
  - 檔案：`cedict_1_0_ts_utf-8_mdbg.zip`（3,965,480 bytes），SHA-256 `a20e3d9a5d5c3ae42d7539b9955cf2c545611f361e1be4515c560e04505eecf2`
  - 內含成員：`cedict_ts.u8`
- **官方來源網址**：
  - <https://cc-cedict.org/editor/editor.php?handler=Download>
  - <https://www.mdbg.net/chinese/export/cedict/>
- **使用目的**：**僅**用於候選詞的 **identity hints**（正／簡體對應、異體參照、分類詞存在與否、專有名詞提示、編號拼音 fallback），用於解析在兩個教育部來源皆無法確定的詞條身分。權威性低於教育部來源，**不得覆蓋 MOE 讀音**。
- **實際使用的欄位或內容**：來源行號、格式版本、繁體詞條、簡體詞條、編號拼音、結構化 `variant of` 目標、`CL:` 分類詞欄位存在與否、由大小寫推得的專有名詞提示。
- **英文釋義**：只被讀取以偵測 `variant of ...` 與 `CL:` 兩種結構化語法，**原始英文 definitions 一律不寫入任何產物**（產物中的 `emittedFields` 已明載此邊界）。
- **本專案如何轉換／篩選／投影**：僅對「兩個 MOE 投影後仍未解析」的候選詞做精確比對；唯一比對結果才提供提示，多筆結果標記為 `ambiguous-records`；編號拼音經 `src/readings/pinyin-to-bopomofo.ts` 轉為注音。不從英文釋義推導語法角色。
- **是否提交完整原始資料**：**否**。完整辭典留在本機 `data/external/cedict/`。MDBG 禁止自動化存取，因此下載一律由人工在瀏覽器完成，CI 不得下載。
- **是否提交候選範圍產物**：**是** — [`data/identity/cedict-active-catalog-hints.json`](data/identity/cedict-active-catalog-hints.json)。
- **已確認的授權**：`CC BY-SA 4.0`（依 [`data/provenance.csv`](data/provenance.csv) 與 [`docs/reference-sources/cedict-local-identity-hints.md`](docs/reference-sources/cedict-local-identity-hints.md)）。
- **attribution 要求**：需標示 CC-CEDICT 為來源並提供授權連結：<https://creativecommons.org/licenses/by-sa/4.0/>。
- **redistribution boundary**：
  - **CC-CEDICT 衍生內容仍受 CC BY-SA 4.0 拘束，不是 MIT。**
  - 目前公開產物（committed identity hints，以及網站 bundle 中由 CC-CEDICT 解析而來的讀音）含有可辨識的 CC-CEDICT 衍生資料，因此保留上述 attribution 與授權連結；ShareAlike 的義務隨該部分內容延續。
  - 不散布完整辭典、不散布英文釋義。
- **尚未確認的法律或授權問題**：ShareAlike 對「僅含身分提示與轉換後讀音」的衍生產物，其涵蓋範圍與 adapted material 的認定邊界尚未取得正式確認。

## 5. Universal Dependencies Chinese GSD

- **名稱**：Universal Dependencies Chinese GSD（UD_Chinese-GSD）
- **提供者**：Universal Dependencies 專案
- **source ID**：`ud:chinese-gsd-r2.18`
- **使用 release**：`r2.18`
- **官方來源網址**：<https://github.com/UniversalDependencies/UD_Chinese-GSD>
- **使用目的**：句法證據（syntactic evidence）與 profile 推導 — UPOS、依存關係分布、表層位置分布、valency frame。catalog 中沒有相容句法證據的詞不會進入網站題庫。
- **實際使用的欄位或內容**：CoNLL-U 的 lemma／form、UPOS、依存關係標籤、句中位置。使用檔案為 `zh_gsd-ud-train.conllu`、`zh_gsd-ud-dev.conllu`、`zh_gsd-ud-test.conllu`。
- **本專案如何轉換／篩選／投影**：對每個候選詞彙集**匿名的統計聚合**（各依存關係次數、各表層位置次數），推導出 UPOS 與 valency frame；缺乏證據者明確記為 `no-ud-evidence`，絕不猜測 UPOS。
- **是否提交完整原始資料**：**否**。完整 CoNLL-U 檔案與**原始句子**一律留在本機 `data/external/ud/chinese-gsd/r2.18/`，不提交。
- **是否提交候選範圍產物**：**是**，但只保留 candidate-scoped 的 aggregate／evidence —
  [`data/grammar/formal-syntax-active-catalog-profiles.json`](data/grammar/formal-syntax-active-catalog-profiles.json) 與
  [`data/grammar/formal-syntax-active-catalog-legality.json`](data/grammar/formal-syntax-active-catalog-legality.json)。
  產物中不含來源句子、不含非候選詞的 lemma 字串。
- **已確認的授權**：`CC BY-SA 4.0`（依 [`data/provenance.csv`](data/provenance.csv) 與 `scripts/ud_grammar_evidence/common.py` 的 `SOURCE_LICENSE`）。
- **attribution 要求**：需標示 UD_Chinese-GSD 為來源並提供授權連結：<https://creativecommons.org/licenses/by-sa/4.0/>。
- **redistribution boundary**：
  - **UD 衍生的句法 profile 受 CC BY-SA 4.0 的 ShareAlike 拘束，不是 MIT。**
  - 產生這些 profile 的**程式碼**屬於 MIT；profile 中承載的語料衍生資訊屬於 CC BY-SA 4.0。
  - 不散布完整語料或原始句子。
- **尚未確認的法律或授權問題**：匿名統計聚合是否構成 CC BY-SA 意義下的 adapted material、以及 ShareAlike 是否延伸至嵌入網站 bundle 的 profile，尚未取得正式確認。目前採取保守作法：明確標示 BY-SA 並保留 attribution。

## 6. 國家教育研究院 通用詞頻表

- **名稱**：通用詞頻表（定稿 1141208）
- **提供者**：國家教育研究院（National Academy for Educational Research, NAER）
- **source ID**：`naer:coct-general-frequency`
  - 注意：[`data/reference-sources.json`](data/reference-sources.json) 另以 `naer:general-frequency:2025-12-08` 登記同一份來源。兩個識別碼指向同一份工作簿，尚未統一（見文末「已知的 provenance 落差」）。
- **使用版本**：`1141208`（推測為民國 114 年 12 月 8 日，即 2025-12-08；此為檔名解讀，未在工作簿內部確認）
- **checksum**：SHA-256 `bfd3b73938e115ae39a44c5e11c97135c09939cf598157cb2fe0b33c4302de75`（17,303,267 bytes）
- **官方來源網址**：
  - 文件下載頁（正式入口）：<https://coct.naer.edu.tw/page.jsp?ID=41>
  - 本次觀察到的檔名：`通用詞頻表 - 定稿1141208.xlsx`
- **使用目的**：**只**提供常用度（commonness）。不提供讀音、詞性、語法角色或變體判斷。
- **實際使用的欄位**（工作表 `通用詞頻表`，範圍 `A1:L163702`）：
  - `A`：版本內排序（作為 `sourceRowId`）
  - `B`：詞（以 `NFC(trim(text))` 正規化）
  - `D`：書面語每百萬詞頻
  - `G`：口語每百萬詞頻
  - `J`（新聞）與 `L`（三通道平均）僅記為「已宣告忽略」的診斷欄位，**不進入** `commonness-v1` 計分。
- **本專案如何轉換／篩選／投影**：只輸出正規化文字能精確對應到 active catalog 詞條的列；其餘 163,701 列中的非候選列一律捨棄，不寫入 repository。詞頻經 log 強度與口語/書面 0.60/0.40 權重轉為選題權重。
- **是否提交完整原始資料**：**否**。官方 XLSX 留在本機 `data/external/naer/1141208/`。
- **是否提交候選範圍產物**：**是** — [`data/commonness/naer-1141208-active-catalog-rows.json`](data/commonness/naer-1141208-active-catalog-rows.json)，只含 catalog 範圍內的詞頻觀察值與 provenance（source ID、版本、checksum、工作表、欄位對應）。
- **已確認的授權**：

  ```text
  授權狀態：待確認。
  不得因官方網站可下載，即推定可自由重新散布或改作。
  ```

  官方頁面標示國家教育研究院版權，未在下載處提供開放資料授權。repository 內現有證據（[`data/reference-sources.json`](data/reference-sources.json) 的 `redistributionStatus: "unconfirmed"`、[`docs/reference-sources/inspection/naer-general-frequency-1141208-manifest.json`](docs/reference-sources/inspection/naer-general-frequency-1141208-manifest.json) 的 `redistributionStatus: "local-only-pending-license-review"`，以及 `unresolved` 明列「redistribution permission」）**不足以確認**其可重新散布或改作。

  因此本專案**不**在 `data/commonness/naer-1141208-active-catalog-rows.json` 中填入任何 `license` 值 —— 填入未經確認的授權名稱會製造假的確定性。
- **attribution 要求**：**待確認**。本專案仍主動標示國家教育研究院為詞頻來源。
- **redistribution boundary**：
  - 完整 workbook 不提交；
  - 完整 163,701 筆來源表不散布；
  - 只保留 catalog-scoped 詞頻觀察與 provenance；
  - **在授權確認前，不應擴大重新散布範圍**（不得提交更大的投影、不得公開衍生的完整詞表、不得將此資料再授權給第三方）。
- **尚未確認的法律或授權問題**：重新散布權限、改作權限、attribution 具體格式、跨版本排序穩定性。**需要作者向國家教育研究院正式確認。**

## 7. 國家教育研究院 三等七級詞語表

- **名稱**：三等七級詞語表
- **提供者**：國家教育研究院
- **source ID**：`naer:graded-words:2025-04`
- **使用版本**：`14452詞語表202504`
- **官方來源網址**：<https://coct.naer.edu.tw/page.jsp?ID=41>
- **使用目的**：**僅供研究參考**，作為詞目、注音、能力等級與情境的本機 reference input。
- **實際使用的欄位或內容**：**目前未使用**。此來源已在 [`data/reference-sources.json`](data/reference-sources.json) 登記，但**沒有任何產品產物或提交的 artifact 由它衍生**。
- **是否提交完整原始資料**：否。
- **是否提交候選範圍產物**：**否**。
- **已確認的授權**：**待確認**（`redistributionStatus: "unconfirmed"`）。同樣不得因官方網站可下載即推定可自由重新散布或改作。
- **attribution 要求**：待確認。
- **redistribution boundary**：原始 xlsx 與 normalized rows 皆不提交，直到授權邊界確認。
- **尚未確認的法律或授權問題**：同通用詞頻表。

---

## 網站產物中的第三方衍生內容

部署到 GitHub Pages 的 bundle 內含 `src/app/generated/catalog.ts`（建置時產生，未提交）。該檔嵌入下列衍生內容：

| 衍生內容 | 來源 | 適用授權 |
| --- | --- | --- |
| 詞條注音讀音（主要） | 教育部簡編本 | CC BY-ND 3.0 TW |
| 詞條注音讀音（fallback） | 教育部重編本 | CC BY-ND 3.0 TW |
| 部分詞條的身分解析與轉換後讀音 | CC-CEDICT | CC BY-SA 4.0 |
| 選題常用度權重 | NAER 通用詞頻表 | 待確認 |
| 句法 profile 與合法性索引 | UD Chinese GSD | CC BY-SA 4.0 |
| 介面、練習演算法、選題核心、句法規則實作 | 本專案原創 | MIT |

換言之，**網站上看得到的練習內容並非全部以 MIT 授權**。

## 已知的 provenance 落差

以下為目前記錄不一致或不完整之處，僅在此據實記錄，本次未改動資料格式：

1. NAER 通用詞頻表在 [`data/reference-sources.json`](data/reference-sources.json) 的 ID（`naer:general-frequency:2025-12-08`）與 adapter／committed artifact 的 ID（`naer:coct-general-frequency`）不一致。
2. [`data/reference-sources.json`](data/reference-sources.json) 尚未登記 CC-CEDICT、UD Chinese GSD 與教育部重編本；這三者的 provenance 目前記錄在 [`data/provenance.csv`](data/provenance.csv) 與各自的 artifact header 中。
3. [`data/commonness/naer-1141208-active-catalog-rows.json`](data/commonness/naer-1141208-active-catalog-rows.json) 有 `sourceId`、`sourceVersion`、`checksumSha256`、`adapterVersion`，但（刻意）沒有 `license` 與 `redistributionBoundary` 欄位 —— 因為 NAER 授權待確認。
4. [`data/grammar/formal-syntax-active-catalog-profiles.json`](data/grammar/formal-syntax-active-catalog-profiles.json) 以 `provenanceIds: ["ud:chinese-gsd-r2.18"]` 引用來源，但未內嵌授權字串；其授權可經 [`data/provenance.csv`](data/provenance.csv) 解析取得。

## 更詳細的來源文件

- [`data/provenance.csv`](data/provenance.csv) — 執行期 catalog 引用的 provenance 登錄表
- [`data/reference-sources.json`](data/reference-sources.json) — reference pipeline 的來源 manifest
- [`docs/reference-sources/moe-concised-download-and-provenance.md`](docs/reference-sources/moe-concised-download-and-provenance.md)
- [`docs/reference-sources/moe-revised-download-and-provenance.md`](docs/reference-sources/moe-revised-download-and-provenance.md)
- [`docs/reference-sources/cedict-local-identity-hints.md`](docs/reference-sources/cedict-local-identity-hints.md)
- [`docs/reference-sources/naer-download-and-provenance.md`](docs/reference-sources/naer-download-and-provenance.md)
- [`docs/reference-sources/naer-commonness-projection.md`](docs/reference-sources/naer-commonness-projection.md)

## 回報問題

若您是上述任一來源的權利人，認為本專案的收錄或投影方式超出授權範圍，請於 GitHub 開立 issue：
<https://github.com/a20030824/bopomofo-trainer/issues>
