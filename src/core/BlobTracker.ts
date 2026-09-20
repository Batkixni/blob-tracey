import { BlobItem, TrackerConfig } from './types';

export class BlobTracker {
  private prevBlobs: BlobItem[] = [];
  private nextId = 1;

  public update(currentBlobs: BlobItem[], config: TrackerConfig): BlobItem[] {
    if (!config.detection.trackIds) {
      this.prevBlobs = currentBlobs;
      return currentBlobs;
    }

    const maxMatchDistance = 120; // maximum pixel distance to associate with previous blob
    const smoothing = Math.min(0.95, Math.max(0, config.detection.jitterSmoothing));
    const alpha = 1.0 - smoothing; // higher smoothing = lower alpha

    const matchedPrevIndices = new Set<number>();

    for (const curr of currentBlobs) {
      let bestDist = Infinity;
      let bestPrevIdx = -1;

      for (let j = 0; j < this.prevBlobs.length; j++) {
        if (matchedPrevIndices.has(j)) continue;
        const prev = this.prevBlobs[j];
        const dx = curr.centroid.x - prev.centroid.x;
        const dy = curr.centroid.y - prev.centroid.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < maxMatchDistance && dist < bestDist) {
          bestDist = dist;
          bestPrevIdx = j;
        }
      }

      if (bestPrevIdx !== -1) {
        matchedPrevIndices.add(bestPrevIdx);
        const prev = this.prevBlobs[bestPrevIdx];

        curr.stableId = prev.stableId;
        curr.id = prev.stableId;
        curr.age = prev.age + 1;
        curr.isNew = false;

        // Instant velocity
        curr.velocity = {
          x: curr.centroid.x - prev.centroid.x,
          y: curr.centroid.y - prev.centroid.y
        };

        // Exponential smoothing
        curr.smoothedCentroid = {
          x: alpha * curr.centroid.x + (1 - alpha) * prev.smoothedCentroid.x,
          y: alpha * curr.centroid.y + (1 - alpha) * prev.smoothedCentroid.y
        };

        curr.smoothedBbox = {
          x: alpha * curr.bbox.x + (1 - alpha) * prev.smoothedBbox.x,
          y: alpha * curr.bbox.y + (1 - alpha) * prev.smoothedBbox.y,
          width: alpha * curr.bbox.width + (1 - alpha) * prev.smoothedBbox.width,
          height: alpha * curr.bbox.height + (1 - alpha) * prev.smoothedBbox.height
        };
      } else {
        // New blob
        curr.stableId = this.nextId++;
        curr.id = curr.stableId;
        curr.age = 0;
        curr.isNew = true;
        curr.velocity = { x: 0, y: 0 };
        curr.smoothedCentroid = { ...curr.centroid };
        curr.smoothedBbox = { ...curr.bbox };
      }
    }

    this.prevBlobs = currentBlobs;
    return currentBlobs;
  }

  public reset() {
    this.prevBlobs = [];
    this.nextId = 1;
  }
}
