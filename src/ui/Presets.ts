import { TrackerConfig } from '../core/types';

export interface PresetItem {
  id: string;
  name: string;
  description: string;
  config: TrackerConfig;
}

export const DEFAULT_CONFIG: TrackerConfig = {
  detection: {
    mode: 'color_key',
    keyColor: '#0f3466',
    hueCenter: 215,
    hueWidth: 35,
    threshold: 40,
    softness: 2,
    quality: 2,
    minArea: 600,
    maxArea: 0,
    maxBlobCount: 30,
    sortBy: 'area',
    invertMask: false,
    showMask: false,
    trackIds: true,
    jitterSmoothing: 0.3,
  },
  boxes: {
    enable: true,
    shape: 'rectangle',
    borderColor: '#ffffff',
    borderThickness: 3.5,
    cornerRadius: 4,
    bracketLength: 43,
    fillStyle: 'none',
    fillColor: '#38bdf8',
    fillOpacity: 0,
    hatchSpacing: 6,
    hatchAngle: 45,
    padding: 10,
    scale: 1,
    squarify: false,
    opacity: 1,
    showVertices: false,
    vertexStep: 3,
  },
  markers: {
    enable: true,
    type: 'cross',
    color: '#ffffff',
    size: 16,
    lineThickness: 1.5,
  },
  labels: {
    enable: true,
    showId: true,
    showCoords: true,
    showDims: false,
    showArea: false,
    format: 'coords_clean',
    coordTarget: 'centroid',
    color: '#ffffff',
    fontSize: 16,
    position: 'above',
    offsetX: 0,
    offsetY: 0,
    background: false,
    leaderLine: false,
  },
  lines: {
    enable: true,
    topology: 'delaunay',
    curveStyle: 'bezier_arcs',
    kNeighbors: 3,
    maxDistance: 1500,
    color: '#ffffff',
    opacity: 1,
    thickness: 3.5,
    dashed: false,
    dashLength: 4,
    gapLength: 4,
    distanceLabels: false,
    enableArrows: false,
  },
  regionFX: {
    mode: 'block_shuffle',
    amount: 25,
    applyTo: 'random_subset',
    randomPercent: 30,
    seed: 42,
    useExactMask: false,
  },
  compositing: {
    renderGraphicsOn: 'original',
    backgroundColor: '#0a0f1d',
    overlayOpacity: 1,
  },
  animation: {
    antsSpeed: 0,
    scanSweep: 'off',
    sweepSpeed: 0.6,
    sweepBrightness: 50,
    sweepColor: '#00d2ff',
    birthPop: false,
  },
  hudExtras: {
    velocityVectors: false,
    vectorScale: 5,
    dataPanel: true,
    panelCorner: 'tl',
    panelColor: '#38bdf8',
    areaMeters: false,
  },
};

export const PRESETS: PresetItem[] = [
  {
    id: 'tech_brackets',
    name: '科技角標 (Tech Brackets)',
    description: '純白角括號、清晰十字準心、Delaunay 星座連線、局部方塊位移',
    config: JSON.parse(JSON.stringify(DEFAULT_CONFIG)),
  },
  {
    id: 'organic_contour',
    name: '有機輪廓 (Organic Contour)',
    description: '外圍輪廓跟隨、45° 雙向微斜網底、端點等寬數字、平滑貝茲拱弧連線、邊緣方塊位移',
    config: {
      ...JSON.parse(JSON.stringify(DEFAULT_CONFIG)),
      detection: {
        ...DEFAULT_CONFIG.detection,
        mode: 'edges',
        threshold: 28,
        softness: 2,
        minArea: 1200,
        maxArea: 0,
        maxBlobCount: 8,
        quality: 2,
      },
      boxes: {
        ...DEFAULT_CONFIG.boxes,
        shape: 'contour',
        borderColor: '#ffffff',
        borderThickness: 1.2,
        cornerRadius: 15,
        fillStyle: 'cross_hatch',
        fillColor: '#ffffff',
        fillOpacity: 0.35,
        hatchSpacing: 5,
        hatchAngle: 45,
        padding: 0,
        showVertices: true,
        vertexStep: 3,
      },
      markers: {
        enable: true,
        type: 'plus',
        color: '#ffffff',
        size: 8,
        lineThickness: 1.5,
      },
      lines: {
        ...DEFAULT_CONFIG.lines,
        enable: true,
        topology: 'mst',
        curveStyle: 'bezier_arcs',
        color: 'rgba(255, 255, 255, 0.45)',
        opacity: 0.55,
        thickness: 1.0,
        maxDistance: 800,
      },
      regionFX: {
        mode: 'block_shift',
        amount: 65,
        applyTo: 'all',
        randomPercent: 100,
        seed: 42,
        useExactMask: false,
      },
      labels: {
        ...DEFAULT_CONFIG.labels,
        enable: true,
        showId: false,
        showCoords: true,
        format: 'coords_clean',
        coordTarget: 'centroid',
        color: '#ffffff',
        fontSize: 9,
        position: 'at_center',
        background: true,
      },
    },
  },
  {
    id: 'edge_radar',
    name: '邊緣雷達 (Edge Scanner)',
    description: 'Sobel 邊緣擴展偵測，鎖定畫面中對比反差輪廓，純實線裁切十字框',
    config: {
      ...JSON.parse(JSON.stringify(DEFAULT_CONFIG)),
      detection: {
        ...DEFAULT_CONFIG.detection,
        mode: 'edges',
        threshold: 35,
        minArea: 600,
        maxBlobCount: 12,
      },
      boxes: {
        ...DEFAULT_CONFIG.boxes,
        shape: 'crop_marks',
        borderColor: '#e0e0e0',
        borderThickness: 1.5,
        fillStyle: 'none',
      },
      lines: {
        ...DEFAULT_CONFIG.lines,
        color: 'rgba(224, 224, 224, 0.5)',
      },
      animation: {
        ...DEFAULT_CONFIG.animation,
        antsSpeed: 0,
        scanSweep: 'off',
      }
    }
  },
  {
    id: 'ae_showcase',
    name: '官方展示 (AE Showcase)',
    description: '平滑輪廓 Contour、純實線外框、Delaunay 測距網',
    config: {
      ...JSON.parse(JSON.stringify(DEFAULT_CONFIG)),
      detection: {
        ...DEFAULT_CONFIG.detection,
        mode: 'luma_bright',
        threshold: 52,
        minArea: 800,
        maxBlobCount: 12,
      },
      boxes: {
        ...DEFAULT_CONFIG.boxes,
        shape: 'contour',
        cornerRadius: 6,
        borderColor: '#ffffff',
        borderThickness: 1.5,
        fillStyle: 'none',
      },
      markers: {
        ...DEFAULT_CONFIG.markers,
        type: 'plus',
        color: '#ffffff',
        size: 5,
      },
      labels: {
        ...DEFAULT_CONFIG.labels,
        color: '#ffffff',
        showId: false,
        showCoords: true,
      },
      lines: {
        ...DEFAULT_CONFIG.lines,
        topology: 'delaunay',
        color: 'rgba(255, 255, 255, 0.6)',
        opacity: 0.6,
        distanceLabels: true,
      },
      regionFX: {
        ...DEFAULT_CONFIG.regionFX,
        mode: 'off',
      },
      animation: {
        ...DEFAULT_CONFIG.animation,
        antsSpeed: 0,
        scanSweep: 'off',
      },
      hudExtras: {
        ...DEFAULT_CONFIG.hudExtras,
        panelColor: '#cccccc',
        areaMeters: true,
      }
    }
  },
  {
    id: 'clean_brackets',
    name: '極簡角標 (Minimal Brackets)',
    description: '純粹白色科技角標與十字準心，實線無動畫，專注於乾淨利落的目標鎖定',
    config: {
      ...JSON.parse(JSON.stringify(DEFAULT_CONFIG)),
      boxes: {
        ...DEFAULT_CONFIG.boxes,
        shape: 'brackets',
        borderColor: '#ffffff',
        borderThickness: 1.5,
        fillStyle: 'none',
        bracketLength: 16,
        padding: 6,
      },
      lines: {
        ...DEFAULT_CONFIG.lines,
        enable: false,
      },
      markers: {
        ...DEFAULT_CONFIG.markers,
        type: 'crosshair',
        color: '#ffffff',
        size: 7,
      },
      regionFX: {
        ...DEFAULT_CONFIG.regionFX,
        mode: 'off',
      },
      animation: {
        ...DEFAULT_CONFIG.animation,
        antsSpeed: 0,
        scanSweep: 'off',
      }
    }
  },
  {
    id: 'mst_constellation',
    name: '拓撲星網 (Constellation MST)',
    description: '利用最小生成樹 (MST) 演算法與最近鄰連線，呈現神經元與星座節點幾何圖形',
    config: {
      ...JSON.parse(JSON.stringify(DEFAULT_CONFIG)),
      boxes: {
        ...DEFAULT_CONFIG.boxes,
        shape: 'rounded',
        cornerRadius: 6,
        borderColor: 'rgba(255, 255, 255, 0.7)',
        borderThickness: 1.5,
        fillStyle: 'none',
      },
      lines: {
        ...DEFAULT_CONFIG.lines,
        enable: true,
        topology: 'mst',
        color: '#ffffff',
        opacity: 0.7,
        thickness: 1.2,
        dashed: false,
        distanceLabels: true,
        enableArrows: false,
      },
      regionFX: {
        ...DEFAULT_CONFIG.regionFX,
        mode: 'off',
      },
      animation: {
        ...DEFAULT_CONFIG.animation,
        antsSpeed: 0,
        scanSweep: 'off',
      }
    }
  },
  {
    id: 'glitch_surveillance',
    name: '故障監控 (Glitch Monitor)',
    description: '純實線科技框搭配局部水平色差位移 (RGB Glitch)、十六進位座標資料',
    config: {
      ...JSON.parse(JSON.stringify(DEFAULT_CONFIG)),
      boxes: {
        ...DEFAULT_CONFIG.boxes,
        shape: 'crop_marks',
        borderColor: '#e5e5e5',
        borderThickness: 1.5,
        fillStyle: 'none',
      },
      labels: {
        ...DEFAULT_CONFIG.labels,
        color: '#e5e5e5',
        format: 'hex',
        showId: true,
        showCoords: true,
        showDims: true,
        showArea: true,
      },
      lines: {
        ...DEFAULT_CONFIG.lines,
        color: '#e5e5e5',
        opacity: 0.6,
      },
      regionFX: {
        ...DEFAULT_CONFIG.regionFX,
        mode: 'glitch',
        amount: 70,
        applyTo: 'all',
      },
      hudExtras: {
        ...DEFAULT_CONFIG.hudExtras,
        panelColor: '#cccccc',
        panelCorner: 'br',
      },
      animation: {
        ...DEFAULT_CONFIG.animation,
        antsSpeed: 0,
        scanSweep: 'off',
      }
    }
  }
];
