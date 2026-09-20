import { BlobItem, EdgeItem, Rect, TrackerConfig } from '../core/types';
import { DrawingUtils } from './DrawingUtils';
import { RegionFX } from '../core/RegionFX';
import { DetectionResult } from '../core/BlobDetector';

export class OverlayRenderer {
  private regionFX: RegionFX;
  private animTime = 0;

  constructor() {
    this.regionFX = new RegionFX();
  }

  public render(
    ctx: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
    source: CanvasImageSource,
    blobs: BlobItem[],
    edges: EdgeItem[],
    detection: DetectionResult,
    config: TrackerConfig,
    fps: number
  ) {
    this.animTime = performance.now() / 1000;

    // 1. Clear or render background
    ctx.save();
    const bgMode = config.compositing.renderGraphicsOn;
    if (bgMode === 'original') {
      ctx.drawImage(source, 0, 0, canvasWidth, canvasHeight);
    } else if (bgMode === 'solid') {
      ctx.fillStyle = config.compositing.backgroundColor;
      ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    } else {
      // Transparent
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    }

    // If Show Mask debug mode is on, overlay binary mask and return
    if (config.detection.showMask) {
      ctx.drawImage(detection.maskCanvas, 0, 0, canvasWidth, canvasHeight);
      ctx.restore();
      return;
    }

    // 2. Apply Region FX (Mosaic, Glitch, etc.) directly on the background
    if (bgMode === 'original') {
      this.regionFX.apply(ctx, canvasWidth, canvasHeight, blobs, config);
    }

    // 3. Set global overlay opacity
    ctx.globalAlpha = config.compositing.overlayOpacity;

    // 4. Draw Connection Lines (Delaunay, MST, etc.)
    if (config.lines.enable && edges.length > 0) {
      this.drawConnectionLines(ctx, edges, config);
    }

    // 5. Draw Blob Boxes & Fills
    if (config.boxes.enable && blobs.length > 0) {
      this.drawBlobBoxes(ctx, blobs, config);
    }

    // 6. Draw Center Markers
    if (config.markers.enable && blobs.length > 0) {
      this.drawCenterMarkers(ctx, blobs, config);
    }

    // 7. Draw Labels
    if (config.labels.enable && blobs.length > 0) {
      this.drawLabels(ctx, blobs, canvasWidth, canvasHeight, config);
    }

    // 8. Scan Sweep Laser Animation
    if (config.animation.scanSweep !== 'off') {
      this.drawScanSweep(ctx, canvasWidth, canvasHeight, config);
    }

    ctx.restore();
  }

  // Draw edges between blobs
  private drawConnectionLines(ctx: CanvasRenderingContext2D, edges: EdgeItem[], config: TrackerConfig) {
    ctx.save();
    ctx.strokeStyle = config.lines.color;
    ctx.fillStyle = config.lines.color;
    ctx.lineWidth = Math.max(1, config.lines.thickness);
    ctx.globalAlpha = config.lines.opacity;

    if (config.lines.dashed) {
      ctx.setLineDash([config.lines.dashLength || 4, config.lines.gapLength || 4]);
    } else {
      ctx.setLineDash([]);
    }

    const curveStyle = config.lines.curveStyle || 'straight';

    for (const e of edges) {
      ctx.beginPath();

      if (curveStyle === 'straight') {
        ctx.moveTo(e.p1.x, e.p1.y);
        ctx.lineTo(e.p2.x, e.p2.y);
      } else if (curveStyle === 'bezier_arcs') {
        const mx = (e.p1.x + e.p2.x) / 2;
        const my = (e.p1.y + e.p2.y) / 2;
        const dx = e.p2.x - e.p1.x;
        const dy = e.p2.y - e.p1.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d > 0.001) {
          const nx = -dy / d;
          const ny = dx / d;
          const sign = (e.b1Id * 3 + e.b2Id * 5) % 2 === 0 ? 1 : -1;
          const curvature = Math.min(140, Math.max(30, d * 0.32)) * sign;
          const cpx = mx + nx * curvature;
          const cpy = my + ny * curvature;
          ctx.moveTo(e.p1.x, e.p1.y);
          ctx.quadraticCurveTo(cpx, cpy, e.p2.x, e.p2.y);
        } else {
          ctx.moveTo(e.p1.x, e.p1.y);
          ctx.lineTo(e.p2.x, e.p2.y);
        }
      } else if (curveStyle === 'circular_loops') {
        const mx = (e.p1.x + e.p2.x) / 2;
        const my = (e.p1.y + e.p2.y) / 2;
        const r = Math.min(100, Math.max(15, e.distance * 0.4));
        ctx.arc(mx, my, r, 0, Math.PI * 2);
        ctx.moveTo(e.p1.x, e.p1.y);
        ctx.lineTo(e.p2.x, e.p2.y);
      }

      ctx.stroke();

      // Distance labels on edge midpoint
      if (config.lines.distanceLabels) {
        const mx = (e.p1.x + e.p2.x) / 2;
        const my = (e.p1.y + e.p2.y) / 2;
        const text = `${e.distance}px`;

        ctx.save();
        ctx.setLineDash([]);
        ctx.font = '9px "JetBrains Mono", monospace, sans-serif';
        const tw = ctx.measureText(text).width;

        // Dark background pill
        ctx.fillStyle = 'rgba(10, 15, 29, 0.8)';
        ctx.fillRect(mx - tw / 2 - 3, my - 6, tw + 6, 12);
        ctx.strokeStyle = config.lines.color;
        ctx.lineWidth = 0.8;
        ctx.strokeRect(mx - tw / 2 - 3, my - 6, tw + 6, 12);

        ctx.fillStyle = config.lines.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, mx, my);
        ctx.restore();
      }

      // Arrows
      if (config.lines.enableArrows) {
        const angle = Math.atan2(e.p2.y - e.p1.y, e.p2.x - e.p1.x);
        const arrowLen = 8;
        const mx = (e.p1.x + e.p2.x) / 2;
        const my = (e.p1.y + e.p2.y) / 2;

        ctx.save();
        ctx.setLineDash([]);
        ctx.translate(mx, my);
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.moveTo(-arrowLen, -4);
        ctx.lineTo(0, 0);
        ctx.lineTo(-arrowLen, 4);
        ctx.stroke();
        ctx.restore();
      }
    }

    ctx.restore();
  }

  // Draw Bounding Boxes with Hatch Fills & Outlines
  private drawBlobBoxes(ctx: CanvasRenderingContext2D, blobs: BlobItem[], config: TrackerConfig) {
    const { shape, borderColor, borderThickness, cornerRadius, bracketLength, fillStyle, fillColor, fillOpacity, hatchSpacing, hatchAngle, padding, scale, squarify, opacity } = config.boxes;
    const antsSpeed = config.animation.antsSpeed;

    for (const blob of blobs) {
      let rect: Rect = { ...blob.smoothedBbox };

      // Apply Padding & Scale
      rect.x -= padding;
      rect.y -= padding;
      rect.width += padding * 2;
      rect.height += padding * 2;

      if (scale !== 1.0) {
        const cx = rect.x + rect.width / 2;
        const cy = rect.y + rect.height / 2;
        rect.width *= scale;
        rect.height *= scale;
        rect.x = cx - rect.width / 2;
        rect.y = cy - rect.height / 2;
      }

      // Squarify option
      if (squarify) {
        const maxDim = Math.max(rect.width, rect.height);
        const cx = rect.x + rect.width / 2;
        const cy = rect.y + rect.height / 2;
        rect.width = maxDim;
        rect.height = maxDim;
        rect.x = cx - maxDim / 2;
        rect.y = cy - maxDim / 2;
      }

      // 1. Fill interior first (isolated context, will not corrupt border stroke path)
      DrawingUtils.fillBoxInterior(
        ctx,
        shape,
        rect,
        blob.contour,
        blob.convexHull,
        cornerRadius,
        fillStyle,
        fillColor,
        fillOpacity,
        hatchSpacing,
        hatchAngle
      );

      // 2. Stroke Box Border (Pure solid lines, no dashes)
      ctx.save();
      ctx.globalAlpha = opacity;
      ctx.strokeStyle = borderColor;
      ctx.lineWidth = Math.max(1, borderThickness);
      ctx.setLineDash([]);

      DrawingUtils.drawBoxShape(
        ctx,
        shape,
        rect,
        blob.contour,
        blob.convexHull,
        cornerRadius,
        bracketLength
      );
      ctx.stroke();

      // For brackets style, also draw 4 subtle corner dots for authentic HUD look
      if (shape === 'brackets') {
        const dotSize = 2;
        ctx.fillStyle = borderColor;
        ctx.fillRect(rect.x - dotSize / 2, rect.y - dotSize / 2, dotSize, dotSize);
        ctx.fillRect(rect.x + rect.width - dotSize / 2, rect.y - dotSize / 2, dotSize, dotSize);
        ctx.fillRect(rect.x - dotSize / 2, rect.y + rect.height - dotSize / 2, dotSize, dotSize);
        ctx.fillRect(rect.x + rect.width - dotSize / 2, rect.y + rect.height - dotSize / 2, dotSize, dotSize);
      }

      // Micro Monospace Vertex Numbers along contour boundary (from Reference 2)
      if (config.boxes.showVertices && blob.contour.length > 2) {
        ctx.save();
        ctx.font = '7px "JetBrains Mono", Consolas, monospace';
        ctx.fillStyle = borderColor;
        ctx.textBaseline = 'middle';
        const step = Math.max(1, config.boxes.vertexStep || 3);
        for (let i = 0; i < blob.contour.length; i += step) {
          const pt = blob.contour[i];
          // Micro vertex tick dot
          ctx.fillRect(pt.x - 1, pt.y - 1, 2, 2);
          // Micro 2-digit vertex number (e.g. 12, 14, 23, 31)
          const vNum = ((i * 7 + blob.id * 11) % 89 + 10).toString();
          ctx.fillText(vNum, pt.x + 3, pt.y - 3);
        }
        ctx.restore();
      }

      ctx.restore();
    }
  }

  // Draw Centroid Glyphs
  private drawCenterMarkers(ctx: CanvasRenderingContext2D, blobs: BlobItem[], config: TrackerConfig) {
    const { type, color, size, lineThickness } = config.markers;
    for (const b of blobs) {
      DrawingUtils.drawCenterMarker(ctx, type, b.smoothedCentroid, color, size, lineThickness);
    }
  }

  // Draw HUD Badges & Labels
  private drawLabels(
    ctx: CanvasRenderingContext2D,
    blobs: BlobItem[],
    cw: number,
    ch: number,
    config: TrackerConfig
  ) {
    const { showId, showCoords, showDims, showArea, format, color, fontSize, position, offsetX, offsetY, background, leaderLine } = config.labels;

    ctx.save();
    ctx.font = `${Math.max(9, fontSize)}px "JetBrains Mono", Consolas, monospace`;

    const pad = config.boxes.enable ? config.boxes.padding : 0;
    const coordTarget = config.labels.coordTarget || 'centroid';

    for (const b of blobs) {
      const parts: string[] = [];

      if (showId) {
        parts.push(`#${b.id.toString().padStart(2, '0')}`);
      }

      // Exact visible bounding box matching drawBlobBoxes padding
      const rect = {
        x: b.smoothedBbox.x - pad,
        y: b.smoothedBbox.y - pad,
        width: b.smoothedBbox.width + pad * 2,
        height: b.smoothedBbox.height + pad * 2
      };

      if (showCoords) {
        const cx = Math.round(b.smoothedCentroid.x);
        const cy = Math.round(b.smoothedCentroid.y);
        const bx = Math.round(rect.x);
        const by = Math.round(rect.y);

        if (coordTarget === 'box_corner') {
          parts.push(`TL ${bx}, ${by}`);
        } else if (coordTarget === 'both') {
          parts.push(`BOX ${bx},${by} | C ${cx},${cy}`);
        } else {
          // Centroid coordinates
          switch (format) {
            case 'hex':
              parts.push(`0x${cx.toString(16).toUpperCase().padStart(3, '0')},0x${cy.toString(16).toUpperCase().padStart(3, '0')}`);
              break;
            case 'percent':
              parts.push(`${((cx / cw) * 100).toFixed(1)}%,${((cy / ch) * 100).toFixed(1)}%`);
              break;
            case 'matrix':
              parts.push(`R${Math.floor(cy / 32).toString().padStart(2, '0')}:C${Math.floor(cx / 32).toString().padStart(2, '0')}`);
              break;
            case 'coords_clean':
              parts.push(`${cx}, ${cy}`);
              break;
            case 'coords_full':
            default:
              parts.push(`X${cx.toString().padStart(4, '0')} Y${cy.toString().padStart(4, '0')}`);
              break;
          }
        }
      }

      if (showDims) {
        parts.push(`${Math.round(rect.width)}x${Math.round(rect.height)}`);
      }

      if (showArea) {
        parts.push(`A:${b.area}`);
      }

      if (parts.length === 0) continue;

      const labelText = parts.join(' | ');
      const textMetrics = ctx.measureText(labelText);
      const tw = textMetrics.width;
      const th = fontSize + 4;

      let lx = rect.x;
      let ly = rect.y;

      switch (position) {
        case 'above':
          lx = rect.x;
          ly = rect.y - th - 3;
          break;
        case 'below':
          lx = rect.x;
          ly = rect.y + rect.height + 4;
          break;
        case 'inside':
          lx = rect.x + 4;
          ly = rect.y + 4;
          break;
        case 'left':
          lx = rect.x - tw - 6;
          ly = rect.y;
          break;
        case 'right':
          lx = rect.x + rect.width + 6;
          ly = rect.y;
          break;
        case 'at_center':
          lx = b.smoothedCentroid.x + 10;
          ly = b.smoothedCentroid.y - th / 2;
          break;
      }

      lx += offsetX;
      ly += offsetY;

      // Draw Leader line if offset is significant
      if (leaderLine && (Math.abs(offsetX) > 20 || Math.abs(offsetY) > 20)) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 0.8;
        ctx.setLineDash([2, 2]);
        ctx.beginPath();
        ctx.moveTo(rect.x + rect.width / 2, rect.y + rect.height / 2);
        ctx.lineTo(lx, ly + th / 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Background plate
      const padX = 6;
      const padY = 3;
      if (background) {
        ctx.fillStyle = 'rgba(6, 11, 25, 0.85)';
        ctx.beginPath();
        ctx.roundRect(lx - padX, ly - padY, tw + padX * 2, th + padY * 2, 3);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      ctx.fillStyle = color;
      ctx.textBaseline = 'top';
      ctx.fillText(labelText, lx, ly);
    }

    ctx.restore();
  }

  // Scan Sweep Line
  private drawScanSweep(ctx: CanvasRenderingContext2D, cw: number, ch: number, config: TrackerConfig) {
    const mode = config.animation.scanSweep;
    const speed = config.animation.sweepSpeed;
    const brightness = config.animation.sweepBrightness / 100;
    const color = config.animation.sweepColor || '#00d2ff';

    const t = (this.animTime * speed) % 1.0;

    ctx.save();
    ctx.globalAlpha = brightness;

    if (mode === 'horizontal') {
      const x = t * cw;
      const grad = ctx.createLinearGradient(x - 50, 0, x, 0);
      grad.addColorStop(0, 'transparent');
      grad.addColorStop(0.8, color);
      grad.addColorStop(1, '#ffffff');

      ctx.fillStyle = grad;
      ctx.fillRect(x - 50, 0, 50, ch);

      // Sharp laser line
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, ch);
      ctx.stroke();
    } else if (mode === 'vertical') {
      const y = t * ch;
      const grad = ctx.createLinearGradient(0, y - 50, 0, y);
      grad.addColorStop(0, 'transparent');
      grad.addColorStop(0.8, color);
      grad.addColorStop(1, '#ffffff');

      ctx.fillStyle = grad;
      ctx.fillRect(0, y - 50, cw, 50);

      // Sharp laser line
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(cw, y);
      ctx.stroke();
    }

    ctx.restore();
  }
}
