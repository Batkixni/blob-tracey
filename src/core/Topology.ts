import { BlobItem, EdgeItem, Point, TrackerConfig } from './types';

interface Triangle {
  a: number; // indices into points array
  b: number;
  c: number;
  circumX: number;
  circumY: number;
  circumRadiusSq: number;
}

export class Topology {
  public generateEdges(blobs: BlobItem[], config: TrackerConfig): EdgeItem[] {
    if (blobs.length < 2 || !config.lines.enable) return [];

    const topology = config.lines.topology;
    const maxDist = config.lines.maxDistance > 0 ? config.lines.maxDistance : Infinity;

    let rawEdges: { i: number; j: number; dist: number }[] = [];

    switch (topology) {
      case 'delaunay':
        rawEdges = this.buildDelaunayEdges(blobs);
        break;

      case 'mst':
        rawEdges = this.buildMST(blobs);
        break;

      case 'nearest_k':
        rawEdges = this.buildNearestK(blobs, config.lines.kNeighbors);
        break;

      case 'sequential':
        for (let i = 0; i < blobs.length - 1; i++) {
          const dist = this.dist(blobs[i].smoothedCentroid, blobs[i + 1].smoothedCentroid);
          rawEdges.push({ i, j: i + 1, dist });
        }
        break;

      case 'star': {
        // Center is blob 0 (usually largest)
        for (let i = 1; i < blobs.length; i++) {
          const dist = this.dist(blobs[0].smoothedCentroid, blobs[i].smoothedCentroid);
          rawEdges.push({ i: 0, j: i, dist });
        }
        break;
      }

      case 'full_mesh':
        for (let i = 0; i < blobs.length; i++) {
          for (let j = i + 1; j < blobs.length; j++) {
            const dist = this.dist(blobs[i].smoothedCentroid, blobs[j].smoothedCentroid);
            rawEdges.push({ i, j, dist });
          }
        }
        break;
    }

    // Filter by maxDistance & convert to EdgeItem
    const result: EdgeItem[] = [];
    const seen = new Set<string>();

    for (const e of rawEdges) {
      if (e.dist > maxDist) continue;
      const key = e.i < e.j ? `${e.i}-${e.j}` : `${e.j}-${e.i}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const b1 = blobs[e.i];
      const b2 = blobs[e.j];
      result.push({
        p1: b1.smoothedCentroid,
        p2: b2.smoothedCentroid,
        distance: Math.round(e.dist),
        b1Id: b1.id,
        b2Id: b2.id
      });
    }

    return result;
  }

  private dist(p1: Point, p2: Point): number {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Bowyer-Watson Delaunay Triangulation
  private buildDelaunayEdges(blobs: BlobItem[]): { i: number; j: number; dist: number }[] {
    const n = blobs.length;
    if (n < 2) return [];
    if (n === 2) {
      return [{ i: 0, j: 1, dist: this.dist(blobs[0].smoothedCentroid, blobs[1].smoothedCentroid) }];
    }

    // Determine bounding box for super-triangle
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const b of blobs) {
      const p = b.smoothedCentroid;
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }

    const dx = maxX - minX || 100;
    const dy = maxY - minY || 100;
    const deltaMax = Math.max(dx, dy) * 2;
    const midX = (minX + maxX) / 2;
    const midY = (minY + maxY) / 2;

    // Super triangle vertices
    const points: Point[] = blobs.map(b => ({ ...b.smoothedCentroid }));
    points.push({ x: midX - 2 * deltaMax, y: midY - deltaMax });
    points.push({ x: midX, y: midY + 2 * deltaMax });
    points.push({ x: midX + 2 * deltaMax, y: midY - deltaMax });

    const stA = n, stB = n + 1, stC = n + 2;

    const calcCircumCircle = (pA: Point, pB: Point, pC: Point) => {
      const d = 2 * (pA.x * (pB.y - pC.y) + pB.x * (pC.y - pA.y) + pC.x * (pA.y - pB.y));
      if (Math.abs(d) < 1e-6) {
        return { x: 0, y: 0, rSq: Infinity };
      }
      const aSq = pA.x * pA.x + pA.y * pA.y;
      const bSq = pB.x * pB.x + pB.y * pB.y;
      const cSq = pC.x * pC.x + pC.y * pC.y;
      const ux = (aSq * (pB.y - pC.y) + bSq * (pC.y - pA.y) + cSq * (pA.y - pB.y)) / d;
      const uy = (aSq * (pC.x - pB.x) + bSq * (pA.x - pC.x) + cSq * (pB.x - pA.x)) / d;
      const rSq = (pA.x - ux) * (pA.x - ux) + (pA.y - uy) * (pA.y - uy);
      return { x: ux, y: uy, rSq };
    };

    let triangles: Triangle[] = [];
    const superCirc = calcCircumCircle(points[stA], points[stB], points[stC]);
    triangles.push({
      a: stA,
      b: stB,
      c: stC,
      circumX: superCirc.x,
      circumY: superCirc.y,
      circumRadiusSq: superCirc.rSq
    });

    for (let i = 0; i < n; i++) {
      const p = points[i];
      const polygon: { u: number; v: number }[] = [];
      const badTriangles: number[] = [];

      for (let t = 0; t < triangles.length; t++) {
        const tri = triangles[t];
        const distSq = (p.x - tri.circumX) * (p.x - tri.circumX) + (p.y - tri.circumY) * (p.y - tri.circumY);
        if (distSq <= tri.circumRadiusSq) {
          badTriangles.push(t);
          polygon.push({ u: tri.a, v: tri.b });
          polygon.push({ u: tri.b, v: tri.c });
          polygon.push({ u: tri.c, v: tri.a });
        }
      }

      // Keep only boundary edges of the polygon (edges that appear only once)
      const uniqueEdges: { u: number; v: number }[] = [];
      for (let e1 = 0; e1 < polygon.length; e1++) {
        let count = 0;
        for (let e2 = 0; e2 < polygon.length; e2++) {
          if (
            (polygon[e1].u === polygon[e2].u && polygon[e1].v === polygon[e2].v) ||
            (polygon[e1].u === polygon[e2].v && polygon[e1].v === polygon[e2].u)
          ) {
            count++;
          }
        }
        if (count === 1) {
          uniqueEdges.push(polygon[e1]);
        }
      }

      // Remove bad triangles
      triangles = triangles.filter((_, idx) => !badTriangles.includes(idx));

      // Re-triangulate the polygonal hole
      for (const edge of uniqueEdges) {
        const circ = calcCircumCircle(points[edge.u], points[edge.v], p);
        triangles.push({
          a: edge.u,
          b: edge.v,
          c: i,
          circumX: circ.x,
          circumY: circ.y,
          circumRadiusSq: circ.rSq
        });
      }
    }

    // Remove triangles that contain super-triangle vertices
    const edges: { i: number; j: number; dist: number }[] = [];
    for (const tri of triangles) {
      if (tri.a >= n || tri.b >= n || tri.c >= n) continue;

      const addEdge = (u: number, v: number) => {
        edges.push({ i: u, j: v, dist: this.dist(points[u], points[v]) });
      };
      addEdge(tri.a, tri.b);
      addEdge(tri.b, tri.c);
      addEdge(tri.c, tri.a);
    }

    return edges;
  }

  // Minimum Spanning Tree using Kruskal's algorithm
  private buildMST(blobs: BlobItem[]): { i: number; j: number; dist: number }[] {
    const candidateEdges = this.buildDelaunayEdges(blobs);
    candidateEdges.sort((a, b) => a.dist - b.dist);

    const parent = Array.from({ length: blobs.length }, (_, idx) => idx);
    const find = (i: number): number => {
      if (parent[i] === i) return i;
      return (parent[i] = find(parent[i]));
    };

    const mst: { i: number; j: number; dist: number }[] = [];
    for (const e of candidateEdges) {
      const root1 = find(e.i);
      const root2 = find(e.j);
      if (root1 !== root2) {
        mst.push(e);
        parent[root2] = root1;
        if (mst.length === blobs.length - 1) break;
      }
    }
    return mst;
  }

  // Nearest-K neighbor graph
  private buildNearestK(blobs: BlobItem[], k: number): { i: number; j: number; dist: number }[] {
    const edges: { i: number; j: number; dist: number }[] = [];
    const count = Math.max(1, Math.min(32, k));

    for (let i = 0; i < blobs.length; i++) {
      const distances: { j: number; dist: number }[] = [];
      for (let j = 0; j < blobs.length; j++) {
        if (i === j) continue;
        distances.push({ j, dist: this.dist(blobs[i].smoothedCentroid, blobs[j].smoothedCentroid) });
      }
      distances.sort((a, b) => a.dist - b.dist);
      for (let m = 0; m < Math.min(count, distances.length); m++) {
        edges.push({ i, j: distances[m].j, dist: distances[m].dist });
      }
    }
    return edges;
  }
}
