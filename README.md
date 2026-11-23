# 台北子龍廟線上圖卡產生器（Vercel）

包含「祭改替身」與「安燈小卡」兩套線上工具。使用者不需要安裝 EXE；圖片完全在瀏覽器中產生，Vercel API 只負責唯讀轉送公開 Google 試算表 CSV。

> 部署前請確認兩份 Google 試算表都是「知道連結的任何人：檢視者」。若 Google 回傳 401，網站會顯示讀取失敗。

## 部署到 Vercel

### 方法一：GitHub（建議）

1. 將本資料夾全部上傳到一個 GitHub repository。
2. 登入 Vercel，按 **Add New → Project**。
3. 匯入該 repository。
4. Framework Preset 選 **Other**。
5. Build Command 留空，Output Directory 填 `public`。
6. 按 Deploy。

### 方法二：Vercel CLI

在本資料夾執行：

```powershell
npx vercel
```

部署時不需要設定任何環境變數或 Google 金鑰。

## 目錄

- `public/`：網站與底圖資源。
- `api/sheets.js`：Vercel 唯讀試算表代理。
- `vercel.json`：Vercel 設定。

## 隱私與防重複

- API 不儲存個資或圖片。
- 圖片在瀏覽器 Canvas 中生成並打包 ZIP。
- 瀏覽器會用 localStorage 記住曾下載的檔名。
- 使用者也能選擇既有輸出資料夾，網站只讀檔名清單來略過同名檔，不上傳內容。
- 清除瀏覽器資料會清除下載紀錄；此時可重新選擇既有輸出資料夾。
- 「僅生成異動資料」會比較每筆資料內容指紋，只生成新增或內容改變的資料。
- 「重新產生全部資料」會忽略瀏覽器紀錄，重新輸出試算表目前所有資料。
