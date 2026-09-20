import { TrackerConfig } from './types';

export interface DetectionResult {
  mask: Uint8Array; // 1 for blob, 0 for background
  width: number;
  height: number;
  scaleX: number; // mapping from analysis canvas to original source
  scaleY: number;
  maskCanvas: HTMLCanvasElement;
}

export class BlobDetector {
  private analysisCanvas: HTMLCanvasElement;
  private analysisCtx: CanvasRenderingContext2D;
  private prevLuma: Uint8Array | null = null;
  private blurBuffer: Float32Array | null = null;

  constructor() {
    this.analysisCanvas = document.createElement('canvas');
    this.analysisCtx = this.analysisCanvas.getContext('2d', { willReadFrequently: true })!;
  }

  public detect(source: CanvasImageSource, sourceWidth: number, sourceHeight: number, config: TrackerConfig): DetectionResult {
    const quality = Math.max(1, config.detection.quality);
    const aw = Math.max(32, Math.floor(sourceWidth / quality));
    const ah = Math.max(32, Math.floor(sourceHeight / quality));

    if (this.analysisCanvas.width !== aw || this.analysisCanvas.height !== ah) {
      this.analysisCanvas.width = aw;
      this.analysisCanvas.height = ah;
      this.blurBuffer = new Float32Array(aw * ah);
    }

    // Draw source into downsampled analysis canvas
    this.analysisCtx.drawImage(source, 0, 0, aw, ah);
    const imgData = this.analysisCtx.getImageData(0, 0, aw, ah);
    const pixels = imgData.data;
    const totalPixels = aw * ah;

    const mask = new Uint8Array(totalPixels);
    const luma = new Float32Array(totalPixels);

    // Compute basic luminance
    for (let i = 0; i < totalPixels; i++) {
      const idx = i * 4;
      luma[i] = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
    }

    // Apply softness (fast box blur) if specified
    let processedLuma: Float32Array<ArrayBufferLike> = luma;
    if (config.detection.softness > 0) {
      processedLuma = this.applyBoxBlur(luma, aw, ah, config.detection.softness);
    }

    const mode = config.detection.mode;
    const thresh = config.detection.threshold; // 0 - 100
    const threshVal = (thresh / 100) * 255;

    // Parse key color for color_key mode
    let targetR = 0, targetG = 0, targetB = 0;
    if (mode === 'color_key') {
      const hex = config.detection.keyColor.replace('#', '');
      if (hex.length === 6) {
        targetR = parseInt(hex.substring(0, 2), 16);
        targetG = parseInt(hex.substring(2, 4), 16);
        targetB = parseInt(hex.substring(4, 6), 16);
      }
    }

    switch (mode) {
      case 'edges': {
        // Sobel filter with 3x3 gradient magnitude
        const edgeMag = new Float32Array(totalPixels);
        for (let y = 1; y < ah - 1; y++) {
          const rowPrev = (y - 1) * aw;
          const rowCurr = y * aw;
          const rowNext = (y + 1) * aw;
          for (let x = 1; x < aw - 1; x++) {
            const p00 = processedLuma[rowPrev + x - 1];
            const p02 = processedLuma[rowPrev + x + 1];
            const p10 = processedLuma[rowCurr + x - 1];
            const p12 = processedLuma[rowCurr + x + 1];
            const p20 = processedLuma[rowNext + x - 1];
            const p22 = processedLuma[rowNext + x + 1];
            const p01 = processedLuma[rowPrev + x];
            const p21 = processedLuma[rowNext + x];

            const gx = (p02 + 2 * p12 + p22) - (p00 + 2 * p10 + p20);
            const gy = (p20 + 2 * p21 + p22) - (p00 + 2 * p01 + p02);
            edgeMag[rowCurr + x] = Math.sqrt(gx * gx + gy * gy);
          }
        }
        // Thicken edges with dilation so lines form connected regions
        const edgeThresh = threshVal * 0.9 + 15;
        for (let y = 1; y < ah - 1; y++) {
          const row = y * aw;
          for (let x = 1; x < aw - 1; x++) {
            if (
              edgeMag[row + x] >= edgeThresh ||
              edgeMag[row + x - 1] >= edgeThresh ||
              edgeMag[row + x + 1] >= edgeThresh ||
              edgeMag[row - aw + x] >= edgeThresh ||
              edgeMag[row + aw + x] >= edgeThresh
            ) {
              mask[row + x] = 1;
            }
          }
        }
        break;
      }

      case 'luma_bright': {
        for (let i = 0; i < totalPixels; i++) {
          if (processedLuma[i] >= threshVal) {
            mask[i] = 1;
          }
        }
        break;
      }

      case 'luma_dark': {
        const darkThresh = 255 - threshVal;
        for (let i = 0; i < totalPixels; i++) {
          if (processedLuma[i] <= darkThresh) {
            mask[i] = 1;
          }
        }
        break;
      }

      case 'color_key': {
        const tolerance = (100 - thresh) * 2.8 + 15;
        for (let i = 0; i < totalPixels; i++) {
          const idx = i * 4;
          const dr = pixels[idx] - targetR;
          const dg = pixels[idx + 1] - targetG;
          const db = pixels[idx + 2] - targetB;
          const dist = Math.sqrt(dr * dr + dg * dg + db * db);
          if (dist <= tolerance) {
            mask[i] = 1;
          }
        }
        break;
      }

      case 'motion': {
        if (this.prevLuma && this.prevLuma.length === totalPixels) {
          const motionThresh = (thresh / 100) * 100 + 5;
          for (let i = 0; i < totalPixels; i++) {
            const diff = Math.abs(luma[i] - this.prevLuma[i]);
            if (diff >= motionThresh) {
              mask[i] = 1;
            }
          }
        }
        // Save current luma as previous
        if (!this.prevLuma || this.prevLuma.length !== totalPixels) {
          this.prevLuma = new Uint8Array(totalPixels);
        }
        for (let i = 0; i < totalPixels; i++) {
          this.prevLuma[i] = Math.min(255, Math.floor(luma[i]));
        }
        break;
      }

      case 'red': {
        for (let i = 0; i < totalPixels; i++) {
          const idx = i * 4;
          const r = pixels[idx];
          const g = pixels[idx + 1];
          const b = pixels[idx + 2];
          if (r > threshVal && r > g * 1.2 && r > b * 1.2) {
            mask[i] = 1;
          }
        }
        break;
      }

      case 'green': {
        for (let i = 0; i < totalPixels; i++) {
          const idx = i * 4;
          const r = pixels[idx];
          const g = pixels[idx + 1];
          const b = pixels[idx + 2];
          if (g > threshVal && g > r * 1.2 && g > b * 1.2) {
            mask[i] = 1;
          }
        }
        break;
      }

      case 'blue': {
        const minBlue = (thresh / 100) * 140 + 40;
        for (let i = 0; i < totalPixels; i++) {
          const idx = i * 4;
          const r = pixels[idx];
          const g = pixels[idx + 1];
          const b = pixels[idx + 2];
          if (b >= minBlue && b > r * 1.12 && b > g * 1.05) {
            mask[i] = 1;
          }
        }
        break;
      }

      case 'sat_high': {
        const satThresh = thresh / 100;
        for (let i = 0; i < totalPixels; i++) {
          const idx = i * 4;
          const r = pixels[idx] / 255;
          const g = pixels[idx + 1] / 255;
          const b = pixels[idx + 2] / 255;
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const sat = max === 0 ? 0 : (max - min) / max;
          if (sat >= satThresh) {
            mask[i] = 1;
          }
        }
        break;
      }

      case 'sat_low': {
        const satThresh = (100 - thresh) / 100;
        for (let i = 0; i < totalPixels; i++) {
          const idx = i * 4;
          const r = pixels[idx] / 255;
          const g = pixels[idx + 1] / 255;
          const b = pixels[idx + 2] / 255;
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const sat = max === 0 ? 0 : (max - min) / max;
          if (sat <= satThresh) {
            mask[i] = 1;
          }
        }
        break;
      }

      case 'hue_range': {
        const center = config.detection.hueCenter;
        const width = config.detection.hueWidth;
        for (let i = 0; i < totalPixels; i++) {
          const idx = i * 4;
          const r = pixels[idx] / 255;
          const g = pixels[idx + 1] / 255;
          const b = pixels[idx + 2] / 255;
          const max = Math.max(r, g, b);
          const min = Math.min(r, g, b);
          const d = max - min;
          if (d < 0.05) continue; // Uncolored

          let h = 0;
          if (max === r) {
            h = ((g - b) / d) % 6;
          } else if (max === g) {
            h = (b - r) / d + 2;
          } else {
            h = (r - g) / d + 4;
          }
          h = Math.round(h * 60);
          if (h < 0) h += 360;

          // Circular distance
          let diff = Math.abs(h - center);
          if (diff > 180) diff = 360 - diff;
          if (diff <= width) {
            mask[i] = 1;
          }
        }
        break;
      }
    }

    // Invert mask if requested
    if (config.detection.invertMask) {
      for (let i = 0; i < totalPixels; i++) {
        mask[i] = mask[i] ? 0 : 1;
      }
    }

    // If showMask is requested, render mask back to analysis canvas
    if (config.detection.showMask) {
      for (let i = 0; i < totalPixels; i++) {
        const idx = i * 4;
        const v = mask[i] ? 255 : 0;
        pixels[idx] = v;
        pixels[idx + 1] = v;
        pixels[idx + 2] = v;
        pixels[idx + 3] = 255;
      }
      this.analysisCtx.putImageData(imgData, 0, 0);
    }

    return {
      mask,
      width: aw,
      height: ah,
      scaleX: sourceWidth / aw,
      scaleY: sourceHeight / ah,
      maskCanvas: this.analysisCanvas
    };
  }

  // Fast 2-pass 1D box blur
  private applyBoxBlur(src: Float32Array, w: number, h: number, radius: number): Float32Array {
    const r = Math.min(10, Math.max(1, Math.round(radius)));
    if (!this.blurBuffer || this.blurBuffer.length !== src.length) {
      this.blurBuffer = new Float32Array(src.length);
    }
    const temp = this.blurBuffer;
    const out = new Float32Array(src.length);

    // Horizontal pass
    for (let y = 0; y < h; y++) {
      const row = y * w;
      let sum = 0;
      let count = 0;
      for (let i = -r; i <= r; i++) {
        const xi = Math.min(w - 1, Math.max(0, i));
        sum += src[row + xi];
        count++;
      }
      temp[row] = sum / count;

      for (let x = 1; x < w; x++) {
        const addX = Math.min(w - 1, x + r);
        const subX = Math.max(0, x - r - 1);
        sum += src[row + addX] - src[row + subX];
        temp[row + x] = sum / count;
      }
    }

    // Vertical pass
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let count = 0;
      for (let i = -r; i <= r; i++) {
        const yi = Math.min(h - 1, Math.max(0, i));
        sum += temp[yi * w + x];
        count++;
      }
      out[x] = sum / count;

      for (let y = 1; y < h; y++) {
        const addY = Math.min(h - 1, y + r);
        const subY = Math.max(0, y - r - 1);
        sum += temp[addY * w + x] - temp[subY * w + x];
        out[y * w + x] = sum / count;
      }
    }

    return out;
  }
}
