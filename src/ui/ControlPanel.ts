import { TrackerConfig } from '../core/types';
import { PRESETS } from './Presets';

export class ControlPanel {
  private config: TrackerConfig;
  private onChange: (config: TrackerConfig) => void;
  private activePresetId: string = 'tech_brackets';
  private currentTab: string = 'detection';

  constructor(config: TrackerConfig, onChange: (config: TrackerConfig) => void) {
    this.config = config;
    this.onChange = onChange;
    this.initSidebarCollapse();
    this.initAccordions();
    this.initTabs();
    this.renderAllControls();
    this.applyTabFilter('detection');
  }

  private initSidebarCollapse() {
    const sidebar = document.querySelector('.sidebar') as HTMLElement;
    const btnToggle = document.getElementById('btnToggleSidebar');
    const btnCollapse = document.getElementById('btnCollapseSidebar');

    const toggle = () => {
      if (!sidebar) return;
      sidebar.classList.toggle('collapsed');
      const isCol = sidebar.classList.contains('collapsed');
      if (btnToggle) btnToggle.textContent = isCol ? '展開面板 »' : '收合面板 «';
      if (btnCollapse) btnCollapse.textContent = isCol ? '»' : '«';
    };

    btnToggle?.addEventListener('click', toggle);
    btnCollapse?.addEventListener('click', toggle);
  }

  private initAccordions() {
    document.querySelectorAll('.group-header').forEach(header => {
      header.addEventListener('click', () => {
        const card = header.closest('.group-card');
        if (card) {
          card.classList.toggle('collapsed');
        }
      });
    });
  }

  private initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = (btn as HTMLElement).dataset.tab || 'all';
        this.currentTab = tab;

        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        this.applyTabFilter(tab);
      });
    });
  }

  private applyTabFilter(tab: string) {
    const allCards = document.querySelectorAll('.group-card');
    allCards.forEach(card => {
      const id = card.id;
      if (tab === 'all') {
        (card as HTMLElement).style.display = 'block';
        return;
      }

      let match = false;
      if (tab === 'detection' && id === 'card-detection') match = true;
      if (tab === 'boxes' && (id === 'card-boxes' || id === 'card-markers')) match = true;
      if (tab === 'lines' && id === 'card-lines') match = true;
      if (tab === 'regionFX' && (id === 'card-regionFX' || id === 'card-animation')) match = true;
      if (tab === 'labels' && id === 'card-labels') match = true;

      if (match) {
        (card as HTMLElement).style.display = 'block';
        card.classList.remove('collapsed');
      } else {
        (card as HTMLElement).style.display = 'none';
      }
    });
  }

  public getActivePresetId(): string {
    return this.activePresetId;
  }

  public setConfig(newConfig: TrackerConfig) {
    this.config = JSON.parse(JSON.stringify(newConfig));
    this.renderAllControls();
    this.onChange(this.config);
  }

  public renderAllControls() {
    this.renderDetectionControls();
    this.renderBoxesControls();
    this.renderMarkersControls();
    this.renderLabelsControls();
    this.renderLinesControls();
    this.renderRegionFXControls();
    this.renderAnimationControls();
  }

  // Helper row creators
  private addSelectRow(parent: HTMLElement, label: string, options: { val: string; text: string }[], currentVal: string, onValChange: (v: string) => void) {
    const row = document.createElement('div');
    row.className = 'control-row';
    row.innerHTML = `<span class="control-label">${label}</span>`;

    const select = document.createElement('select');
    options.forEach(opt => {
      const el = document.createElement('option');
      el.value = opt.val;
      el.textContent = opt.text;
      if (opt.val === currentVal) el.selected = true;
      select.appendChild(el);
    });

    select.addEventListener('change', () => {
      onValChange(select.value);
      this.onChange(this.config);
    });

    const grp = document.createElement('div');
    grp.className = 'control-input-group';
    grp.appendChild(select);
    row.appendChild(grp);
    parent.appendChild(row);
  }

  private addSliderRow(parent: HTMLElement, label: string, min: number, max: number, step: number, currentVal: number, onValChange: (v: number) => void) {
    const row = document.createElement('div');
    row.className = 'control-row';
    row.innerHTML = `
      <span class="control-label">${label}</span>
      <div class="control-input-group">
        <input type="range" min="${min}" max="${max}" step="${step}" value="${currentVal}" />
        <span class="range-val">${currentVal}</span>
      </div>
    `;

    const slider = row.querySelector('input') as HTMLInputElement;
    const valText = row.querySelector('.range-val') as HTMLElement;

    slider.addEventListener('input', () => {
      const v = parseFloat(slider.value);
      valText.textContent = v.toString();
      onValChange(v);
      this.onChange(this.config);
    });

    parent.appendChild(row);
  }

  private addCheckboxRow(parent: HTMLElement, label: string, currentVal: boolean, onValChange: (v: boolean) => void) {
    const row = document.createElement('div');
    row.className = 'control-row';
    row.innerHTML = `
      <span class="control-label">${label}</span>
      <div class="control-input-group">
        <input type="checkbox" ${currentVal ? 'checked' : ''} />
      </div>
    `;

    const cb = row.querySelector('input') as HTMLInputElement;
    cb.addEventListener('change', () => {
      onValChange(cb.checked);
      this.onChange(this.config);
    });

    parent.appendChild(row);
  }

  private addColorRow(parent: HTMLElement, label: string, currentColor: string, onValChange: (c: string) => void) {
    const row = document.createElement('div');
    row.className = 'control-row';
    row.innerHTML = `
      <span class="control-label">${label}</span>
      <div class="control-input-group">
        <input type="color" value="${currentColor.startsWith('#') ? currentColor : '#38bdf8'}" />
      </div>
    `;

    const picker = row.querySelector('input') as HTMLInputElement;
    picker.addEventListener('input', () => {
      onValChange(picker.value);
      this.onChange(this.config);
    });

    parent.appendChild(row);
  }

  // 1. Detection
  private renderDetectionControls() {
    const el = document.getElementById('groupDetection');
    if (!el) return;
    el.innerHTML = '';

    const d = this.config.detection;

    this.addSelectRow(el, '偵測模式', [
      { val: 'edges', text: 'Sobel 邊緣' },
      { val: 'blue', text: '藍色目標' },
      { val: 'luma_bright', text: '亮部明暗' },
      { val: 'luma_dark', text: '暗部陰影' },
      { val: 'color_key', text: '吸管指定色' },
      { val: 'motion', text: '畫面運動差' },
      { val: 'hue_range', text: '色相區間' },
      { val: 'red', text: '紅色通道' },
      { val: 'green', text: '綠色通道' },
      { val: 'sat_high', text: '高飽和度' },
    ], d.mode, (v) => {
      d.mode = v as any;
      this.renderDetectionControls();
    });

    if (d.mode === 'color_key') {
      this.addColorRow(el, '目標顏色', d.keyColor, (c) => { d.keyColor = c; });
    }

    if (d.mode === 'hue_range') {
      this.addSliderRow(el, '色相中心', 0, 360, 1, d.hueCenter, (v) => { d.hueCenter = v; });
      this.addSliderRow(el, '色相容差', 5, 180, 1, d.hueWidth, (v) => { d.hueWidth = v; });
    }

    this.addSliderRow(el, '門檻值', 1, 100, 1, d.threshold, (v) => { d.threshold = v; });
    this.addSliderRow(el, '柔和度', 0, 8, 1, d.softness, (v) => { d.softness = v; });

    this.addSelectRow(el, '分析品質', [
      { val: '1', text: '1x 原解析度' },
      { val: '2', text: '1/2 標準 (推薦)' },
      { val: '4', text: '1/4 高速' },
      { val: '8', text: '1/8 極速' }
    ], d.quality.toString(), (v) => { d.quality = parseInt(v); });

    this.addSliderRow(el, '最小面積', 50, 4000, 50, d.minArea, (v) => { d.minArea = v; });
    this.addSliderRow(el, '最大數量', 1, 30, 1, d.maxBlobCount, (v) => { d.maxBlobCount = v; });

    this.addCheckboxRow(el, '反轉遮罩', d.invertMask, (v) => { d.invertMask = v; });
    this.addCheckboxRow(el, '除錯檢視', d.showMask, (v) => { d.showMask = v; });
    this.addCheckboxRow(el, '跨幀追蹤', d.trackIds, (v) => { d.trackIds = v; });
    this.addSliderRow(el, '抖動平滑', 0, 0.9, 0.05, d.jitterSmoothing, (v) => { d.jitterSmoothing = v; });
  }

  // 2. Boxes
  private renderBoxesControls() {
    const el = document.getElementById('groupBoxes');
    if (!el) return;
    el.innerHTML = '';

    const b = this.config.boxes;

    this.addCheckboxRow(el, '啟用外框', b.enable, (v) => { b.enable = v; });

    this.addSelectRow(el, '形狀樣式', [
      { val: 'brackets', text: '科技角括號' },
      { val: 'crop_marks', text: '裁切十字角' },
      { val: 'contour', text: '即時輪廓線' },
      { val: 'convex_hull', text: '凸包多邊形' },
      { val: 'rounded', text: '圓角矩形' },
      { val: 'rectangle', text: '標準矩形' },
      { val: 'ellipse', text: '橢圓' },
      { val: 'hexagon', text: '六角形' },
      { val: 'underline', text: '底線' }
    ], b.shape, (v) => {
      b.shape = v as any;
      this.renderBoxesControls();
    });

    this.addColorRow(el, '邊框顏色', b.borderColor, (c) => { b.borderColor = c; });
    this.addSliderRow(el, '邊框粗細', 1, 8, 0.5, b.borderThickness, (v) => { b.borderThickness = v; });

    if (b.shape === 'brackets' || b.shape === 'crop_marks') {
      this.addSliderRow(el, '角標長度', 6, 50, 1, b.bracketLength, (v) => { b.bracketLength = v; });
    }

    if (b.shape === 'rounded' || b.shape === 'contour' || b.shape === 'convex_hull') {
      this.addSliderRow(el, '圓角平滑', 0, 40, 1, b.cornerRadius, (v) => { b.cornerRadius = v; });
    }

    this.addSelectRow(el, '填充模式', [
      { val: 'cross_hatch', text: '雙向斜網' },
      { val: 'hatch', text: '單向斜網' },
      { val: 'solid', text: '純色塊' },
      { val: 'none', text: '無填充' }
    ], b.fillStyle, (v) => {
      b.fillStyle = v as any;
      this.renderBoxesControls();
    });

    if (b.fillStyle !== 'none') {
      this.addColorRow(el, '填充顏色', b.fillColor, (c) => { b.fillColor = c; });
      this.addSliderRow(el, '填充透明', 0.05, 0.8, 0.05, b.fillOpacity, (v) => { b.fillOpacity = v; });
      if (b.fillStyle === 'hatch' || b.fillStyle === 'cross_hatch') {
        this.addSliderRow(el, '網線間距', 3, 20, 1, b.hatchSpacing, (v) => { b.hatchSpacing = v; });
      }
    }

    this.addSliderRow(el, '外距擴充', -10, 40, 1, b.padding, (v) => { b.padding = v; });
    this.addSliderRow(el, '縮放倍率', 0.5, 2.0, 0.05, b.scale, (v) => { b.scale = v; });
    this.addCheckboxRow(el, '強制正方', b.squarify, (v) => { b.squarify = v; });

    if (b.shape === 'contour' || b.shape === 'convex_hull') {
      this.addCheckboxRow(el, '端點代碼', !!b.showVertices, (v) => {
        b.showVertices = v;
        this.renderBoxesControls();
      });
      if (b.showVertices) {
        this.addSliderRow(el, '端點步階', 1, 8, 1, b.vertexStep || 3, (v) => { b.vertexStep = v; });
      }
    }
  }

  // 3. Markers
  private renderMarkersControls() {
    const el = document.getElementById('groupMarkers');
    if (!el) return;
    el.innerHTML = '';

    const m = this.config.markers;
    this.addCheckboxRow(el, '啟用標記', m.enable, (v) => { m.enable = v; });
    this.addSelectRow(el, '標記圖案', [
      { val: 'plus', text: '十字準心' },
      { val: 'crosshair', text: '戰術準心環' },
      { val: 'dot', text: '實心圓點' },
      { val: 'ring', text: '空心圓環' },
      { val: 'cross', text: '斜向叉號' }
    ], m.type, (v) => { m.type = v as any; });

    this.addColorRow(el, '標記顏色', m.color, (c) => { m.color = c; });
    this.addSliderRow(el, '標記尺寸', 2, 24, 1, m.size, (v) => { m.size = v; });
    this.addSliderRow(el, '標記粗細', 0.5, 5, 0.5, m.lineThickness, (v) => { m.lineThickness = v; });
  }

  // 4. Labels
  private renderLabelsControls() {
    const el = document.getElementById('groupLabels');
    if (!el) return;
    el.innerHTML = '';

    const l = this.config.labels;
    this.addCheckboxRow(el, '啟用標籤', l.enable, (v) => { l.enable = v; });
    this.addCheckboxRow(el, '顯示編號', l.showId, (v) => { l.showId = v; });
    this.addCheckboxRow(el, '顯示座標', l.showCoords, (v) => { l.showCoords = v; });
    this.addCheckboxRow(el, '顯示尺寸', l.showDims, (v) => { l.showDims = v; });
    this.addCheckboxRow(el, '顯示面積', l.showArea, (v) => { l.showArea = v; });

    this.addSelectRow(el, '座標格式', [
      { val: 'coords_clean', text: '標準: 512, 384' },
      { val: 'coords_full', text: '完整: X0512 Y0384' },
      { val: 'hex', text: '十六進位: 0x200' },
      { val: 'percent', text: '百分比: 40.2%' },
      { val: 'matrix', text: '矩陣: R12:C16' }
    ], l.format, (v) => { l.format = v as any; });

    this.addSelectRow(el, '座標目標', [
      { val: 'centroid', text: '質心中心點' },
      { val: 'box_corner', text: '外框左上角' },
      { val: 'both', text: '兩者皆顯示' }
    ], l.coordTarget || 'centroid', (v) => { l.coordTarget = v as any; });

    this.addSelectRow(el, '標籤位置', [
      { val: 'above', text: '外框上方' },
      { val: 'at_center', text: '十字中心' },
      { val: 'below', text: '外框下方' },
      { val: 'inside', text: '外框內部' },
      { val: 'left', text: '外框左側' },
      { val: 'right', text: '外框右側' }
    ], l.position, (v) => { l.position = v as any; });

    this.addColorRow(el, '文字顏色', l.color, (c) => { l.color = c; });
    this.addSliderRow(el, '字型大小', 8, 18, 1, l.fontSize, (v) => { l.fontSize = v; });
    this.addCheckboxRow(el, '文字底板', l.background, (v) => { l.background = v; });
  }

  // 5. Lines
  private renderLinesControls() {
    const el = document.getElementById('groupLines');
    if (!el) return;
    el.innerHTML = '';

    const ln = this.config.lines;
    this.addCheckboxRow(el, '啟用連線', ln.enable, (v) => { ln.enable = v; });
    this.addSelectRow(el, '網絡拓撲', [
      { val: 'delaunay', text: 'Delaunay 三角網' },
      { val: 'mst', text: '最小生成樹 MST' },
      { val: 'nearest_k', text: '最近鄰 K 連線' },
      { val: 'sequential', text: '順序連續線' },
      { val: 'star', text: '星型中心網' },
      { val: 'full_mesh', text: '完全連接圖' }
    ], ln.topology, (v) => { ln.topology = v as any; });

    this.addSelectRow(el, '連線樣式', [
      { val: 'straight', text: '直線硬邊' },
      { val: 'bezier_arcs', text: '平滑拱弧' },
      { val: 'circular_loops', text: '環狀迴路' }
    ], ln.curveStyle || 'straight', (v) => { ln.curveStyle = v as any; });

    if (ln.topology === 'nearest_k') {
      this.addSliderRow(el, '鄰居數量', 1, 8, 1, ln.kNeighbors, (v) => { ln.kNeighbors = v; });
    }

    this.addSliderRow(el, '最大距離', 100, 1500, 50, ln.maxDistance, (v) => { ln.maxDistance = v; });
    this.addColorRow(el, '連線顏色', ln.color, (c) => { ln.color = c; });
    this.addSliderRow(el, '連線粗細', 0.5, 5, 0.5, ln.thickness, (v) => { ln.thickness = v; });
    this.addSliderRow(el, '連線透明', 0.1, 1.0, 0.05, ln.opacity, (v) => { ln.opacity = v; });
    this.addCheckboxRow(el, '虛線效果', ln.dashed, (v) => { ln.dashed = v; });
    this.addCheckboxRow(el, '距離標籤', ln.distanceLabels, (v) => { ln.distanceLabels = v; });
  }

  // 6. Region FX
  private renderRegionFXControls() {
    const el = document.getElementById('groupRegionFX');
    if (!el) return;
    el.innerHTML = '';

    const r = this.config.regionFX;
    this.addSelectRow(el, '特效模式', [
      { val: 'block_shift', text: '局部方塊位移' },
      { val: 'mosaic', text: '方塊馬賽克' },
      { val: 'glitch', text: 'RGB 色差故障' },
      { val: 'invert', text: '色彩反轉' },
      { val: 'hue_rotate', text: '色相旋轉' },
      { val: 'block_shuffle', text: '方塊重排' },
      { val: 'off', text: '關閉' }
    ], r.mode, (v) => {
      r.mode = v as any;
      this.renderRegionFXControls();
    });

    if (r.mode !== 'off') {
      this.addSliderRow(el, '特效強度', 10, 100, 5, r.amount, (v) => { r.amount = v; });
      this.addSelectRow(el, '套用對象', [
        { val: 'random_subset', text: '隨機子集 %' },
        { val: 'all', text: '全部目標' }
      ], r.applyTo, (v) => {
        r.applyTo = v as any;
        this.renderRegionFXControls();
      });

      if (r.applyTo === 'random_subset') {
        this.addSliderRow(el, '選取比例', 10, 100, 5, r.randomPercent, (v) => { r.randomPercent = v; });
      }
      this.addSliderRow(el, '隨機種子', 1, 100, 1, r.seed, (v) => { r.seed = v; });
    }
  }

  // 7. Animation
  private renderAnimationControls() {
    const el = document.getElementById('groupAnimation');
    if (!el) return;
    el.innerHTML = '';

    const a = this.config.animation;
    this.addSliderRow(el, '螞蟻線速', -60, 60, 5, a.antsSpeed, (v) => { a.antsSpeed = v; });
    this.addSelectRow(el, '雷射掃描', [
      { val: 'off', text: '關閉' },
      { val: 'horizontal', text: '水平橫掃' },
      { val: 'vertical', text: '垂直縱掃' }
    ], a.scanSweep, (v) => {
      a.scanSweep = v as any;
      this.renderAnimationControls();
    });

    if (a.scanSweep !== 'off') {
      this.addSliderRow(el, '掃描速度', 0.1, 3.0, 0.1, a.sweepSpeed, (v) => { a.sweepSpeed = v; });
      this.addSliderRow(el, '掃描亮度', 10, 100, 5, a.sweepBrightness, (v) => { a.sweepBrightness = v; });
      this.addColorRow(el, '光束顏色', a.sweepColor, (c) => { a.sweepColor = c; });
    }
  }
}
