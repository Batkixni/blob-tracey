import { BoxShape, FillStyle, MarkerType, Point, Rect } from '../core/types';

export class DrawingUtils {
  // Chaikin's corner cutting algorithm for smooth contours and polygons
  public static smoothPolygon(points: Point[], iterations = 2): Point[] {
    if (points.length <= 3) return points;
    let current = points;
    for (let it = 0; it < iterations; it++) {
      const smoothed: Point[] = [];
      const len = current.length;
      for (let i = 0; i < len; i++) {
        const p0 = current[i];
        const p1 = current[(i + 1) % len];
        smoothed.push({
          x: 0.75 * p0.x + 0.25 * p1.x,
          y: 0.75 * p0.y + 0.25 * p1.y
        });
        smoothed.push({
          x: 0.25 * p0.x + 0.75 * p1.x,
          y: 0.25 * p0.y + 0.75 * p1.y
        });
      }
      current = smoothed;
    }
    return current;
  }

  // Build the closed boundary path used for interior fill clipping
  public static buildClosedBoundaryPath(
    ctx: CanvasRenderingContext2D,
    shape: BoxShape,
    rect: Rect,
    contour: Point[],
    hull: Point[],
    cornerRadius: number
  ) {
    const { x, y, width: w, height: h } = rect;
    ctx.beginPath();

    if (shape === 'rounded') {
      const r = Math.min(cornerRadius, w / 2, h / 2);
      ctx.roundRect(x, y, w, h, Math.max(0, r));
    } else if (shape === 'ellipse') {
      ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    } else if (shape === 'contour' && contour.length > 2) {
      const smoothIters = Math.min(3, Math.max(0, Math.floor(cornerRadius / 20)));
      const pts = smoothIters > 0 ? this.smoothPolygon(contour, smoothIters) : contour;
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.closePath();
    } else if (shape === 'convex_hull' && hull.length > 2) {
      const smoothIters = Math.min(2, Math.max(0, Math.floor(cornerRadius / 30)));
      const pts = smoothIters > 0 ? this.smoothPolygon(hull, smoothIters) : hull;
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) {
        ctx.lineTo(pts[i].x, pts[i].y);
      }
      ctx.closePath();
    } else if (shape === 'hexagon') {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const rx = w / 2;
      const ry = h / 2;
      for (let i = 0; i < 6; i++) {
        const ang = (i * Math.PI) / 3;
        const px = cx + rx * Math.cos(ang);
        const py = cy + ry * Math.sin(ang);
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
    } else {
      // Default closed bounding box for brackets, crop_marks, rectangle, underline
      ctx.rect(x, y, w, h);
    }
  }

  // Draw interior fill (Solid, Hatch, Cross-Hatch)
  public static fillBoxInterior(
    ctx: CanvasRenderingContext2D,
    shape: BoxShape,
    rect: Rect,
    contour: Point[],
    hull: Point[],
    cornerRadius: number,
    style: FillStyle,
    color: string,
    opacity: number,
    spacing: number,
    angleDeg: number
  ) {
    if (style === 'none' || opacity <= 0) return;

    ctx.save();
    ctx.globalAlpha = opacity;

    // Construct the closed boundary path
    this.buildClosedBoundaryPath(ctx, shape, rect, contour, hull, cornerRadius);

    if (style === 'solid') {
      ctx.fillStyle = color;
      ctx.fill();
      ctx.restore();
      return;
    }

    // Hatch & Cross-hatch fills
    ctx.clip(); // Clip strictly inside the closed boundary
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;

    const { x, y, width: w, height: h } = rect;
    const diag = Math.sqrt(w * w + h * h) * 1.5;
    const cx = x + w / 2;
    const cy = y + h / 2;
    const rad = (angleDeg * Math.PI) / 180;
    const sp = Math.max(3, spacing);

    ctx.translate(cx, cy);
    ctx.rotate(rad);

    ctx.beginPath();
    for (let p = -diag; p <= diag; p += sp) {
      ctx.moveTo(p, -diag);
      ctx.lineTo(p, diag);
    }
    if (style === 'cross_hatch') {
      for (let p = -diag; p <= diag; p += sp) {
        ctx.moveTo(-diag, p);
        ctx.lineTo(diag, p);
      }
    }
    ctx.stroke();

    ctx.restore();
  }

  // Draw box border shape path (to be stroked by the caller)
  public static drawBoxShape(
    ctx: CanvasRenderingContext2D,
    shape: BoxShape,
    rect: Rect,
    contour: Point[],
    hull: Point[],
    cornerRadius: number,
    bracketLength: number
  ) {
    const { x, y, width: w, height: h } = rect;

    ctx.beginPath();

    switch (shape) {
      case 'rectangle': {
        ctx.rect(x, y, w, h);
        break;
      }

      case 'rounded': {
        const r = Math.min(cornerRadius, w / 2, h / 2);
        ctx.roundRect(x, y, w, h, Math.max(0, r));
        break;
      }

      case 'brackets': {
        // Tech Corner Brackets (L-shaped)
        const bl = Math.max(6, Math.min(bracketLength, w * 0.4, h * 0.4));

        // Top-left
        ctx.moveTo(x, y + bl);
        ctx.lineTo(x, y);
        ctx.lineTo(x + bl, y);

        // Top-right
        ctx.moveTo(x + w - bl, y);
        ctx.lineTo(x + w, y);
        ctx.lineTo(x + w, y + bl);

        // Bottom-left
        ctx.moveTo(x, y + h - bl);
        ctx.lineTo(x, y + h);
        ctx.lineTo(x + bl, y + h);

        // Bottom-right
        ctx.moveTo(x + w - bl, y + h);
        ctx.lineTo(x + w, y + h);
        ctx.lineTo(x + w, y + h - bl);
        break;
      }

      case 'crop_marks': {
        const cl = Math.max(5, Math.min(bracketLength, w * 0.35, h * 0.35));
        const ext = cl * 0.5;

        // TL
        ctx.moveTo(x - ext, y); ctx.lineTo(x + cl, y);
        ctx.moveTo(x, y - ext); ctx.lineTo(x, y + cl);

        // TR
        ctx.moveTo(x + w + ext, y); ctx.lineTo(x + w - cl, y);
        ctx.moveTo(x + w, y - ext); ctx.lineTo(x + w, y + cl);

        // BL
        ctx.moveTo(x - ext, y + h); ctx.lineTo(x + cl, y + h);
        ctx.moveTo(x, y + h + ext); ctx.lineTo(x, y + h - cl);

        // BR
        ctx.moveTo(x + w + ext, y + h); ctx.lineTo(x + w - cl, y + h);
        ctx.moveTo(x + w, y + h + ext); ctx.lineTo(x + w, y + h - cl);
        break;
      }

      case 'ellipse': {
        ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        break;
      }

      case 'hexagon': {
        const cx = x + w / 2;
        const cy = y + h / 2;
        const rx = w / 2;
        const ry = h / 2;
        for (let i = 0; i < 6; i++) {
          const ang = (i * Math.PI) / 3;
          const px = cx + rx * Math.cos(ang);
          const py = cy + ry * Math.sin(ang);
          if (i === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        }
        ctx.closePath();
        break;
      }

      case 'underline': {
        const tick = 6;
        ctx.moveTo(x, y + h - tick);
        ctx.lineTo(x, y + h);
        ctx.lineTo(x + w, y + h);
        ctx.lineTo(x + w, y + h - tick);
        break;
      }

      case 'contour': {
        if (contour.length > 2) {
          const smoothIters = Math.min(3, Math.max(0, Math.floor(cornerRadius / 20)));
          const pts = smoothIters > 0 ? this.smoothPolygon(contour, smoothIters) : contour;
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
          }
          ctx.closePath();
        } else {
          ctx.rect(x, y, w, h);
        }
        break;
      }

      case 'convex_hull': {
        if (hull.length > 2) {
          const smoothIters = Math.min(2, Math.max(0, Math.floor(cornerRadius / 30)));
          const pts = smoothIters > 0 ? this.smoothPolygon(hull, smoothIters) : hull;
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
          }
          ctx.closePath();
        } else {
          ctx.rect(x, y, w, h);
        }
        break;
      }
    }
  }

  // Center glyph markers
  public static drawCenterMarker(
    ctx: CanvasRenderingContext2D,
    type: MarkerType,
    center: Point,
    color: string,
    size: number,
    thickness: number
  ) {
    const s = Math.max(2, size);
    ctx.save();

    const x = Math.round(center.x);
    const y = Math.round(center.y);
    const t = Math.max(1, thickness);
    const outlineT = t + 2;

    switch (type) {
      case 'plus': {
        // High-contrast dark outline
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.lineWidth = outlineT;
        ctx.beginPath();
        ctx.moveTo(x - s, y); ctx.lineTo(x + s, y);
        ctx.moveTo(x, y - s); ctx.lineTo(x, y + s);
        ctx.stroke();

        // Crisp foreground cross
        ctx.strokeStyle = color;
        ctx.lineWidth = t;
        ctx.beginPath();
        ctx.moveTo(x - s, y); ctx.lineTo(x + s, y);
        ctx.moveTo(x, y - s); ctx.lineTo(x, y + s);
        ctx.stroke();
        break;
      }

      case 'dot': {
        // Dark ring outline
        ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.beginPath();
        ctx.arc(x, y, s + 1.5, 0, Math.PI * 2);
        ctx.fill();

        // Foreground dot
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, s, 0, Math.PI * 2);
        ctx.fill();
        break;
      }

      case 'cross': {
        const d = s * 0.707;
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.lineWidth = outlineT;
        ctx.beginPath();
        ctx.moveTo(x - d, y - d); ctx.lineTo(x + d, y + d);
        ctx.moveTo(x + d, y - d); ctx.lineTo(x - d, y + d);
        ctx.stroke();

        ctx.strokeStyle = color;
        ctx.lineWidth = t;
        ctx.beginPath();
        ctx.moveTo(x - d, y - d); ctx.lineTo(x + d, y + d);
        ctx.moveTo(x + d, y - d); ctx.lineTo(x - d, y + d);
        ctx.stroke();
        break;
      }

      case 'ring': {
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.lineWidth = outlineT;
        ctx.beginPath();
        ctx.arc(x, y, s, 0, Math.PI * 2);
        ctx.stroke();

        ctx.strokeStyle = color;
        ctx.lineWidth = t;
        ctx.beginPath();
        ctx.arc(x, y, s, 0, Math.PI * 2);
        ctx.stroke();
        break;
      }

      case 'crosshair': {
        const gap = Math.max(2, Math.floor(s * 0.35));
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
        ctx.lineWidth = outlineT;
        ctx.beginPath();
        ctx.arc(x, y, s * 0.6, 0, Math.PI * 2);
        ctx.moveTo(x - s * 1.3, y); ctx.lineTo(x - gap, y);
        ctx.moveTo(x + gap, y); ctx.lineTo(x + s * 1.3, y);
        ctx.moveTo(x, y - s * 1.3); ctx.lineTo(x, y - gap);
        ctx.moveTo(x, y + gap); ctx.lineTo(x, y + s * 1.3);
        ctx.stroke();

        ctx.strokeStyle = color;
        ctx.lineWidth = t;
        ctx.beginPath();
        ctx.arc(x, y, s * 0.6, 0, Math.PI * 2);
        ctx.moveTo(x - s * 1.3, y); ctx.lineTo(x - gap, y);
        ctx.moveTo(x + gap, y); ctx.lineTo(x + s * 1.3, y);
        ctx.moveTo(x, y - s * 1.3); ctx.lineTo(x, y - gap);
        ctx.moveTo(x, y + gap); ctx.lineTo(x, y + s * 1.3);
        ctx.stroke();
        break;
      }
    }

    ctx.restore();
  }
}
