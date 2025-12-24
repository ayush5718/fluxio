
import React from 'react';
import { ExcalidrawElement, Point, AnchorPosition, ResizeHandle } from "../types";
import { measureText } from "./renderer";

// --- Geometry Utils ---

export const getPointerPos = (e: React.MouseEvent | MouseEvent | { clientX: number, clientY: number }, pan: { x: number, y: number }, zoom: number): Point => {
    return {
        x: (e.clientX - pan.x) / zoom,
        y: (e.clientY - pan.y) / zoom
    };
};

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

const rotatePoint = (p: Point, center: Point, angle: number): Point => {
    const s = Math.sin(angle);
    const c = Math.cos(angle);
    const px = p.x - center.x;
    const py = p.y - center.y;
    return {
        x: px * c - py * s + center.x,
        y: px * s + py * c + center.y
    };
};

// Find intersection of line (p1->p2) with rectangle (x,y,w,h)
const intersectLineRect = (p1: Point, p2: Point, x: number, y: number, w: number, h: number): Point | null => {
    const minX = x, maxX = x + w, minY = y, maxY = y + h;
    const points: Point[] = [];
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
            points.push({ x: p1.x + lambda * (p2.x - p1.x), y: p1.y + lambda * (p2.y - p1.y) });
        }
    });
    if (points.length === 0) return null;
    return points.reduce((prev, curr) => getDistance(p1, prev) < getDistance(p1, curr) ? prev : curr);
};

export const getIntersectingPoint = (element: ExcalidrawElement, fromPoint: Point): Point => {
    const { x, y, w, h, cx, cy } = getElementBounds(element);
    const center = { x: cx, y: cy };
    if (element.type === 'ellipse') {
        const angle = Math.atan2(fromPoint.y - cy, fromPoint.x - cx);
        return { x: cx + (w / 2) * Math.cos(angle), y: cy + (h / 2) * Math.sin(angle) };
    }
    if (element.type === 'diamond') {
        const top = { x: cx, y: y }, right = { x: x + w, y: cy }, bottom = { x: cx, y: y + h }, left = { x: x, y: cy };
        const segments = [[top, right], [right, bottom], [bottom, left], [left, top]];
        for (const [a, b] of segments) {
            const det = (center.x - fromPoint.x) * (b.y - a.y) - (b.x - a.x) * (center.y - fromPoint.y);
            if (det === 0) continue;
            const lambda = ((b.y - a.y) * (b.x - fromPoint.x) + (a.x - b.x) * (b.y - fromPoint.y)) / det;
            const gamma = ((fromPoint.y - center.y) * (b.x - fromPoint.x) + (center.x - fromPoint.x) * (b.y - fromPoint.y)) / det;
            if (0 <= lambda && lambda <= 1 && 0 <= gamma && gamma <= 1) {
                return { x: fromPoint.x + lambda * (center.x - fromPoint.x), y: fromPoint.y + lambda * (center.y - fromPoint.y) };
            }
        }
        return center;
    }
    const rectInt = intersectLineRect(fromPoint, center, x, y, w, h);
    return rectInt || center;
};

export const getDistance = (p1: Point, p2: Point) => {
    return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
};

export const distanceToSegment = (p: Point, a: Point, b: Point) => {
    const l2 = Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2);
    if (l2 === 0) return getDistance(p, a);
    let t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    const proj = { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) };
    return getDistance(p, proj);
};

export const isPointInRadius = (p: Point, center: Point, radius: number) => {
    return getDistance(p, center) <= radius;
};

export const hitTest = (x: number, y: number, element: ExcalidrawElement): 'stroke' | 'fill' | null => {
    const { type, x: ex, y: ey, width, height, points, strokeWidth, angle = 0 } = element;
    const threshold = Math.max(10, strokeWidth);
    let px = x, py = y;
    if (angle !== 0) {
        const center = { x: ex + width / 2, y: ey + height / 2 };
        const rotated = rotatePoint({ x, y }, center, -angle);
        px = rotated.x; py = rotated.y;
    }
    const nx = width < 0 ? ex + width : ex, ny = height < 0 ? ey + height : ey, nw = Math.abs(width), nh = Math.abs(height);
    if (type === 'arrow' || type === 'line' || type === 'freedraw') {
        if (!points || points.length < 2) return null;
        if (x < nx - threshold || x > nx + nw + threshold || y < ny - threshold || y > ny + nh + threshold) return null;
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = { x: element.x + points[i].x, y: element.y + points[i].y };
            const p2 = { x: element.x + points[i + 1].x, y: element.y + points[i + 1].y };
            if (distanceToSegment({ x, y }, p1, p2) <= threshold) return 'stroke';
        }
        return null;
    }
    let isStroke = false, isFill = false;
    switch (type) {
        case "rectangle": case "frame": {
            const nearLeft = Math.abs(px - nx) <= threshold && py >= ny - threshold && py <= ny + nh + threshold;
            const nearRight = Math.abs(px - (nx + nw)) <= threshold && py >= ny - threshold && py <= ny + nh + threshold;
            const nearTop = Math.abs(py - ny) <= threshold && px >= nx - threshold && px <= nx + nw + threshold;
            const nearBottom = Math.abs(py - (ny + nh)) <= threshold && px >= nx - threshold && px <= nx + nw + threshold;
            isStroke = nearLeft || nearRight || nearTop || nearBottom;
            if (!isStroke && type === 'frame') {
                const labelText = element.name || "Frame", estWidth = labelText.length * 8 + 20;
                const onLabel = px >= ex && px <= ex + estWidth && py >= ey - 24 && py <= ey;
                if (onLabel) isStroke = true;
            }
            isFill = px >= nx && px <= nx + nw && py >= ny && py <= ny + nh;
            break;
        }
        case "ellipse": {
            const cx = ex + width / 2, cy = ey + height / 2, rx = Math.abs(width / 2), ry = Math.abs(height / 2), dx = px - cx, dy = py - cy;
            const normalizedDist = (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry);
            const rx_out = rx + threshold, ry_out = ry + threshold, rx_in = Math.max(0, rx - threshold), ry_in = Math.max(0, ry - threshold);
            isStroke = ((dx * dx) / (rx_out * rx_out) + (dy * dy) / (ry_out * ry_out) <= 1) && (rx_in === 0 || ry_in === 0 || (dx * dx) / (rx_in * rx_in) + (dy * dy) / (ry_in * ry_in) >= 1);
            isFill = normalizedDist <= 1;
            break;
        }
        case "diamond": {
            const cx = ex + width / 2, cy = ey + height / 2, w = Math.abs(width / 2), h = Math.abs(height / 2);
            const top = { x: cx, y: ny }, right = { x: nx + nw, y: cy }, bottom = { x: cx, y: ny + nh }, left = { x: nx, y: cy };
            isStroke = distanceToSegment({ x: px, y: py }, top, right) <= threshold || distanceToSegment({ x: px, y: py }, right, bottom) <= threshold || distanceToSegment({ x: px, y: py }, bottom, left) <= threshold || distanceToSegment({ x: px, y: py }, left, top) <= threshold;
            isFill = (Math.abs(px - cx) / w) + (Math.abs(py - cy) / h) <= 1;
            break;
        }
        case "text": case "icon": isFill = px >= nx && px <= nx + nw && py >= ny && py <= ny + nh; return isFill ? 'fill' : null;
    }
    return isStroke ? 'stroke' : isFill ? 'fill' : null;
};

export const isPointInElementBounds = (x: number, y: number, element: ExcalidrawElement) => {
    const { x: ex, y: ey, width, height, angle = 0 } = element;
    let px = x, py = y;
    if (angle !== 0) {
        const center = { x: ex + width / 2, y: ey + height / 2 };
        const rotated = rotatePoint({ x, y }, center, -angle);
        px = rotated.x; py = rotated.y;
    }
    const nx = width < 0 ? ex + width : ex, ny = height < 0 ? ey + height : ey, nw = Math.abs(width), nh = Math.abs(height);
    // Add a small padding for easier grabbing
    const padding = 2;
    return px >= nx - padding && px <= nx + nw + padding && py >= ny - padding && py <= ny + nh + padding;
};

export const getElementAtPosition = (x: number, y: number, elements: ExcalidrawElement[]) => {
    for (let i = elements.length - 1; i >= 0; i--) {
        const element = elements[i];
        if (element.isLocked) continue;
        const type = hitTest(x, y, element);

        // Text and icon elements should always be selectable when hit, regardless of background
        if ((element.type === 'text' || element.type === 'icon') && type === 'fill') return element;

        // Other elements
        if (type === 'stroke') return element;
        if (type === 'fill' && element.backgroundColor !== 'transparent') return element;
    }
    return null;
};

export const getElementsWithinRect = (x: number, y: number, width: number, height: number, elements: ExcalidrawElement[]) => {
    const rx = width < 0 ? x + width : x, ry = height < 0 ? y + height : y, rw = Math.abs(width), rh = Math.abs(height);
    return elements.filter(el => {
        let ex = el.x, ey = el.y, ew = el.width, eh = el.height;
        if (el.points) {
            const xs = el.points.map(p => p.x), ys = el.points.map(p => p.y);
            ex = el.x + Math.min(...xs); ey = el.y + Math.min(...ys); ew = Math.max(...xs) - Math.min(...xs); eh = Math.max(...ys) - Math.min(...ys);
        }
        if (ew < 0) { ex += ew; ew = Math.abs(ew); }
        if (eh < 0) { ey += eh; eh = Math.abs(eh); }
        return rx < ex + ew && rx + rw > ex && ry < ey + eh && ry + rh > ey;
    });
};

export const getSnapPoints = (element: ExcalidrawElement) => {
    const { x, y, width, height, angle = 0 } = element;
    const center = { x: x + width / 2, y: y + height / 2 };
    const points = [
        { x: x + width / 2, y: y, anchor: 'top' as AnchorPosition },
        { x: x + width, y: y + height / 2, anchor: 'right' as AnchorPosition },
        { x: x + width / 2, y: y + height, anchor: 'bottom' as AnchorPosition },
        { x: x, y: y + height / 2, anchor: 'left' as AnchorPosition },
    ];
    return angle === 0 ? points : points.map(p => ({ ...rotatePoint(p, center, angle), anchor: p.anchor }));
};

export const getClosestSnapPoint = (x: number, y: number, element: ExcalidrawElement) => {
    const points = getSnapPoints(element);
    let closest = null, minDist = Infinity;
    for (const p of points) {
        const d = getDistance({ x, y }, p);
        if (d < 20 && d < minDist) { minDist = d; closest = p; }
    }
    return closest;
};

export const getAnchorPosition = (element: ExcalidrawElement, anchor: AnchorPosition): Point => {
    const { x, y, width, height, angle = 0 } = element;
    const center = { x: x + width / 2, y: y + height / 2 };
    let p = { x: 0, y: 0 };
    switch (anchor) {
        case 'top': p = { x: x + width / 2, y: y }; break;
        case 'right': p = { x: x + width, y: y + height / 2 }; break;
        case 'bottom': p = { x: x + width / 2, y: y + height }; break;
        case 'left': p = { x: x, y: y + height / 2 }; break;
    }
    return angle === 0 ? p : rotatePoint(p, center, angle);
};

export const getResizeHandles = (element: ExcalidrawElement, zoom: number = 1): Record<string, Point> => {
    const { x, y, width, height, type, points, angle = 0 } = element;
    const center = { x: x + width / 2, y: y + height / 2 };
    const padding = 8 / zoom;

    if ((type === 'line' || type === 'arrow') && points) {
        const handles: Record<string, Point> = {};
        points.forEach((p, i) => handles[`p:${i}`] = { x: x + p.x, y: y + p.y });
        for (let i = 0; i < points.length - 1; i++) {
            handles[`m:${i}`] = { x: x + (points[i].x + points[i + 1].x) / 2, y: y + (points[i].y + points[i + 1].y) / 2 };
        }
        return handles;
    }

    const nx = x - padding;
    const ny = y - padding;
    const nw = width + padding * 2;
    const nh = height + padding * 2;

    const local = {
        nw: { x: nx, y: ny },
        n: { x: nx + nw / 2, y: ny },
        ne: { x: nx + nw, y: ny },
        e: { x: nx + nw, y: ny + nh / 2 },
        se: { x: nx + nw, y: ny + nh },
        s: { x: nx + nw / 2, y: ny + nh },
        sw: { x: nx, y: ny + nh },
        w: { x: nx, y: ny + nh / 2 },
        rotation: { x: nx + nw / 2, y: ny - 32 / zoom }
    };

    if (angle === 0) return local;
    const global: Record<string, Point> = {};
    for (const [k, p] of Object.entries(local)) {
        global[k] = rotatePoint(p, center, angle);
    }
    return global;
};

export const getResizeHandleAtPosition = (x: number, y: number, element: ExcalidrawElement, zoom: number): ResizeHandle | null => {
    const handles = getResizeHandles(element, zoom);
    const threshold = 12 / zoom;
    for (const [k, pos] of Object.entries(handles)) if (getDistance({ x, y }, pos) < threshold) return k as ResizeHandle;
    return null;
};

export const getConnectorHandles = (element: ExcalidrawElement, zoom: number): Record<string, Point> => {
    const { x, y, width, height, angle = 0 } = element;
    const center = { x: x + width / 2, y: y + height / 2 };
    const offset = 24 / zoom;
    const local = { n: { x: x + width / 2, y: y - offset }, e: { x: x + width + offset, y: y + height / 2 }, s: { x: x + width / 2, y: y + height + offset }, w: { x: x - offset, y: y + height / 2 } };
    if (angle === 0) return local;
    const global: Record<string, Point> = {};
    for (const [k, p] of Object.entries(local)) global[k] = rotatePoint(p, center, angle);
    return global;
};

export const getConnectorHandleAtPosition = (x: number, y: number, element: ExcalidrawElement, zoom: number): ResizeHandle | null => {
    const handles = getConnectorHandles(element, zoom);
    for (const [k, p] of Object.entries(handles)) if (getDistance({ x, y }, p) < 14 / zoom) return k as ResizeHandle;
    return null;
};

export const getCursorForHandle = (handle: ResizeHandle) => {
    if (typeof handle === 'string' && (handle.startsWith('p:') || handle.startsWith('m:'))) return 'move';
    if (handle === 'rotation') return 'crosshair';
    switch (handle) {
        case 'n': case 's': return 'ns-resize';
        case 'w': case 'e': return 'ew-resize';
        case 'nw': case 'se': return 'nwse-resize';
        case 'ne': case 'sw': return 'nesw-resize';
        default: return 'default';
    }
};

export const getSmartAnchors = (e1: ExcalidrawElement, e2: ExcalidrawElement): { start: AnchorPosition; end: AnchorPosition } => {
    const b1 = { cx: e1.x + e1.width / 2, cy: e1.y + e1.height / 2 }, b2 = { cx: e2.x + e2.width / 2, cy: e2.y + e2.height / 2 };
    const dx = b2.cx - b1.cx, dy = b2.cy - b1.cy, angle = Math.atan2(dy, dx) * (180 / Math.PI);
    if (angle >= -45 && angle <= 45) return { start: 'right', end: 'left' };
    if (angle > 45 && angle < 135) return { start: 'bottom', end: 'top' };
    if (angle >= 135 || angle <= -135) return { start: 'left', end: 'right' };
    return { start: 'top', end: 'bottom' };
};

export const simplifyPoints = (pts: Point[]) => {
    if (pts.length < 3) return pts;
    const res = [pts[0]];
    for (let i = 1; i < pts.length - 1; i++) {
        const p = res[res.length - 1], c = pts[i], n = pts[i + 1];
        if (Math.abs(p.x - c.x) < 0.5 && Math.abs(c.x - n.x) < 0.5) continue;
        if (Math.abs(p.y - c.y) < 0.5 && Math.abs(c.y - n.y) < 0.5) continue;
        res.push(c);
    }
    res.push(pts[pts.length - 1]);
    return res;
};

export const splitPathAtRadius = (element: ExcalidrawElement, eraserPos: Point, radius: number): Point[][] => {
    if (!element.points || element.points.length < 2) return [];

    const results: Point[][] = [];
    let currentPath: Point[] = [];

    for (let i = 0; i < element.points.length; i++) {
        const pAbs = { x: element.x + element.points[i].x, y: element.y + element.points[i].y };
        if (getDistance(pAbs, eraserPos) > radius) {
            currentPath.push(element.points[i]);
        } else {
            if (currentPath.length > 0) {
                results.push(currentPath);
                currentPath = [];
            }
        }
    }

    if (currentPath.length > 0) {
        results.push(currentPath);
    }

    return results.filter(p => p.length >= 2);
};

export const generateOrthogonalPoints = (start: Point, end: Point, sa: AnchorPosition, ea: AnchorPosition, b1: any, b2: any, pad: number = 20): Point[] => {
    // Tolerance for alignment detection (in pixels)
    const ALIGN_TOLERANCE = 40;

    // Check if shapes are roughly aligned - use straight line in this case
    const dx = Math.abs(end.x - start.x);
    const dy = Math.abs(end.y - start.y);

    // Horizontal alignment: start and end are on same horizontal plane
    const isHorizontallyAligned = dy < ALIGN_TOLERANCE;
    // Vertical alignment: start and end are on same vertical plane  
    const isVerticallyAligned = dx < ALIGN_TOLERANCE;

    // Direct horizontal connection (right->left or left->right)
    if (isHorizontallyAligned && ((sa === 'right' && ea === 'left') || (sa === 'left' && ea === 'right'))) {
        return [
            { x: 0, y: 0 },
            { x: end.x - start.x, y: end.y - start.y }
        ];
    }

    // Direct vertical connection (bottom->top or top->bottom)
    if (isVerticallyAligned && ((sa === 'bottom' && ea === 'top') || (sa === 'top' && ea === 'bottom'))) {
        return [
            { x: 0, y: 0 },
            { x: end.x - start.x, y: end.y - start.y }
        ];
    }

    // Otherwise use elbow routing
    const breakout = (p: Point, a: AnchorPosition, pd: number) => {
        switch (a) { case 'top': return { x: p.x, y: p.y - pd }; case 'bottom': return { x: p.x, y: p.y + pd }; case 'left': return { x: p.x - pd, y: p.y }; case 'right': return { x: p.x + pd, y: p.y }; default: return p; }
    };
    const p1 = breakout(start, sa, pad), p2 = breakout(end, ea, pad), res = [start, p1];
    const isV1 = sa === 'top' || sa === 'bottom', isV2 = ea === 'top' || ea === 'bottom';
    if (isV1 === isV2) {
        if (sa !== ea) { if (isV1) { res.push({ x: p1.x, y: (p1.y + p2.y) / 2 }, { x: p2.x, y: (p1.y + p2.y) / 2 }); } else { res.push({ x: (p1.x + p2.x) / 2, y: p1.y }, { x: (p1.x + p2.x) / 2, y: p2.y }); } }
        else { if (isV1) { const ey = sa === 'top' ? Math.min(p1.y, p2.y) : Math.max(p1.y, p2.y); res.push({ x: p1.x, y: ey }, { x: p2.x, y: ey }); } else { const ex = sa === 'left' ? Math.min(p1.x, p2.x) : Math.max(p1.x, p2.x); res.push({ x: ex, y: p1.y }, { x: ex, y: p2.y }); } }
    } else {
        const c = isV1 ? { x: p2.x, y: p1.y } : { x: p1.x, y: p2.y };
        const v1 = isV1 ? (sa === 'bottom' ? c.y >= p1.y : c.y <= p1.y) : (sa === 'right' ? c.x >= p1.x : c.x <= p1.x);
        const v2 = isV2 ? (ea === 'bottom' ? c.y >= p2.y : c.y <= p2.y) : (ea === 'right' ? c.x >= p2.x : c.x <= p2.x);
        if (v1 && v2) res.push(c);
        else { if (isV1) res.push({ x: p1.x, y: (p1.y + p2.y) / 2 }, { x: p2.x, y: (p1.y + p2.y) / 2 }); else res.push({ x: (p1.x + p2.x) / 2, y: p1.y }, { x: (p1.x + p2.x) / 2, y: p2.y }); }
    }
    res.push(p2, end);
    return simplifyPoints(res).map(p => ({ x: p.x - start.x, y: p.y - start.y }));
};

const normalizeElement = (el: ExcalidrawElement): Partial<ExcalidrawElement> => {
    if (el.points) {
        const xs = el.points.map(p => p.x), ys = el.points.map(p => p.y), mx = Math.min(...xs), my = Math.min(...ys);
        return { x: el.x + mx, y: el.y + my, width: Math.max(...xs) - mx, height: Math.max(...ys) - my, points: el.points.map(p => ({ x: p.x - mx, y: p.y - my })) };
    }
    let { x, y, width, height } = el;
    if (width < 0) { x += width; width = Math.abs(width); }
    if (height < 0) { y += height; height = Math.abs(height); }
    return { x, y, width, height };
};

export const resizeElement = (h: ResizeHandle, el: ExcalidrawElement, pos: Point, keep: boolean = false): Partial<ExcalidrawElement> => {
    if (h === 'rotation') { const c = { x: el.x + el.width / 2, y: el.y + el.height / 2 }; return { angle: Math.atan2(pos.y - c.y, pos.x - c.x) + Math.PI / 2 }; }
    if (el.type === 'line' || el.type === 'arrow') {
        if (!el.points) return {};
        const pts = [...el.points];
        if (typeof h === 'string' && h.startsWith('p:')) { const i = parseInt(h.split(':')[1]); if (!isNaN(i)) pts[i] = { x: pos.x - el.x, y: pos.y - el.y }; }
        return normalizeElement({ ...el, points: pts });
    }
    let lp = pos;
    if (el.angle) lp = rotatePoint(pos, { x: el.x + el.width / 2, y: el.y + el.height / 2 }, -el.angle);
    let { x, y, width, height } = el, nx = x, ny = y, nw = width, nh = height;
    switch (h) {
        case 'nw': nx = lp.x; ny = lp.y; nw = x + width - lp.x; nh = y + height - lp.y; break;
        case 'n': ny = lp.y; nh = y + height - lp.y; break;
        case 'ne': ny = lp.y; nw = lp.x - x; nh = y + height - lp.y; break;
        case 'e': nw = lp.x - x; break;
        case 'se': nw = lp.x - x; nh = lp.y - y; break;
        case 's': nh = lp.y - y; break;
        case 'sw': nx = lp.x; nw = x + width - lp.x; nh = lp.y - y; break;
        case 'w': nx = lp.x; nw = x + width - lp.x; break;
    }
    if (el.type === 'text') {
        if (h === 'e' || h === 'w') {
            const res = normalizeElement({ ...el, x: nx, y: ny, width: nw, height: nh });
            const m = measureText(el.text || "", el.fontSize || 20, el.fontFamily || 1, el.fontWeight, el.fontStyle, res.width);
            return { ...res, height: m.height };
        } else {
            const r = Math.abs(width) / Math.abs(height);
            if (['nw', 'ne', 'sw', 'se'].includes(h)) {
                const nH = Math.abs(nh), nW = nH * r; nw = nw < 0 ? -nW : nW; nh = nh < 0 ? -nH : nH;
                if (h.includes('w')) nx = x + width - nw; if (h.includes('n')) ny = y + height - nh;
            }
            const res = normalizeElement({ ...el, x: nx, y: ny, width: nw, height: nh });
            return { ...res, fontSize: Math.max(8, (el.fontSize || 20) * (Math.abs(res.height!) / el.height)) };
        }
    }
    if (keep || el.type === 'icon') {
        const r = Math.abs(width) / Math.abs(height);
        if (['nw', 'ne', 'sw', 'se'].includes(h)) {
            const nH = Math.abs(nh), nW = nH * r; nw = nw < 0 ? -nW : nW; nh = nh < 0 ? -nH : nH;
            if (h.includes('w')) nx = x + width - nw; if (h.includes('n')) ny = y + height - nh;
        }
    }
    return normalizeElement({ ...el, x: nx, y: ny, width: nw, height: nh });
};
