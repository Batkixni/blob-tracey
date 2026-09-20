export type DetectionMode =
  | 'edges'
  | 'luma_bright'
  | 'luma_dark'
  | 'color_key'
  | 'motion'
  | 'red'
  | 'green'
  | 'blue'
  | 'sat_high'
  | 'sat_low'
  | 'hue_range';

export type BoxShape =
  | 'brackets'
  | 'crop_marks'
  | 'rectangle'
  | 'rounded'
  | 'contour'
  | 'convex_hull'
  | 'ellipse'
  | 'hexagon'
  | 'underline';

export type FillStyle = 'none' | 'solid' | 'hatch' | 'cross_hatch';

export type MarkerType = 'plus' | 'dot' | 'cross' | 'ring' | 'crosshair';

export type LabelFormat = 'coords_clean' | 'coords_full' | 'hex' | 'percent' | 'matrix';

export type LabelPosition = 'above' | 'below' | 'inside' | 'left' | 'right' | 'at_center';

export type TopologyType =
  | 'delaunay'
  | 'mst'
  | 'nearest_k'
  | 'sequential'
  | 'star'
  | 'full_mesh';

export type CurveStyle = 'straight' | 'bezier_arcs' | 'circular_loops';

export type RegionFXMode =
  | 'off'
  | 'mosaic'
  | 'glitch'
  | 'invert'
  | 'hue_rotate'
  | 'block_shuffle'
  | 'block_shift';

export type BackgroundRenderMode = 'original' | 'transparent' | 'solid';

export type CornerPosition = 'tl' | 'tr' | 'bl' | 'br';

export type ScanSweepMode = 'off' | 'horizontal' | 'vertical';

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BlobItem {
  id: number;
  stableId: number;
  centroid: Point;
  smoothedCentroid: Point;
  bbox: Rect;
  smoothedBbox: Rect;
  area: number;
  pixelCount: number;
  contour: Point[];
  convexHull: Point[];
  velocity: Point;
  age: number; // frames since first detected
  isNew: boolean;
  colorScore: number;
}

export interface EdgeItem {
  p1: Point;
  p2: Point;
  distance: number;
  b1Id: number;
  b2Id: number;
}

export interface TrackerConfig {
  detection: {
    mode: DetectionMode;
    keyColor: string;
    hueCenter: number; // 0 - 360
    hueWidth: number; // 0 - 180
    threshold: number; // 0 - 100
    softness: number; // 0 - 10
    quality: number; // 1, 2, 4, 8 downsample factor
    minArea: number;
    maxArea: number;
    maxBlobCount: number;
    sortBy: 'area' | 'position' | 'brightness';
    invertMask: boolean;
    showMask: boolean;
    trackIds: boolean;
    jitterSmoothing: number; // 0 - 1
  };
  boxes: {
    enable: boolean;
    shape: BoxShape;
    borderColor: string;
    borderThickness: number;
    cornerRadius: number;
    bracketLength: number;
    fillStyle: FillStyle;
    fillColor: string;
    fillOpacity: number;
    hatchSpacing: number;
    hatchAngle: number;
    padding: number;
    scale: number;
    squarify: boolean;
    opacity: number;
    showVertices?: boolean;
    vertexStep?: number;
  };
  markers: {
    enable: boolean;
    type: MarkerType;
    color: string;
    size: number;
    lineThickness: number;
  };
  labels: {
    enable: boolean;
    showId: boolean;
    showCoords: boolean;
    showDims: boolean;
    showArea: boolean;
    format: LabelFormat;
    coordTarget?: 'centroid' | 'box_corner' | 'both';
    color: string;
    fontSize: number;
    position: LabelPosition;
    offsetX: number;
    offsetY: number;
    background: boolean;
    leaderLine: boolean;
  };
  lines: {
    enable: boolean;
    topology: TopologyType;
    curveStyle?: CurveStyle;
    kNeighbors: number;
    maxDistance: number;
    color: string;
    opacity: number;
    thickness: number;
    dashed: boolean;
    dashLength: number;
    gapLength: number;
    distanceLabels: boolean;
    enableArrows: boolean;
  };
  regionFX: {
    mode: RegionFXMode;
    amount: number; // 0 - 100
    applyTo: 'all' | 'random_subset';
    randomPercent: number;
    seed: number;
    useExactMask: boolean;
  };
  compositing: {
    renderGraphicsOn: BackgroundRenderMode;
    backgroundColor: string;
    overlayOpacity: number;
  };
  animation: {
    antsSpeed: number;
    scanSweep: ScanSweepMode;
    sweepSpeed: number;
    sweepBrightness: number;
    sweepColor: string;
    birthPop: boolean;
  };
  hudExtras: {
    velocityVectors: boolean;
    vectorScale: number;
    dataPanel: boolean;
    panelCorner: CornerPosition;
    panelColor: string;
    areaMeters: boolean;
  };
}
