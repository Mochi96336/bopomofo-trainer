# 注音輸入訓練器

[![CI](https://github.com/a20030824/bopomofo-trainer/actions/workflows/check.yml/badge.svg)](https://github.com/a20030824/bopomofo-trainer/actions/workflows/check.yml)
[![Deploy Pages](https://github.com/a20030824/bopomofo-trainer/actions/workflows/deploy-pages.yml/badge.svg)](https://github.com/a20030824/bopomofo-trainer/actions/workflows/deploy-pages.yml)

一個在瀏覽器中運作、資料留在本機的繁體中文注音鍵盤訓練雛型。它以常用詞為基礎，記住真正按錯或明顯卡住的注音，讓這些弱點在後續題目中更常出現；句法規則負責讓練習內容維持可讀，而不是任意拼接詞語。

**[開啟線上雛型](https://a20030824.github.io/bopomofo-trainer/)**

## 現在能做什麼

- 使用標準注音鍵盤配置進行逐音節輸入練習。
- 從審核過的常用詞中產生練習內容。
- 分別記錄目標注音的錯誤與乾淨輸入時間，用來調整後續選題。
- 可調整錯誤與慢速訊號的影響，常用度仍是選詞基礎。
- 將進度、量測與練習紀錄保存在瀏覽器，也能匯出或匯入完整存檔。
- 以句法規則限制詞槽，避免產生任意詞列。
- 使用固定 seed 重現相同 catalog 與進度下的選題結果。
- 練習從最常用的詞開始，較罕見的稀有度靠練熟鍵盤解鎖，解鎖後可自行開關。
- 按 `F8` 預覽另一題；只替換目前未完成的題目，不增加回合、不更新量測，也不寫入歷史。

> 目前保證的是句法 profile 與句型規則相容，不保證每一句都具備自然的語意搭配。這是雛型現階段刻意保留的界線。

## 錯誤怎麼影響下一題

```text
常用度建立基礎權重
        ＋
目標注音的錯誤紀錄
        ＋
乾淨輸入的慢速訊號
        ↓
有限度提高弱點出現機率
        ↓
在句法相容的候選中選出下一題
```

只有題目原本要求的注音會累積錯誤；使用者誤按的另一顆鍵不會反過來獲得權重。慢速訊號只採用沒有錯誤或輸入干擾的樣本。學習紀錄不會直接指定整句，而是輕推含有容易出錯注音或按鍵轉換的合法候選。

## 句子怎麼產生

句法生成只負責約束句形與詞槽；選題核心仍是常用度加學習權重。缺少相容句法資料的詞不會進入網站題庫。

## 本機執行

需要 Node.js 22 與 Python 3.12。

```bash
npm ci
npm run dev
```

Vite 啟動後，開啟終端顯示的本機網址即可。

`F8` 預覽在開發與 production 都保留。開發模式另有 `F9` 暫時開放稀有度與 `F10` 自動走完目前句子的檢視工具；production build 只隔離這兩個會改變學習資料的操作。隔離層不呼叫 `preventDefault()`，因此 F9／F10 的瀏覽器或作業系統預設行為不會被網站取消。

## 驗證

```bash
npm run check
```

這會依序執行 TypeScript typecheck、Vitest（快速與 simulation）、Python source-adapter 測試、catalog 驗證與 production build。

唯一不在此關卡內的是 `npm run test:slow`：它會在完整 catalog 上跑五種關聯切分策略，單獨就要約五分鐘。

## 主要目錄

```text
src/app/          瀏覽器介面與鍵盤輸入
src/product/      練習、進度與 session
src/curriculum/   選題、權重與句子生成入口
src/syntax/       正式句法推導、profile 與合法性檢查
data/source/      目前啟用的審核 catalog
data/grammar/     網站使用的句法合法清單與精簡 profiles
scripts/          catalog、讀音與句法生成工具
tests/            TypeScript 與 Python 驗證
docs/             架構、政策、證據與歷史研究文件
```

## 設計原則

- 詞頻決定可用範圍與主要抽樣權重。
- 學習者訊號必須有足夠樣本、可解釋且有權重上限。
- 實際按錯的 token 不會反過來獲得課程權重。
- transition 不跨越音節或詞條邊界。
- 句法合法性先於選題評分。
- 模擬只能驗證內部行為與可重現性，不能證明真實學習效果。

## 文件

- [正式句法系統](docs/formal-syntax-system.md)
- [正式句法實作狀態](docs/formal-syntax-implementation-status.md)
- [選題政策](docs/frequency-first-utterance-policy.md)
- [架構](docs/architecture.md)
- [領域模型](docs/domain-model.md)
- [測量政策](docs/measurement-policy.md)
- [弱點診斷](docs/weakness-diagnostics.md)
- [進步趨勢歷史](docs/diagnostic-progress-history.md)
- [Roadmap](docs/roadmap.md)
- [架構決策](docs/decisions/)
- [第三方資料來源與授權](THIRD_PARTY_NOTICES.md)

## 資料來源與授權

本專案原創且未另行標示的程式碼與文件採用 [MIT License](LICENSE)。

詞頻、讀音、詞彙及句法證據等第三方資料，不因收錄於本 repository 而改以 MIT License 授權。教育部辭典、CC-CEDICT、Universal Dependencies 與國教院詞頻表的衍生內容仍受各自授權拘束，其來源、版本、處理方式與適用授權請見 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。

第三方的完整原始檔案一律保留在本機，不提交至本 repository；只有候選詞範圍內的最小投影會被提交。

## GitHub Pages

合併到 `main` 後，[Pages workflow](.github/workflows/deploy-pages.yml) 只會在 `check` workflow 成功後建置並部署相同 commit 的 `dist/`。也可以從 Actions 頁面手動觸發部署。
