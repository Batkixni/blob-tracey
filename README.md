# blob-tracey

> Web-based Machine Vision Blob Tracer &amp; Visual Overlay Tool.  
> **線上體驗 (Live Demo)**: [https://t.bax.vision](https://t.bax.vision)

`blob-tracey` 是一套專為視覺設計師、動態影像創作者與新媒體藝術家打造的網頁端電腦視覺標註與幾何覆蓋層生成工具。使用者可直接拖放圖片進行即時 Blob 偵測、生成高科技感外框、十字準心、座標標籤、Delaunay 星座連線網絡與像素位移特效，並支援參數 JSON 導入導出與無損高清圖片匯出。

---

## 核心功能 (Key Features)

### 1. 多模式電腦視覺偵測 (Detection &amp; Segmentation)
- **吸管指定色 (Color Key)**：支援畫布即時點擊吸色與色相容差比對。
- **Sobel 邊緣偵測 (Edges)**：提取高頻邊緣輪廓。
- **明暗分離 (Luma Bright / Dark)**：依據亮度門檻值快速分離亮部與陰影。
- **色相 / 飽和度範圍**：過濾特定色彩波段。
- **CCL 連通元件標記**：快速萃取幾何質心、輪廓點列 (Contour) 與凸包 (Convex Hull)。
- **抖動平滑 (Jitter Smoothing)**：平滑各幀質心與邊界，抑制噪點跳動。

### 2. 多樣化科技外框與標記 (Boxes &amp; Markers)
- **邊框樣式**：標準矩形、科技角括號 (Brackets)、裁切十字角、即時輪廓線、凸包多邊形、圓角矩形、橢圓、六角形與底線。
- **填充模式**：無填充、單向斜網、雙向斜網、純色塊（支援透明度調整）。
- **中心標記**：斜向叉號 (Cross)、十字準心 (Plus)、戰術準心環 (Crosshair)、實心圓點、空心圓環。

### 3. 動態座標與資訊標籤 (Labels &amp; Telemetry)
- **多格式座標**：簡潔座標 (`X, Y`)、十六進位 (`0x200, 0x180`)、標準座標 (`X0512 Y0384`)、畫面百分比、矩陣代碼。
- **靈活錨定**：支援質心中心點 (`Centroid`)、外框左上角 (`Box Corner`) 或兩者同步顯示。
- **自訂排版**：外框上方、外框下方、外框內部、十字中心等多種位置。

### 4. 網絡連線拓撲 (Constellation Lines)
- **拓撲算法**：Delaunay 三角網、最小生成樹 (MST)、最近鄰 K 連線 (Nearest-K)、順序連續線、星型中心網、完全圖。
- **線條風格**：平滑拱弧 (Bezier Arcs)、直線硬邊、環狀迴路，支援虛線與距離標籤。

### 5. 區域像素特效 (Region FX)
- **特效演算法**：方塊重排 (Block Shuffle)、局部方塊位移 (Block Shift)、RGB 色差故障 (Glitch)、方塊馬賽克 (Mosaic)、色彩反轉、色相旋轉。
- **選取策略**：支援全部套用或設定隨機子集比例 (%) 與自訂種子碼。

### 6. Photoshop 風格扁平化工作區 (Inspector Workspace)
- **灰黑中性扁平設計**：深色調 (`#181818`, `#252526`)、零 Emoji、方正視覺體驗。
- **可收合側邊檢視面板**：支援一鍵收合釋放工作區空間。
- **滾輪縮放與視窗平移**：
  - 滑鼠滾輪以游標為中心平滑縮放 (15% - 1000%)。
  - 空白鍵 + 左鍵拖曳（抓手工具）、中鍵拖曳或右鍵拖曳平移畫布。
  - 雙擊工作區或點擊 HUD「縮放 100%」立即還原居中。
- **JSON 參數匯入 / 匯出**：一鍵保存與讀取全套工作參數，或直接將 `.json` 檔案拖入工作區載入。
- **無損 PNG 圖片匯出**：匯出高解析度合成結果。

---

## 快速開始 (Getting Started)

### 本地開發 (Local Development)

```bash
# 安裝依賴
npm install

# 啟動本地 Vite 開發伺服器 (預設 http://localhost:3000)
npm run dev

# 專案建置
npm run build
```

### 部署至 Cloudflare Workers

本專案使用 Cloudflare Workers Static Assets 託管：

```bash
npx wrangler deploy
```

---

## 技術堆疊 (Tech Stack)

- **語言與架構**：TypeScript, HTML5 Canvas 2D, Vite
- **圖形算法**：Connected Component Labeling, Delaunay Triangulation, Convex Hull, Chaikin's Smoothing Algorithm, Sobel Filtering
- **邊緣部署**：Cloudflare Workers (Static Assets)

---

## 銘謝 (Acknowledgments)

本專案之核心幾何標記風格與視覺靈感源自：
- **[KyleSullivan321/AE-Blob-Tracker](https://github.com/KyleSullivan321/AE-Blob-Tracker)** by [Kyle Sullivan](https://github.com/KyleSullivan321)

感謝原作者在視覺特效與機器視覺標註呈現上的卓越探索與設計啟發！

---

## 授權條款 (License)

[MIT License](LICENSE)
