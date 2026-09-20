import { BlobItem, Point, Rect, TrackerConfig } from './types';

interface CompStat {
  pixelCount: number;
  sumX: number;
  sumY: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  boundaryPoints: Point[];
}

export class ConnectedComponents {
  public extractBlobs(
    mask: Uint8Array,
    width: number,
    height: number,
    scaleX: number,
    scaleY: number,
    config: TrackerConfig
  ): BlobItem[] {
    const labels = new Int32Array(width * height);
    const parent: number[] = [0];
    let nextLabel = 1;

    function find(i: number): number {
      let root = i;
      while (parent[root] !== root) {
        root = parent[root];
      }
      let curr = i;
      while (curr !== root) {
        const nxt = parent[curr];
        parent[curr] = root;
        curr = nxt;
      }
      return root;
    }

    function union(i: number, j: number) {
      const rootI = find(i);
      const rootJ = find(j);
      if (rootI !== rootJ) {
        if (rootI < rootJ) {
          parent[rootJ] = rootI;
        } else {
          parent[rootI] = rootJ;
        }
      }
    }

    // Pass 1: Labeling & equivalence recording
    for (let y = 0; y < height; y++) {
      const row = y * width;
      for (let x = 0; x < width; x++) {
        const idx = row + x;
        if (mask[idx] === 0) continue;

        const left = x > 0 ? labels[idx - 1] : 0;
        const top = y > 0 ? labels[idx - width] : 0;

        if (left === 0 && top === 0) {
          labels[idx] = nextLabel;
          parent[nextLabel] = nextLabel;
          nextLabel++;
        } else if (left !== 0 && top === 0) {
          labels[idx] = left;
        } else if (left === 0 && top !== 0) {
          labels[idx] = top;
        } else {
          labels[idx] = left;
          if (left !== top) {
            union(left, top);
          }
        }
      }
    }

    // Flatten disjoint sets
    for (let i = 1; i < nextLabel; i++) {
      parent[i] = find(i);
    }

    const needsContours = config.boxes.shape === 'contour' || config.boxes.shape === 'convex_hull';
    const stats = new Map<number, CompStat>();

    // Pass 2: Aggregate stats per canonical label
    for (let y = 0; y < height; y++) {
      const row = y * width;
      for (let x = 0; x < width; x++) {
        const idx = row + x;
        const l = labels[idx];
        if (l === 0) continue;

        const canon = parent[l];
        let stat = stats.get(canon);
        if (!stat) {
          stat = {
            pixelCount: 0,
            sumX: 0,
            sumY: 0,
            minX: x,
            maxX: x,
            minY: y,
            maxY: y,
            boundaryPoints: []
          };
          stats.set(canon, stat);
        }

        stat.pixelCount++;
        stat.sumX += x;
        stat.sumY += y;
        if (x < stat.minX) stat.minX = x;
        if (x > stat.maxX) stat.maxX = x;
        if (y < stat.minY) stat.minY = y;
        if (y > stat.maxY) stat.maxY = y;
      }
    }

    // Convert stats to BlobItem list with scaled coordinates
    const minArea = config.detection.minArea;
    const maxArea = config.detection.maxArea > 0 ? config.detection.maxArea : Infinity;

    const candidates: { canon: number; stat: CompStat }[] = [];
    for (const [canon, stat] of stats.entries()) {
      const scaledArea = stat.pixelCount * scaleX * scaleY;
      if (scaledArea >= minArea && scaledArea <= maxArea) {
        candidates.push({ canon, stat });
      }
    }

    // Sort candidates by area descending first
    const sortBy = config.detection.sortBy;
    if (sortBy === 'area') {
      candidates.sort((a, b) => b.stat.pixelCount - a.stat.pixelCount);
    } else if (sortBy === 'position') {
      candidates.sort((a, b) => (a.stat.minY * 10000 + a.stat.minX) - (b.stat.minY * 10000 + b.stat.minX));
    }

    // Keep only top maxBlobCount blobs
    const maxCount = Math.max(1, config.detection.maxBlobCount);
    const topCandidates = candidates.slice(0, maxCount);

    const blobs: BlobItem[] = [];
    let idCounter = 1;

    for (const item of topCandidates) {
      const stat = item.stat;
      const scaledArea = stat.pixelCount * scaleX * scaleY;
      // Exact subpixel center mapping
      const cx = (stat.sumX / stat.pixelCount + 0.5) * scaleX;
      const cy = (stat.sumY / stat.pixelCount + 0.5) * scaleY;

      const bx = stat.minX * scaleX;
      const by = stat.minY * scaleY;
      const bw = Math.max(12, (stat.maxX - stat.minX + 1) * scaleX);
      const bh = Math.max(12, (stat.maxY - stat.minY + 1) * scaleY);

      let hull: Point[] = [];
      let orderedContour: Point[] = [];

      if (needsContours) {
        const rawContour = this.traceMooreContour(
          labels,
          width,
          height,
          item.canon,
          stat.minX,
          stat.maxX,
          stat.minY,
          stat.maxY
        );

        if (rawContour.length > 2) {
          orderedContour = rawContour.map(p => ({
            x: (p.x + 0.5) * scaleX,
            y: (p.y + 0.5) * scaleY
          }));
          hull = this.computeConvexHull(orderedContour);
        }
      }

      blobs.push({
        id: idCounter,
        stableId: idCounter++,
        centroid: { x: cx, y: cy },
        smoothedCentroid: { x: cx, y: cy },
        bbox: { x: bx, y: by, width: bw, height: bh },
        smoothedBbox: { x: bx, y: by, width: bw, height: bh },
        area: Math.round(scaledArea),
        pixelCount: stat.pixelCount,
        contour: orderedContour,
        convexHull: hull,
        velocity: { x: 0, y: 0 },
        age: 0,
        isNew: true,
        colorScore: 1.0
      });
    }

    return blobs;
  }

  // Moore-Neighbor Boundary Following for non-intersecting, perfectly ordered contours
  private traceMooreContour(
    labels: Int32Array,
    width: number,
    height: number,
    canon: number,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number
  ): Point[] {
    // 1. Find starting boundary point (top-leftmost pixel of this component)
    let startX = -1;
    let startY = -1;
    for (let y = minY; y <= maxY && startY === -1; y++) {
      const row = y * width;
      for (let x = minX; x <= maxX; x++) {
        if (labels[row + x] === canon) {
          startX = x;
          startY = y;
          break;
        }
      }
    }

    if (startX === -1) return [];

    // 8-connected neighbor offsets in clockwise order:
    const DX = [ 0,  1,  1,  1,  0, -1, -1, -1];
    const DY = [-1, -1,  0,  1,  1,  1,  0, -1];

    const boundary: Point[] = [];
    let currX = startX;
    let currY = startY;
    let backtrackDir = 0; // Came from outside (above)
    const maxSteps = 1200;
    let steps = 0;

    while (steps < maxSteps) {
      boundary.push({ x: currX, y: currY });
      steps++;

      let found = false;
      const searchStart = (backtrackDir + 1) % 8;

      for (let i = 0; i < 8; i++) {
        const dir = (searchStart + i) % 8;
        const nx = currX + DX[dir];
        const ny = currY + DY[dir];

        if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
          if (labels[ny * width + nx] === canon) {
            currX = nx;
            currY = ny;
            backtrackDir = (dir + 4) % 8;
            found = true;
            break;
          }
        }
      }

      if (!found) break;

      if (currX === startX && currY === startY && steps >= 3) {
        break;
      }
    }

    // Downsample to clean, evenly-spaced polygon (30-45 vertices)
    if (boundary.length <= 42) {
      return boundary;
    }
    const stride = Math.max(1, Math.floor(boundary.length / 38));
    const sampled: Point[] = [];
    for (let i = 0; i < boundary.length; i += stride) {
      sampled.push(boundary[i]);
    }
    return sampled;
  }

  // Andrew's Monotone Chain Convex Hull algorithm
  private computeConvexHull(points: Point[]): Point[] {
    if (points.length <= 3) return points;
    const pts = points.slice().sort((a, b) => a.x === b.x ? a.y - b.y : a.x - b.x);

    const cross = (o: Point, a: Point, b: Point) =>
      (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

    const lower: Point[] = [];
    for (const p of pts) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
        lower.pop();
      }
      lower.push(p);
    }

    const upper: Point[] = [];
    for (let i = pts.length - 1; i >= 0; i--) {
      const p = pts[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
        upper.pop();
      }
      upper.push(p);
    }

    lower.pop();
    upper.pop();
    return lower.concat(upper);
  }
}
