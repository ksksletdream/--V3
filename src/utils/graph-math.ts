/**
 * Pure math and geometry utilities for relationship graph, marquee box selection, and freehand lasso
 */

export type AnchorPosition = 'top' | 'right' | 'bottom' | 'left';

export const CARD_WIDTH = 236;
export const CARD_HEIGHT = 148;

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

/**
 * Returns exact coordinates for an anchor on a given card rectangle
 */
export function getAnchorPoint(rect: Rect, anchor: AnchorPosition): Point {
  switch (anchor) {
    case 'top':
      return { x: rect.x + rect.width / 2, y: rect.y };
    case 'right':
      return { x: rect.x + rect.width, y: rect.y + rect.height / 2 };
    case 'bottom':
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height };
    case 'left':
      return { x: rect.x, y: rect.y + rect.height / 2 };
  }
}

/**
 * Determines closest anchor to a target point
 */
export function getClosestAnchor(fromPoint: Point, targetRect: Rect): AnchorPosition {
  const anchors: AnchorPosition[] = ['top', 'right', 'bottom', 'left'];
  let bestAnchor: AnchorPosition = 'left';
  let minDistance = Infinity;

  for (const anchor of anchors) {
    const p = getAnchorPoint(targetRect, anchor);
    const distSq = (p.x - fromPoint.x) ** 2 + (p.y - fromPoint.y) ** 2;
    if (distSq < minDistance) {
      minDistance = distSq;
      bestAnchor = anchor;
    }
  }
  return bestAnchor;
}

/**
 * Generate smooth cubic Bezier SVG path between two anchors with proper tangents and optional midpoint deflection
 */
export function calculateBezierPath(
  p1: Point,
  p2: Point,
  a1: AnchorPosition,
  a2: AnchorPosition,
  offsetX: number = 0,
  offsetY: number = 0
): { path: string; midPoint: Point } {
  const dx = Math.abs(p2.x - p1.x);
  const dy = Math.abs(p2.y - p1.y);
  const curvature = Math.max(48, Math.min(180, Math.hypot(dx, dy) * 0.42));

  const cp1 = { ...p1 };
  const cp2 = { ...p2 };

  switch (a1) {
    case 'top':
      cp1.y -= curvature;
      break;
    case 'bottom':
      cp1.y += curvature;
      break;
    case 'left':
      cp1.x -= curvature;
      break;
    case 'right':
      cp1.x += curvature;
      break;
  }

  switch (a2) {
    case 'top':
      cp2.y -= curvature;
      break;
    case 'bottom':
      cp2.y += curvature;
      break;
    case 'left':
      cp2.x -= curvature;
      break;
    case 'right':
      cp2.x += curvature;
      break;
  }

  const t = 0.5;
  const mt = 1 - t;
  const midX =
    mt * mt * mt * p1.x +
    3 * mt * mt * t * cp1.x +
    3 * mt * t * t * cp2.x +
    t * t * t * p2.x;
  const midY =
    mt * mt * mt * p1.y +
    3 * mt * mt * t * cp1.y +
    3 * mt * t * t * cp2.y +
    t * t * t * p2.y;

  const bentCp1X = cp1.x + (offsetX * 4) / 3;
  const bentCp1Y = cp1.y + (offsetY * 4) / 3;
  const bentCp2X = cp2.x + (offsetX * 4) / 3;
  const bentCp2Y = cp2.y + (offsetY * 4) / 3;

  const path = `M ${p1.x} ${p1.y} C ${bentCp1X} ${bentCp1Y}, ${bentCp2X} ${bentCp2Y}, ${p2.x} ${p2.y}`;
  return {
    path,
    midPoint: { x: midX, y: midY },
  };
}

/**
 * Generate flexible SVG path between two anchors based on line type (bezier, straight, step, arc)
 */
export function calculateConnectionPath(
  p1: Point,
  p2: Point,
  a1: AnchorPosition,
  a2: AnchorPosition,
  lineType: 'bezier' | 'straight' | 'step' | 'arc' = 'bezier',
  offsetX: number = 0,
  offsetY: number = 0
): { path: string; midPoint: Point } {
  if (lineType === 'straight') {
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;
    if (offsetX !== 0 || offsetY !== 0) {
      return {
        path: `M ${p1.x} ${p1.y} Q ${midX + offsetX * 2} ${midY + offsetY * 2} ${p2.x} ${p2.y}`,
        midPoint: { x: midX, y: midY },
      };
    }
    return {
      path: `M ${p1.x} ${p1.y} L ${p2.x} ${p2.y}`,
      midPoint: { x: midX, y: midY },
    };
  }

  if (lineType === 'step') {
    const isHorizontalOrigin = a1 === 'left' || a1 === 'right';
    let path = '';
    const midX = (p1.x + p2.x) / 2;
    const midY = (p1.y + p2.y) / 2;

    if (isHorizontalOrigin) {
      const stepX = midX + offsetX;
      path = `M ${p1.x} ${p1.y} L ${stepX} ${p1.y} L ${stepX} ${p2.y} L ${p2.x} ${p2.y}`;
    } else {
      const stepY = midY + offsetY;
      path = `M ${p1.x} ${p1.y} L ${p1.x} ${stepY} L ${p2.x} ${stepY} L ${p2.x} ${p2.y}`;
    }

    return {
      path,
      midPoint: { x: midX, y: midY },
    };
  }

  if (lineType === 'arc') {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.hypot(dx, dy);
    const radius = Math.max(dist * 0.85, 120);
    const path = `M ${p1.x} ${p1.y} A ${radius} ${radius} 0 0 1 ${p2.x} ${p2.y}`;
    const midX = (p1.x + p2.x) / 2 - dy * 0.08;
    const midY = (p1.y + p2.y) / 2 + dx * 0.08;
    return {
      path,
      midPoint: { x: midX, y: midY },
    };
  }

  return calculateBezierPath(p1, p2, a1, a2, offsetX, offsetY);
}

/**
 * Converts screen client coordinates to canvas world coordinates
 */
export function screenToCanvas(
  clientX: number,
  clientY: number,
  canvasContainerRect: DOMRect,
  panX: number,
  panY: number,
  zoom: number
): Point {
  const relativeX = clientX - canvasContainerRect.left;
  const relativeY = clientY - canvasContainerRect.top;
  return {
    x: (relativeX - panX) / zoom,
    y: (relativeY - panY) / zoom,
  };
}

/**
 * Converts canvas coordinates to screen coordinates
 */
export function canvasToScreen(
  worldX: number,
  worldY: number,
  panX: number,
  panY: number,
  zoom: number
): Point {
  return {
    x: worldX * zoom + panX,
    y: worldY * zoom + panY,
  };
}

/**
 * Checks whether two axis-aligned rectangles intersect
 */
export function isRectIntersecting(r1: Rect, r2: Rect): boolean {
  return !(
    r2.x > r1.x + r1.width ||
    r2.x + r2.width < r1.x ||
    r2.y > r1.y + r1.height ||
    r2.y + r2.height < r1.y
  );
}

/**
 * Ray-casting algorithm to check if a point is inside a polygon (for freehand lasso selection)
 */
export function isPointInPolygon(point: Point, polygon: Point[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi + 1e-10) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Perpendicular distance from a point to a line segment
 */
function perpendicularDistance(pt: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const mag = Math.hypot(dx, dy);
  if (mag < 1e-6) return Math.hypot(pt.x - lineStart.x, pt.y - lineStart.y);
  const u = ((pt.x - lineStart.x) * dx + (pt.y - lineStart.y) * dy) / (mag * mag);
  const clampedU = Math.max(0, Math.min(1, u));
  const projX = lineStart.x + clampedU * dx;
  const projY = lineStart.y + clampedU * dy;
  return Math.hypot(pt.x - projX, pt.y - projY);
}

/**
 * Ramer-Douglas-Peucker (RDP) algorithm to simplify freehand stroke points
 */
export function simplifyPointsRDP(points: Point[], epsilon: number = 2.2): Point[] {
  if (points.length <= 2) return points;
  let maxDist = 0;
  let index = 0;
  const end = points.length - 1;

  for (let i = 1; i < end; i++) {
    const d = perpendicularDistance(points[i], points[0], points[end]);
    if (d > maxDist) {
      index = i;
      maxDist = d;
    }
  }

  if (maxDist > epsilon) {
    const left = simplifyPointsRDP(points.slice(0, index + 1), epsilon);
    const right = simplifyPointsRDP(points.slice(index), epsilon);
    return [...left.slice(0, left.length - 1), ...right];
  }
  return [points[0], points[end]];
}

/**
 * Generates a smooth quadratic Bezier SVG path from world coordinates
 */
export function generateSmoothSvgPath(points: Point[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    const p = points[0];
    return `M ${p.x.toFixed(1)} ${p.y.toFixed(1)} L ${(p.x + 0.5).toFixed(1)} ${(p.y + 0.5).toFixed(1)}`;
  }
  if (points.length === 2) {
    return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)} L ${points[1].x.toFixed(1)} ${points[1].y.toFixed(1)}`;
  }

  let d = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 1; i < points.length - 1; i++) {
    const midX = (points[i].x + points[i + 1].x) / 2;
    const midY = (points[i].y + points[i + 1].y) / 2;
    d += ` Q ${points[i].x.toFixed(1)} ${points[i].y.toFixed(1)} ${midX.toFixed(1)} ${midY.toFixed(1)}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
  return d;
}

/**
 * Generates a smooth quadratic Bezier SVG path from normalized (0..1) points and a bounding box
 */
export function generateSmoothSvgPathFromNormalized(
  normPoints: Point[] | undefined,
  x: number,
  y: number,
  width: number,
  height: number
): string {
  if (!normPoints || normPoints.length === 0) return '';
  const worldPts = normPoints.map((np) => ({
    x: x + np.x * width,
    y: y + np.y * height,
  }));
  return generateSmoothSvgPath(worldPts);
}

/**
 * Normalizes raw world stroke points into a bounding box + 0..1 relative points
 */
export function normalizeStrokePoints(points: Point[]): {
  x: number;
  y: number;
  width: number;
  height: number;
  normalizedPoints: Point[];
} {
  if (points.length === 0) {
    return { x: 0, y: 0, width: 20, height: 20, normalizedPoints: [{ x: 0, y: 0 }] };
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  const rawW = maxX - minX;
  const rawH = maxY - minY;
  const width = Math.max(16, Math.round(rawW));
  const height = Math.max(16, Math.round(rawH));

  const normalizedPoints = points.map((p) => ({
    x: rawW < 1e-3 ? 0.5 : Number(((p.x - minX) / width).toFixed(4)),
    y: rawH < 1e-3 ? 0.5 : Number(((p.y - minY) / height).toFixed(4)),
  }));

  return {
    x: Math.round(minX),
    y: Math.round(minY),
    width,
    height,
    normalizedPoints,
  };
}

/**
 * Heuristic single-stroke Smart Shape recognizer:
 * Classifies a hand-drawn stroke into 'line', 'arrow', 'ellipse', or 'rect' when confident,
 * or returns null if the stroke is an arbitrary freehand curve.
 */
export function recognizeSmartShape(points: Point[]): {
  shapeType: 'rect' | 'ellipse' | 'line' | 'arrow';
  x: number;
  y: number;
  width: number;
  height: number;
  normalizedPoints?: Point[];
} | null {
  if (points.length < 5) return null;

  let pathLength = 0;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
    if (i > 0) {
      pathLength += Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y);
    }
  }

  const start = points[0];
  const end = points[points.length - 1];
  const directDist = Math.hypot(end.x - start.x, end.y - start.y);
  const boxW = maxX - minX;
  const boxH = maxY - minY;
  const diag = Math.hypot(boxW, boxH);

  if (pathLength < 36 || diag < 28) return null;

  // 1. Check Straight Line: pathLength very close to directDist
  if (directDist > 36 && pathLength / directDist < 1.14) {
    const norm = normalizeStrokePoints([start, end]);
    return {
      shapeType: 'line',
      x: norm.x,
      y: norm.y,
      width: norm.width,
      height: norm.height,
      normalizedPoints: norm.normalizedPoints,
    };
  }

  // 2. Check Single-Stroke Arrow: main shaft (first 75% of points) is straight,
  // and the tail hook bends sharply at the end
  const shaftEndIdx = Math.floor(points.length * 0.76);
  if (shaftEndIdx >= 4) {
    const shaftPoint = points[shaftEndIdx];
    const shaftDirect = Math.hypot(shaftPoint.x - start.x, shaftPoint.y - start.y);
    let shaftLen = 0;
    for (let i = 1; i <= shaftEndIdx; i++) {
      shaftLen += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    }
    const hookLen = pathLength - shaftLen;
    if (
      shaftDirect > 45 &&
      shaftLen / shaftDirect < 1.15 &&
      hookLen > 12 &&
      hookLen < shaftDirect * 0.55
    ) {
      const v1x = shaftPoint.x - start.x;
      const v1y = shaftPoint.y - start.y;
      const v2x = end.x - shaftPoint.x;
      const v2y = end.y - shaftPoint.y;
      const dot = (v1x * v2x + v1y * v2y) / (Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y) + 1e-6);
      // Hook turns back or sideways (dot < 0.35)
      if (dot < 0.35) {
        const norm = normalizeStrokePoints([start, shaftPoint]);
        return {
          shapeType: 'arrow',
          x: norm.x,
          y: norm.y,
          width: norm.width,
          height: norm.height,
          normalizedPoints: norm.normalizedPoints,
        };
      }
    }
  }

  // 3. Check Closed Shapes (Circle/Ellipse vs Rectangle)
  const isClosed = directDist < Math.max(68, pathLength * 0.28);
  if (isClosed && boxW >= 34 && boxH >= 34) {
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    const rx = boxW / 2;
    const ry = boxH / 2;

    // Measure radial deviation from an ideal ellipse and corner proximity for a rectangle
    let ellipseErrSum = 0;
    let rectEdgeDistSum = 0;
    for (const p of points) {
      const normRx = (p.x - cx) / (rx || 1);
      const normRy = (p.y - cy) / (ry || 1);
      const r = Math.hypot(normRx, normRy);
      ellipseErrSum += Math.abs(r - 1);

      const dLeft = Math.abs(p.x - minX) / boxW;
      const dRight = Math.abs(maxX - p.x) / boxW;
      const dTop = Math.abs(p.y - minY) / boxH;
      const dBottom = Math.abs(maxY - p.y) / boxH;
      rectEdgeDistSum += Math.min(dLeft, dRight, dTop, dBottom);
    }

    const avgEllipseErr = ellipseErrSum / points.length;
    const avgRectEdgeErr = rectEdgeDistSum / points.length;

    if (avgEllipseErr < 0.22 || avgRectEdgeErr < 0.16) {
      const shapeType = avgEllipseErr <= avgRectEdgeErr * 1.35 ? 'ellipse' : 'rect';
      return {
        shapeType,
        x: Math.round(minX),
        y: Math.round(minY),
        width: Math.round(boxW),
        height: Math.round(boxH),
      };
    }
  }

  return null;
}

/**
 * Checks if two line segments (p1-p2) and (p3-p4) intersect
 */
export function doLineSegmentsIntersect(p1: Point, p2: Point, p3: Point, p4: Point): boolean {
  const ccw = (A: Point, B: Point, C: Point) =>
    (C.y - A.y) * (B.x - A.x) > (B.y - A.y) * (C.x - A.x);
  return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4);
}

/**
 * Checks if a user's polyline gesture (e.g. Lasso Knife or Eraser) intersects a relationship curve
 * approximated by sampling points between p1, midPoint, and p2
 */
export function doesPolylineIntersectCurve(
  gesturePoints: Point[],
  p1: Point,
  midPoint: Point,
  p2: Point
): boolean {
  if (gesturePoints.length < 2) return false;
  // Approximate the curve with 8 segments using quadratic Bezier through midPoint
  const controlX = 2 * midPoint.x - 0.5 * (p1.x + p2.x);
  const controlY = 2 * midPoint.y - 0.5 * (p1.y + p2.y);
  const curveSamples: Point[] = [];
  const steps = 8;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    curveSamples.push({
      x: mt * mt * p1.x + 2 * mt * t * controlX + t * t * p2.x,
      y: mt * mt * p1.y + 2 * mt * t * controlY + t * t * p2.y,
    });
  }

  for (let i = 0; i < gesturePoints.length - 1; i++) {
    const a1 = gesturePoints[i];
    const a2 = gesturePoints[i + 1];
    for (let j = 0; j < curveSamples.length - 1; j++) {
      if (doLineSegmentsIntersect(a1, a2, curveSamples[j], curveSamples[j + 1])) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Samples points along a relationship curve between p1 and p2 with midpoint offset
 */
export function sampleRelationshipPoints(
  p1: Point,
  p2: Point,
  offsetX: number = 0,
  offsetY: number = 0,
  steps: number = 10
): Point[] {
  const midX = (p1.x + p2.x) / 2 + offsetX;
  const midY = (p1.y + p2.y) / 2 + offsetY;
  const controlX = 2 * midX - 0.5 * (p1.x + p2.x);
  const controlY = 2 * midY - 0.5 * (p1.y + p2.y);
  const samples: Point[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    samples.push({
      x: mt * mt * p1.x + 2 * mt * t * controlX + t * t * p2.x,
      y: mt * mt * p1.y + 2 * mt * t * controlY + t * t * p2.y,
    });
  }
  return samples;
}

/**
 * Checks if any point of a polyline is inside a polygon or intersects its edges
 */
export function isPolylineIntersectingPolygon(polyline: Point[], polygon: Point[]): boolean {
  if (polyline.length === 0 || polygon.length < 3) return false;
  for (const pt of polyline) {
    if (isPointInPolygon(pt, polygon)) return true;
  }
  for (let i = 0; i < polyline.length - 1; i++) {
    for (let j = 0; j < polygon.length; j++) {
      const nextJ = (j + 1) % polygon.length;
      if (doLineSegmentsIntersect(polyline[i], polyline[i + 1], polygon[j], polygon[nextJ])) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Checks if a world point is near a vector annotation or inside its bounds (used by Eraser tool)
 */
export function isPointNearAnnotation(
  pt: Point,
  ann: {
    kind: string;
    x: number;
    y: number;
    width: number;
    height: number;
    points?: Point[];
  },
  threshold: number = 18
): boolean {
  // Fast bounding-box check with margin
  if (
    pt.x < ann.x - threshold ||
    pt.x > ann.x + ann.width + threshold ||
    pt.y < ann.y - threshold ||
    pt.y > ann.y + ann.height + threshold
  ) {
    return false;
  }

  if (ann.kind === 'sticky' || (ann.kind === 'shape' && (!ann.points || ann.points.length === 0))) {
    return (
      pt.x >= ann.x - threshold * 0.5 &&
      pt.x <= ann.x + ann.width + threshold * 0.5 &&
      pt.y >= ann.y - threshold * 0.5 &&
      pt.y <= ann.y + ann.height + threshold * 0.5
    );
  }

  if (ann.points && ann.points.length > 0) {
    const worldPts = ann.points.map((np) => ({
      x: ann.x + np.x * ann.width,
      y: ann.y + np.y * ann.height,
    }));
    if (worldPts.length === 1) {
      return Math.hypot(pt.x - worldPts[0].x, pt.y - worldPts[0].y) <= threshold;
    }
    for (let i = 0; i < worldPts.length - 1; i++) {
      if (perpendicularDistance(pt, worldPts[i], worldPts[i + 1]) <= threshold) {
        return true;
      }
    }
  }

  return false;
}


