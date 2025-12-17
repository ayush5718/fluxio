
import { ExcalidrawElement, Point, AnchorPosition, ResizeHandle } from "../types";
import { measureText } from "./renderer";

// --- Geometry Intersection Utils ---

export const getElementBounds = (element: ExcalidrawElement) => {
    return {
        x: element.x,
        y: element.y,
        w: element.width,
        h: element.height,
        cx: element.x + element.width / 2,
        cy: element.y + element.height / 2
    };
};

// Find intersection of line (p1->p2) with rectangle (x,y,w,h)
const intersectLineRect = (p1: Point, p2: Point, x: number, y: number, w: number, h: number): Point | null => {
    const minX = x, maxX = x + w, minY = y, maxY = y + h;
    const points: Point[] = [];

    // Liang-Barsky or simple 4-segment check
    const segments = [
        [{ x: minX, y: minY }, { x: maxX, y: minY }], // Top
        [{ x: maxX, y: minY }, { x: maxX, y: maxY }], // Right
        [{ x: maxX, y: maxY }, { x: minX, y: maxY }], // Bottom
        [{ x: minX, y: maxY }, { x: minX, y: minY }]  // Left
    ];

    segments.forEach(([a, b]) => {
        const det = (p2.x - p1.x) * (b.y - a.y) - (b.x - a.x) * (p2.y - p1.y);
        if (det === 0) return;
        const lambda = ((b.y - a.y) * (b.x - p1.x) + (a.x - b.x) * (b.y - p1.y)) / det;
        const gamma = ((p1.y - p2.y) * (b.x - p1.x) + (p2.x - p1.x) * (b.y - p1.y)) / det;
        if (0 <= lambda && lambda <= 1 && 0 <= gamma && gamma <= 1) {
            points.push({
                x: p1.x + lambda * (p2.x - p1.x),
                y: p1.y + lambda * (p2.y - p1.y)
            });
        }
    });

    // Return point closest to p1 (source)
    if (points.length === 0) return null;
    return points.reduce((prev, curr) => getDistance(p1, prev) < getDistance(p1, curr) ? prev : curr);
};

// Ray-casting approach: Intersect ray from P1 (external) to P2 (center) with Element
export const getIntersectingPoint = (element: ExcalidrawElement, fromPoint: Point): Point => {
    const { x, y, w, h, cx, cy } = getElementBounds(element);
    const center = { x: cx, y: cy };

    if (element.type === 'ellipse') {
        // Ellipse Intersection
        // x = cx + w/2 cos t, y = cy + h/2 sin t
        const angle = Math.atan2(fromPoint.y - cy, fromPoint.x - cx);
        return {
            x: cx + (w / 2) * Math.cos(angle),
            y: cy + (h / 2) * Math.sin(angle)
        };
    }

    if (element.type === 'diamond') {
        const top = { x: cx, y: y };
        const right = { x: x + w, y: cy };
        const bottom = { x: cx, y: y + h };
        const left = { x: x, y: cy };

        // Treat diamond as 4 segments
        // We want intersection of Line(From -> Center) with these 4 segments
        const segments = [[top, right], [right, bottom], [bottom, left], [left, top]];

        // Re-use logic: Intersection of Ray(From -> Center)
        // Manual segment check
        for (const [a, b] of segments) {
            const det = (center.x - fromPoint.x) * (b.y - a.y) - (b.x - a.x) * (center.y - fromPoint.y);
            if (det === 0) continue;
            const lambda = ((b.y - a.y) * (b.x - fromPoint.x) + (a.x - b.x) * (b.y - fromPoint.y)) / det;
            const gamma = ((fromPoint.y - center.y) * (b.x - fromPoint.x) + (center.x - fromPoint.x) * (b.y - fromPoint.y)) / det;
            if (0 <= lambda && lambda <= 1 && 0 <= gamma && gamma <= 1) {
                return {
                    x: fromPoint.x + lambda * (center.x - fromPoint.x),
                    y: fromPoint.y + lambda * (center.y - fromPoint.y)
                };
            }
        }
        return center;
    }

    // Default: Rectangle / Frame / Text
    // Intersect (From -> Center) with Rect
    const rectInt = intersectLineRect(fromPoint, center, x, y, w, h);
    return rectInt || center; // Fallback to center if inside (shouldn't happen usually)
};

export const getDistance = (p1: Point, p2: Point) => {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
};

const distanceToSegment = (p: Point, a: Point, b: Point) => {
    const l2 = Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2);
    if (l2 === 0) return getDistance(p, a);
    let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    const proj = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
    return getDistance(p, proj);
};

// Returns 'stroke', 'fill', or null
export const hitTest = (x: number, y: number, element: ExcalidrawElement): 'stroke' | 'fill' | null => {
    const { type, x: ex, y: ey, width, height, points, strokeWidth } = element;
    const threshold = Math.max(10, strokeWidth);

    // Normalize bounds
    const nx = width < 0 ? ex + width : ex;
    const ny = height < 0 ? ey + height : ey;
    const nw = Math.abs(width);
    const nh = Math.abs(height);

    // Linear elements: stroke only
    if (type === 'arrow' || type === 'line' || type === 'freedraw') {
        if (!points || points.length < 2) return null;
        const p = { x, y };
        // Bounding box pre-check
        if (x < nx - threshold || x > nx + nw + threshold || y < ny - threshold || y > ny + nh + threshold) {
            return null;
        }
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = { x: element.x + points[i].x, y: element.y + points[i].y };
            const p2 = { x: element.x + points[i + 1].x, y: element.y + points[i + 1].y };
            if (distanceToSegment(p, p1, p2) <= threshold) return 'stroke';
        }
        return null;
    }

    // Shapes
    // Check Stroke (Border)
    let isStroke = false;
    let isFill = false;

    switch (type) {
        case "rectangle":
        case "frame": {
            const nearLeft = Math.abs(x - nx) <= threshold && y >= ny - threshold && y <= ny + nh + threshold;
            const nearRight = Math.abs(x - (nx + nw)) <= threshold && y >= ny - threshold && y <= ny + nh + threshold;
            const nearTop = Math.abs(y - ny) <= threshold && x >= nx - threshold && x <= nx + nw + threshold;
            const nearBottom = Math.abs(y - (ny + nh)) <= threshold && x >= nx - threshold && x <= nx + nw + threshold;
            isStroke = nearLeft || nearRight || nearTop || nearBottom;

            // Frame Label Special Case
            if (!isStroke && type === 'frame') {
                const labelText = element.name || "Frame";
                const estWidth = labelText.length * 8 + 20;
                const onLabel = x >= ex && x <= ex + estWidth && y >= ey - 24 && y <= ey;
                if (onLabel) isStroke = true;
            }

            isFill = x >= nx && x <= nx + nw && y >= ny && y <= ny + nh;
            break;
        }
        case "ellipse": {
            const cx = ex + width / 2;
            const cy = ey + height / 2;
            const rx = Math.abs(width / 2);
            const ry = Math.abs(height / 2);

            const dx = x - cx;
            const dy = y - cy;
            const normalizedDist = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);

            // Stroke: roughly between rx-threshold and rx+threshold
            const rx_out = rx + threshold;
            const ry_out = ry + threshold;
            const rx_in = Math.max(0, rx - threshold);
            const ry_in = Math.max(0, ry - threshold);

            const inOuter = (dx * dx) / (rx_out * rx_out) + (dy * dy) / (ry_out * ry_out) <= 1;
            const outInner = rx_in === 0 || ry_in === 0 || (dx * dx) / (rx_in * rx_in) + (dy * dy) / (ry_in * ry_in) >= 1;

            isStroke = inOuter && outInner;
            isFill = normalizedDist <= 1;
            break;
        }
        case "diamond": {
            const cx = ex + width / 2;
            const cy = ey + height / 2;
            const w = Math.abs(width / 2);
            const h = Math.abs(height / 2);

            const top = { x: cx, y: ny };
            const right = { x: nx + nw, y: cy };
            const bottom = { x: cx, y: ny + nh };
            const left = { x: nx, y: cy };
            const p = { x, y };

            isStroke = distanceToSegment(p, top, right) <= threshold ||
                distanceToSegment(p, right, bottom) <= threshold ||
                distanceToSegment(p, bottom, left) <= threshold ||
                distanceToSegment(p, left, top) <= threshold;

            isFill = (Math.abs(x - cx) / w) + (Math.abs(y - cy) / h) <= 1;
            break;
        }
        case "text":
        case "icon":
            isFill = x >= nx && x <= nx + nw && y >= ny && y <= ny + nh;
            // Text/Icon treated as solid for simplicity
            return isFill ? 'fill' : null;
    }

    if (isStroke) return 'stroke';
    if (isFill) return 'fill';
    return null;
};

// Legacy support for other files if they use it (though getElementAtPosition is the main consumer)
export const isPointNearElement = (x: number, y: number, element: ExcalidrawElement): boolean => {
    const hit = hitTest(x, y, element);
    if (!hit) return false;
    if (hit === 'stroke') return true;
    // For legacy check, assume transparent means no-hit unless solid
    return element.backgroundColor !== 'transparent';
};

export const getElementAtPosition = (
    x: number,
    y: number,
    elements: ExcalidrawElement[]
): ExcalidrawElement | null => {
    const hits: { element: ExcalidrawElement; type: 'stroke' | 'fill' }[] = [];

    // Iterate in reverse to respect Z-index
    for (let i = elements.length - 1; i >= 0; i--) {
        const element = elements[i];
        if (element.isLocked) continue; // Skip locked elements for selection
        const type = hitTest(x, y, element);
        if (type) {
            hits.push({ element, type });
        }
    }

    if (hits.length === 0) return null;

    // Priority 1: Stroke/Border hit (Always wins, top-most)
    const strokeHit = hits.find(h => h.type === 'stroke');
    if (strokeHit) return strokeHit.element;

    // Priority 2: Non-Transparent Fill hit (Top-most)
    const solidHit = hits.find(h => h.type === 'fill' && h.element.backgroundColor !== 'transparent');
    if (solidHit) return solidHit.element;

    // Priority 3: Transparent Fill hit
    // Prefer non-frame elements (allow clicking through transparent frames)
    const nonFrameHit = hits.find(h => h.element.type !== 'frame');
    if (nonFrameHit) return nonFrameHit.element;

    return hits[0].element;
};

export const getElementsWithinRect = (
    x: number,
    y: number,
    width: number,
    height: number,
    elements: ExcalidrawElement[]
): ExcalidrawElement[] => {
    const rx = width < 0 ? x + width : x;
    const ry = height < 0 ? y + height : y;
    const rw = Math.abs(width);
    const rh = Math.abs(height);

    return elements.filter((element) => {
        let ex = element.x;
        let ey = element.y;
        let ew = element.width;
        let eh = element.height;

        if (element.points) {
            const xs = element.points.map(p => p.x);
            const ys = element.points.map(p => p.y);
            ex = element.x + Math.min(...xs);
            ey = element.y + Math.min(...ys);
            ew = Math.max(...xs) - Math.min(...xs);
            eh = Math.max(...ys) - Math.min(...ys);
        }

        // Handle negative width/height elements
        if (ew < 0) { ex += ew; ew = Math.abs(ew); }
        if (eh < 0) { ey += eh; eh = Math.abs(eh); }

        return (
            rx < ex + ew &&
            rx + rw > ex &&
            ry < ey + eh &&
            ry + rh > ey
        );
    });
};

export const getSnapPoints = (element: ExcalidrawElement) => {
    const { x, y, width, height } = element;
    return [
        { x: x + width / 2, y: y, anchor: 'top' as AnchorPosition },
        { x: x + width, y: y + height / 2, anchor: 'right' as AnchorPosition },
        { x: x + width / 2, y: y + height, anchor: 'bottom' as AnchorPosition },
        { x: x, y: y + height / 2, anchor: 'left' as AnchorPosition },
    ];
};

export const getClosestSnapPoint = (x: number, y: number, element: ExcalidrawElement) => {
    const snapPoints = getSnapPoints(element);
    let closest = null;
    let minDist = Infinity;

    for (const point of snapPoints) {
        const dist = getDistance({ x, y }, point);
        if (dist < 20 && dist < minDist) {
            minDist = dist;
            closest = point;
        }
    }
    return closest;
};

export const getAnchorPosition = (element: ExcalidrawElement, anchor: AnchorPosition): Point => {
    const { x, y, width, height } = element;
    switch (anchor) {
        case 'top': return { x: x + width / 2, y: y };
        case 'right': return { x: x + width, y: y + height / 2 };
        case 'bottom': return { x: x + width / 2, y: y + height };
        case 'left': return { x: x, y: y + height / 2 };
    }
};

const simplifyPoints = (points: Point[]): Point[] => {
    if (points.length < 3) return points;
    const newPoints = [points[0]];
    for (let i = 1; i < points.length - 1; i++) {
        const prev = newPoints[newPoints.length - 1];
        const curr = points[i];
        const next = points[i + 1];

        if (Math.abs(prev.x - curr.x) < 0.5 && Math.abs(curr.x - next.x) < 0.5) continue;
        if (Math.abs(prev.y - curr.y) < 0.5 && Math.abs(curr.y - next.y) < 0.5) continue;

        newPoints.push(curr);
    }
    newPoints.push(points[points.length - 1]);
    return newPoints;
};

type RectBounds = { x: number, y: number, width: number, height: number };

export const getSmartAnchors = (
    e1: ExcalidrawElement,
    e2: ExcalidrawElement
): { start: AnchorPosition; end: AnchorPosition } => {
    const b1 = { cx: e1.x + e1.width / 2, cy: e1.y + e1.height / 2 };
    const b2 = { cx: e2.x + e2.width / 2, cy: e2.y + e2.height / 2 };

    const dx = b2.cx - b1.cx;
    const dy = b2.cy - b1.cy;
    let angle = Math.atan2(dy, dx) * (180 / Math.PI);

    if (angle >= -45 && angle <= 45) {
        return { start: 'right', end: 'left' };
    } else if (angle > 45 && angle < 135) {
        return { start: 'bottom', end: 'top' };
    } else if (angle >= 135 || angle <= -135) {
        return { start: 'left', end: 'right' };
    } else {
        return { start: 'top', end: 'bottom' };
    }
};

export const generateOrthogonalPoints = (
    start: Point,
    end: Point,
    startAnchor: AnchorPosition,
    endAnchor: AnchorPosition,
    b1: RectBounds,
    b2: RectBounds,
    padding: number = 20
): Point[] => {
    const absPoints: Point[] = [start];

    const breakout = (p: Point, anchor: AnchorPosition, pad: number): Point => {
        switch (anchor) {
            case 'top': return { x: p.x, y: p.y - pad };
            case 'bottom': return { x: p.x, y: p.y + pad };
            case 'left': return { x: p.x - pad, y: p.y };
            case 'right': return { x: p.x + pad, y: p.y };
        }
    };

    const pStart = breakout(start, startAnchor, padding);
    const pEnd = breakout(end, endAnchor, padding);

    absPoints.push(pStart);

    const isVerticalStart = startAnchor === 'top' || startAnchor === 'bottom';
    const isVerticalEnd = endAnchor === 'top' || endAnchor === 'bottom';

    if (isVerticalStart === isVerticalEnd) {
        if (startAnchor !== endAnchor) {
            if (isVerticalStart) {
                const midY = (pStart.y + pEnd.y) / 2;
                absPoints.push({ x: pStart.x, y: midY });
                absPoints.push({ x: pEnd.x, y: midY });
            } else {
                const midX = (pStart.x + pEnd.x) / 2;
                absPoints.push({ x: midX, y: pStart.y });
                absPoints.push({ x: midX, y: pEnd.y });
            }
        } else {
            if (isVerticalStart) {
                const extremY = startAnchor === 'top'
                    ? Math.min(pStart.y, pEnd.y)
                    : Math.max(pStart.y, pEnd.y);
                absPoints.push({ x: pStart.x, y: extremY });
                absPoints.push({ x: pEnd.x, y: extremY });
            } else {
                const extremX = startAnchor === 'left'
                    ? Math.min(pStart.x, pEnd.x)
                    : Math.max(pStart.x, pEnd.x);
                absPoints.push({ x: extremX, y: pStart.y });
                absPoints.push({ x: extremX, y: pEnd.y });
            }
        }
    } else {
        let corner: Point;
        if (isVerticalStart) {
            corner = { x: pEnd.x, y: pStart.y };
        } else {
            corner = { x: pStart.x, y: pEnd.y };
        }

        const validStartDir = isVerticalStart
            ? (startAnchor === 'bottom' ? corner.y >= pStart.y : corner.y <= pStart.y)
            : (startAnchor === 'right' ? corner.x >= pStart.x : corner.x <= pStart.x);

        const validEndDir = isVerticalEnd
            ? (endAnchor === 'bottom' ? corner.y >= pEnd.y : corner.y <= pEnd.y)
            : (endAnchor === 'right' ? corner.x >= pEnd.x : corner.x <= pEnd.x);

        if (validStartDir && validEndDir) {
            absPoints.push(corner);
        } else {
            if (isVerticalStart) {
                absPoints.push({ x: pStart.x, y: (pStart.y + pEnd.y) / 2 });
                absPoints.push({ x: pEnd.x, y: (pStart.y + pEnd.y) / 2 });
            } else {
                absPoints.push({ x: (pStart.x + pEnd.x) / 2, y: pStart.y });
                absPoints.push({ x: (pStart.x + pEnd.x) / 2, y: pEnd.y });
            }
        }
    }

    absPoints.push(pEnd);
    absPoints.push(end);

    const simplified = simplifyPoints(absPoints);
    return simplified.map(p => ({ x: p.x - start.x, y: p.y - start.y }));
};

export const getResizeHandles = (element: ExcalidrawElement): Record<string, Point> => {
    const { x, y, width, height, type, points } = element;

    if ((type === 'line' || type === 'arrow') && points) {
        const handles: Record<string, Point> = {};
        points.forEach((p, i) => {
            handles[`p:${i}`] = { x: x + p.x, y: y + p.y };
        });

        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];
            handles[`m:${i}`] = {
                x: x + (p1.x + p2.x) / 2,
                y: y + (p1.y + p2.y) / 2
            };
        }
        return handles;
    }

    if (type === 'text' || type === 'icon') {
        return {
            nw: { x, y },
            ne: { x: x + width, y },
            se: { x: x + width, y: y + height },
            sw: { x, y: y + height },
            e: { x: x + width, y: y + height / 2 },
            w: { x, y: y + height / 2 },
        };
    }

    return {
        nw: { x, y },
        n: { x: x + width / 2, y },
        ne: { x: x + width, y },
        e: { x: x + width, y: y + height / 2 },
        se: { x: x + width, y: y + height },
        s: { x: x + width / 2, y: y + height },
        sw: { x, y: y + height },
        w: { x, y: y + height / 2 },
    };
};

export const getResizeHandleAtPosition = (x: number, y: number, element: ExcalidrawElement, zoom: number): ResizeHandle | null => {
    const handles = getResizeHandles(element);
    const threshold = 10 / zoom;

    for (const [key, pos] of Object.entries(handles)) {
        if (getDistance({ x, y }, pos as Point) < threshold) {
            return key as ResizeHandle;
        }
    }
    return null;
};

export const getConnectorHandles = (element: ExcalidrawElement, zoom: number): Record<string, Point> => {
    const { x, y, width, height, type } = element;
    if (type === 'line' || type === 'arrow' || type === 'freedraw') return {};

    // Offset for the connector handles (outside the resize handles)
    const offset = 24 / zoom;

    return {
        n: { x: x + width / 2, y: y - offset },
        e: { x: x + width + offset, y: y + height / 2 },
        s: { x: x + width / 2, y: y + height + offset },
        w: { x: x - offset, y: y + height / 2 },
    };
};

export const getConnectorHandleAtPosition = (x: number, y: number, element: ExcalidrawElement, zoom: number): ResizeHandle | null => {
    const handles = getConnectorHandles(element, zoom);
    const threshold = 12 / zoom; // Slightly larger hit area

    for (const [key, pos] of Object.entries(handles)) {
        if (getDistance({ x, y }, pos as Point) < threshold) {
            return key as ResizeHandle;
        }
    }
    return null;
};

export const getCursorForHandle = (handle: ResizeHandle): string => {
    if (typeof handle === 'string' && (handle.startsWith('p:') || handle.startsWith('m:'))) {
        return 'move';
    }

    switch (handle) {
        case 'n':
        case 's': return 'ns-resize';
        case 'w':
        case 'e': return 'ew-resize';
        case 'nw':
        case 'se': return 'nwse-resize';
        case 'ne':
        case 'sw': return 'nesw-resize';
        default: return 'default';
    }
};

const normalizeElement = (element: ExcalidrawElement): Partial<ExcalidrawElement> => {
    if (element.points) {
        const minX = Math.min(...element.points.map(p => p.x));
        const minY = Math.min(...element.points.map(p => p.y));
        const maxX = Math.max(...element.points.map(p => p.x));
        const maxY = Math.max(...element.points.map(p => p.y));

        const newPoints = element.points.map(p => ({ x: p.x - minX, y: p.y - minY }));

        return {
            x: element.x + minX,
            y: element.y + minY,
            width: maxX - minX,
            height: maxY - minY,
            points: newPoints
        };
    }

    let { x, y, width, height } = element;
    if (width < 0) {
        x += width;
        width = Math.abs(width);
    }
    if (height < 0) {
        y += height;
        height = Math.abs(height);
    }
    return { x, y, width, height };
};

export const resizeElement = (
    handle: ResizeHandle,
    element: ExcalidrawElement,
    newPos: Point,
    keepAspectRatio: boolean = false
): Partial<ExcalidrawElement> => {

    if (element.type === 'text' || element.type === 'icon') {
        keepAspectRatio = true;
    }

    if (element.type === 'line' || element.type === 'arrow') {
        if (!element.points) return {};

        const newPoints = [...element.points];

        if (typeof handle === 'string' && handle.startsWith('p:')) {
            const index = parseInt(handle.split(':')[1]);
            if (!isNaN(index) && index >= 0 && index < newPoints.length) {
                newPoints[index] = {
                    x: newPos.x - element.x,
                    y: newPos.y - element.y
                };
            }
        }

        return normalizeElement({ ...element, points: newPoints });
    }

    const { x, y, width, height } = element;
    let nx = x;
    let ny = y;
    let nw = width;
    let nh = height;

    switch (handle) {
        case 'nw':
            nx = newPos.x;
            ny = newPos.y;
            nw = x + width - newPos.x;
            nh = y + height - newPos.y;
            break;
        case 'n':
            ny = newPos.y;
            nh = y + height - newPos.y;
            break;
        case 'ne':
            ny = newPos.y;
            nw = newPos.x - x;
            nh = y + height - newPos.y;
            break;
        case 'e':
            nw = newPos.x - x;
            break;
        case 'se':
            nw = newPos.x - x;
            nh = newPos.y - y;
            break;
        case 's':
            nh = newPos.y - y;
            break;
        case 'sw':
            nx = newPos.x;
            nw = x + width - newPos.x;
            nh = newPos.y - y;
            break;
        case 'w':
            nx = newPos.x;
            nw = x + width - newPos.x;
            break;
    }

    if (element.type === 'text') {
        // Special logic for Text Resizing
        // If resizing from E or W, update width for text wrapping, do not scale font.
        // If resizing from corners, scale font (existing logic).

        if (handle === 'e' || handle === 'w') {
            // Just update the width for wrapping
            const res = normalizeElement({ ...element, x: nx, y: ny, width: nw, height: nh });
            // Height will be auto-calculated by render/measure based on wrapping, but we store the box width
            // Recalculate height based on new width using measureText
            const metrics = measureText(element.text || "", element.fontSize || 20, element.fontFamily || 1, element.fontWeight, element.fontStyle, res.width);
            return { ...res, height: metrics.height };
        } else {
            // Standard font scaling for corners
            const absWidth = Math.abs(width);
            const absHeight = Math.abs(height);
            const ratio = absWidth / absHeight;

            if (['nw', 'ne', 'sw', 'se'].includes(handle)) {
                const newH = Math.abs(nh);
                const newW = newH * ratio;

                nw = nw < 0 ? -newW : newW;
                nh = nh < 0 ? -newH : newH;

                if (handle.includes('w')) {
                    nx = x + width - nw;
                }
                if (handle.includes('n')) {
                    ny = y + height - nh;
                }
            }

            const res = normalizeElement({ ...element, x: nx, y: ny, width: nw, height: nh });
            const scale = Math.abs(res.height!) / element.height;
            const currentFontSize = element.fontSize || 20;
            const newFontSize = Math.max(8, currentFontSize * scale);

            return { ...res, fontSize: newFontSize };
        }
    }

    if (keepAspectRatio) {
        const absWidth = Math.abs(width);
        const absHeight = Math.abs(height);
        const ratio = absWidth / absHeight;

        if (['nw', 'ne', 'sw', 'se'].includes(handle)) {
            const newH = Math.abs(nh);
            const newW = newH * ratio;

            nw = nw < 0 ? -newW : newW;
            nh = nh < 0 ? -newH : newH;

            if (handle.includes('w')) {
                nx = x + width - nw;
            }
            if (handle.includes('n')) {
                ny = y + height - nh;
            }
        }
    }

    const res = normalizeElement({ ...element, x: nx, y: ny, width: nw, height: nh });
    return res;
};
