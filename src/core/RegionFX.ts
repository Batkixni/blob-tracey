import { BlobItem, TrackerConfig } from './types';

export class RegionFX {
  private offCanvas: HTMLCanvasElement;
  private offCtx: CanvasRenderingContext2D;

  constructor() {
    this.offCanvas = document.createElement('canvas');
    this.offCtx = this.offCanvas.getContext('2d', { willReadFrequently: true })!;
  }

  public apply(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    blobs: BlobItem[],
    config: TrackerConfig
  ) {
    if (config.regionFX.mode === 'off' || blobs.length === 0) return;

    const mode = config.regionFX.mode;
    const amount = config.regionFX.amount;
    const seed = config.regionFX.seed;
    const randomPercent = config.regionFX.randomPercent;
    const isRandomSubset = config.regionFX.applyTo === 'random_subset';

    // Ensure offscreen buffer matches
    if (this.offCanvas.width !== canvasWidth || this.offCanvas.height !== canvasHeight) {
      this.offCanvas.width = canvasWidth;
      this.offCanvas.height = canvasHeight;
    }

    for (const blob of blobs) {
      // Deterministic selection if random subset
      if (isRandomSubset) {
        const hash = Math.abs((blob.stableId * 9301 + 49297 + seed * 233) % 100);
        if (hash >= randomPercent) continue;
      }

      const bbox = blob.smoothedBbox;
      const bx = Math.max(0, Math.floor(bbox.x));
      const by = Math.max(0, Math.floor(bbox.y));
      const bw = Math.min(canvasWidth - bx, Math.ceil(bbox.width));
      const bh = Math.min(canvasHeight - by, Math.ceil(bbox.height));

      if (bw <= 4 || bh <= 4) continue;

      // Extract image data for this region
      let regionData: ImageData;
      try {
        regionData = ctx.getImageData(bx, by, bw, bh);
      } catch (e) {
        continue;
      }

      const data = regionData.data;

      switch (mode) {
        case 'mosaic': {
          const blockSize = Math.max(3, Math.floor((amount / 100) * 32) + 4);
          for (let y = 0; y < bh; y += blockSize) {
            for (let x = 0; x < bw; x += blockSize) {
              const curW = Math.min(blockSize, bw - x);
              const curH = Math.min(blockSize, bh - y);

              let rSum = 0, gSum = 0, bSum = 0, count = 0;
              for (let dy = 0; dy < curH; dy++) {
                for (let dx = 0; dx < curW; dx++) {
                  const idx = ((y + dy) * bw + (x + dx)) * 4;
                  rSum += data[idx];
                  gSum += data[idx + 1];
                  bSum += data[idx + 2];
                  count++;
                }
              }

              const rAvg = Math.round(rSum / count);
              const gAvg = Math.round(gSum / count);
              const bAvg = Math.round(bSum / count);

              for (let dy = 0; dy < curH; dy++) {
                for (let dx = 0; dx < curW; dx++) {
                  const idx = ((y + dy) * bw + (x + dx)) * 4;
                  data[idx] = rAvg;
                  data[idx + 1] = gAvg;
                  data[idx + 2] = bAvg;
                }
              }
            }
          }
          break;
        }

        case 'invert': {
          const strength = amount / 100;
          for (let i = 0; i < data.length; i += 4) {
            data[i] = Math.round(data[i] * (1 - strength) + (255 - data[i]) * strength);
            data[i + 1] = Math.round(data[i + 1] * (1 - strength) + (255 - data[i + 1]) * strength);
            data[i + 2] = Math.round(data[i + 2] * (1 - strength) + (255 - data[i + 2]) * strength);
          }
          break;
        }

        case 'glitch': {
          // Horizontal slice displacements and RGB channel shifting
          const sliceHeight = Math.max(2, Math.floor(bh / 10));
          const maxShift = Math.floor((amount / 100) * 25);

          // Copy original
          const copy = new Uint8ClampedArray(data);

          for (let y = 0; y < bh; y += sliceHeight) {
            const curH = Math.min(sliceHeight, bh - y);
            // Deterministic pseudo-random shift for this slice
            const sliceSeed = (blob.stableId * 31 + y * 17 + seed) % 1000;
            const shiftX = Math.round((Math.sin(sliceSeed) * maxShift));
            const chromaticOffset = Math.round((amount / 100) * 8);

            for (let dy = 0; dy < curH; dy++) {
              const py = y + dy;
              for (let px = 0; px < bw; px++) {
                const targetIdx = (py * bw + px) * 4;

                const srcX = Math.max(0, Math.min(bw - 1, px + shiftX));
                const redX = Math.max(0, Math.min(bw - 1, srcX + chromaticOffset));
                const blueX = Math.max(0, Math.min(bw - 1, srcX - chromaticOffset));

                const redIdx = (py * bw + redX) * 4;
                const srcIdx = (py * bw + srcX) * 4;
                const blueIdx = (py * bw + blueX) * 4;

                data[targetIdx] = copy[redIdx];         // Red channel offset
                data[targetIdx + 1] = copy[srcIdx + 1]; // Green normal
                data[targetIdx + 2] = copy[blueIdx + 2];// Blue channel offset
              }
            }
          }
          break;
        }

        case 'hue_rotate': {
          const shiftAngle = ((amount / 100) * 360 * Math.PI) / 180;
          const cosA = Math.cos(shiftAngle);
          const sinA = Math.sin(shiftAngle);

          for (let i = 0; i < data.length; i += 4) {
            const r = data[i], g = data[i + 1], b = data[i + 2];
            // RGB Hue Rotation Matrix approximation
            data[i] = Math.max(0, Math.min(255, (0.213 + cosA * 0.787 - sinA * 0.213) * r +
              (0.715 - cosA * 0.715 - sinA * 0.715) * g +
              (0.072 - cosA * 0.072 + sinA * 0.928) * b));
            data[i + 1] = Math.max(0, Math.min(255, (0.213 - cosA * 0.213 + sinA * 0.143) * r +
              (0.715 + cosA * 0.285 + sinA * 0.140) * g +
              (0.072 - cosA * 0.072 - sinA * 0.283) * b));
            data[i + 2] = Math.max(0, Math.min(255, (0.213 - cosA * 0.213 - sinA * 0.787) * r +
              (0.715 - cosA * 0.715 + sinA * 0.715) * g +
              (0.072 + cosA * 0.928 + sinA * 0.072) * b));
          }
          break;
        }

        case 'block_shuffle': {
          const numBlocks = Math.max(2, Math.floor((amount / 100) * 8) + 2);
          const cellW = Math.floor(bw / numBlocks);
          const cellH = Math.floor(bh / numBlocks);
          const copy = new Uint8ClampedArray(data);

          if (cellW > 2 && cellH > 2) {
            for (let byIdx = 0; byIdx < numBlocks; byIdx++) {
              for (let bxIdx = 0; bxIdx < numBlocks; bxIdx++) {
                // Pick target block
                const randTgt = (blob.stableId * 13 + bxIdx * 7 + byIdx * 19 + seed) % (numBlocks * numBlocks);
                const tgtBx = randTgt % numBlocks;
                const tgtBy = Math.floor(randTgt / numBlocks);

                for (let cy = 0; cy < cellH; cy++) {
                  for (let cx = 0; cx < cellW; cx++) {
                    const srcIdx = ((byIdx * cellH + cy) * bw + (bxIdx * cellW + cx)) * 4;
                    const dstIdx = ((tgtBy * cellH + cy) * bw + (tgtBx * cellW + cx)) * 4;
                    data[dstIdx] = copy[srcIdx];
                    data[dstIdx + 1] = copy[srcIdx + 1];
                    data[dstIdx + 2] = copy[srcIdx + 2];
                  }
                }
              }
            }
          }
          break;
        }

        case 'block_shift': {
          // Displaced rectangular block glitch around blob boundaries
          const numSlices = Math.max(3, Math.floor((amount / 100) * 12) + 3);
          const copy = new Uint8ClampedArray(data);

          for (let s = 0; s < numSlices; s++) {
            const randSeed = (blob.stableId * 7919 + s * 104729 + seed * 31) % 100000;
            const blockW = Math.max(8, Math.min(bw - 4, Math.floor(((randSeed % 32) + 16))));
            const blockH = Math.max(6, Math.min(bh - 4, Math.floor((((randSeed >> 4) % 24) + 10))));

            const sx = Math.floor(((randSeed >> 2) % (Math.max(1, bw - blockW))));
            const sy = Math.floor(((randSeed >> 5) % (Math.max(1, bh - blockH))));

            const maxShift = Math.floor((amount / 100) * 35) + 10;
            const shiftX = Math.round(Math.sin(randSeed) * maxShift);
            const shiftY = Math.round(Math.cos(randSeed) * 4);

            const tx = Math.max(0, Math.min(bw - blockW, sx + shiftX));
            const ty = Math.max(0, Math.min(bh - blockH, sy + shiftY));

            // Copy rectangular slice
            for (let dy = 0; dy < blockH; dy++) {
              for (let dx = 0; dx < blockW; dx++) {
                const srcIdx = ((sy + dy) * bw + (sx + dx)) * 4;
                const dstIdx = ((ty + dy) * bw + (tx + dx)) * 4;
                data[dstIdx] = copy[srcIdx];
                data[dstIdx + 1] = copy[srcIdx + 1];
                data[dstIdx + 2] = copy[srcIdx + 2];
              }
            }

            // Crisp 1px tech border
            for (let dx = 0; dx < blockW; dx++) {
              const topIdx = (ty * bw + (tx + dx)) * 4;
              const botIdx = ((ty + blockH - 1) * bw + (tx + dx)) * 4;
              data[topIdx] = Math.min(255, data[topIdx] + 80);
              data[topIdx + 1] = Math.min(255, data[topIdx + 1] + 80);
              data[topIdx + 2] = Math.min(255, data[topIdx + 2] + 90);
              data[botIdx] = Math.min(255, data[botIdx] + 80);
              data[botIdx + 1] = Math.min(255, data[botIdx + 1] + 80);
              data[botIdx + 2] = Math.min(255, data[botIdx + 2] + 90);
            }
            for (let dy = 0; dy < blockH; dy++) {
              const leftIdx = ((ty + dy) * bw + tx) * 4;
              const rightIdx = ((ty + dy) * bw + (tx + blockW - 1)) * 4;
              data[leftIdx] = Math.min(255, data[leftIdx] + 80);
              data[leftIdx + 1] = Math.min(255, data[leftIdx + 1] + 80);
              data[leftIdx + 2] = Math.min(255, data[leftIdx + 2] + 90);
              data[rightIdx] = Math.min(255, data[rightIdx] + 80);
              data[rightIdx + 1] = Math.min(255, data[rightIdx + 1] + 80);
              data[rightIdx + 2] = Math.min(255, data[rightIdx + 2] + 90);
            }
          }
          break;
        }
      }

      // Put modified data back
      ctx.putImageData(regionData, bx, by);
    }
  }
}
