import React, { useEffect, useRef } from 'react';
import rough from 'roughjs';
import { getStroke } from 'perfect-freehand';
import { ExcalidrawElement, Point, ResizeHandle, AppState } from "../types";
import { getSnapPoints, getResizeHandles, getConnectorHandles, getAnchorPosition, getSmartAnchors, generateOrthogonalPoints } from "./geometry";

export const getFontFamilyString = (fontFamily?: number) => {
    switch (fontFamily) {
        case 2: return '"Inter", sans-serif';
        case 3: return '"JetBrains Mono", monospace';
        default: return '"Kalam", cursive';
    }
};

export const getFontString = ({ fontSize, fontFamily, fontWeight, fontStyle }: { fontSize: number, fontFamily: number, fontWeight?: number, fontStyle?: string }) => {
    const family = getFontFamilyString(fontFamily);
    const style = fontStyle || 'normal';
    const weight = fontWeight || 400;
    return `${style} ${weight} ${fontSize}px ${family}`;
};

export const wrapText = (text: string, font: string, maxWidth?: number) => {
    if (!maxWidth || maxWidth < 20) return text.split('\n');

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return text.split('\n');
    ctx.font = font;

    const lines: string[] = [];
    const paragraphs = text.split('\n');

    for (const paragraph of paragraphs) {
        if (paragraph.trim() === '') {
            lines.push('');
            continue;
        }

        const words = paragraph.split(' ');
        let currentLine = words[0];

        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = ctx.measureText(currentLine + " " + word).width;
            if (width < maxWidth) {
                currentLine += " " + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        lines.push(currentLine);
    }
    return lines;
};

export const measureText = (text: string, fontSize: number, fontFamily: number, fontWeight?: number, fontStyle?: string, maxWidth?: number) => {
    const font = getFontString({ fontSize, fontFamily, fontWeight, fontStyle });
    const lines = wrapText(text, font, maxWidth);

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return { width: 0, height: 0, actualWidth: 0 };
    ctx.font = font;

    let calculatedWidth = 0;
    lines.forEach(line => {
        calculatedWidth = Math.max(calculatedWidth, ctx.measureText(line).width);
    });

    const lineHeight = fontSize * 1.25;
    const height = lines.length * lineHeight;

    return { width: maxWidth || calculatedWidth, height, actualWidth: calculatedWidth };
};

const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number, pan: { x: number, y: number }, zoom: number, theme: 'light' | 'dark', showGrid: boolean) => {
    if (!showGrid) return;
    const gridSize = 20 * zoom;
    const offsetX = pan.x % gridSize;
    const offsetY = pan.y % gridSize;

    ctx.save();
    ctx.fillStyle = theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)';

    for (let x = offsetX; x < width; x += gridSize) {
        for (let y = offsetY; y < height; y += gridSize) {
            ctx.beginPath();
            ctx.arc(x, y, 0.5, 0, 2 * Math.PI);
            ctx.fill();
        }
    }
    ctx.restore();
};

const drawLockIcon = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#ef4444";
    const w = size;
    const h = size * 0.8;
    ctx.fillRect(-w / 2, -h / 2 + h * 0.3, w, h * 0.7);
    ctx.beginPath();
    ctx.arc(0, -h / 2 + h * 0.3, w * 0.3, Math.PI, 0);
    ctx.lineWidth = w * 0.15;
    ctx.strokeStyle = "#ef4444";
    ctx.stroke();
    ctx.restore();
};

const drawWelcomeScreen = (ctx: CanvasRenderingContext2D, width: number, height: number, theme: 'light' | 'dark') => {
    ctx.save();
    const isDark = theme === 'dark';
    const primaryColor = isDark ? '#a78bfa' : '#6965db';
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const hintColor = isDark ? '#cbd5e1' : '#475569';

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.font = 'bold 80px "Kalam", cursive';
    ctx.fillStyle = primaryColor;
    ctx.fillText("FLUXIO", width / 2, height / 2 - 80);

    ctx.font = '24px "Kalam", cursive';
    ctx.fillStyle = textColor;
    ctx.fillText("AI-Enhanced Virtual Whiteboard", width / 2, height / 2 - 10);
    ctx.fillText("Your data is saved locally in your browser.", width / 2, height / 2 + 25);

    ctx.font = '16px "Inter", sans-serif';
    ctx.fillStyle = hintColor;

    let infoY = height / 2 + 100;
    const spacing = 28;
    const infoLines = [
        "Pick a tool from the top toolbar to start drawing.",
        "Use the menu (top-right) for background & dark mode.",
        "Need help? Click the question mark at the bottom-right."
    ];

    infoLines.forEach(line => {
        ctx.fillText(line, width / 2, infoY);
        infoY += spacing;
    });
    ctx.restore();
};

const drawText = (ctx: CanvasRenderingContext2D, element: ExcalidrawElement, x: number, y: number) => {
    const fontSize = element.fontSize || 20;
    const font = getFontString({
        fontSize,
        fontFamily: element.fontFamily || 1,
        fontWeight: element.fontWeight,
        fontStyle: element.fontStyle
    });
    ctx.font = font;
    ctx.fillStyle = element.strokeColor;
    ctx.textBaseline = "top";

    const lines = wrapText(element.text || "", font, element.width);
    const lineHeight = fontSize * 1.25;

    lines.forEach((line, index) => {
        const lineWidth = ctx.measureText(line).width;
        let xOffset = 0;
        if (element.textAlign === 'center') xOffset = (element.width - lineWidth) / 2;
        else if (element.textAlign === 'right') xOffset = element.width - lineWidth;
        ctx.fillText(line, x + xOffset, y + index * lineHeight);
    });
};

// Cache for RoughJS drawables to avoid recalculating geometry on every frame
const drawableCache = new Map<string, any>();

const getEraserOptions = (element: ExcalidrawElement) => {
    return {
        seed: element.seed,
        stroke: "#000000",
        strokeWidth: element.strokeWidth,
        roughness: element.roughness ?? 0.5,
        bowing: 1.5,
    };
};

const getSvgPathFromStroke = (stroke: number[][]) => {
    if (!stroke.length) return "";
    const d = stroke.reduce(
        (acc, [x0, y0], i, arr) => {
            const [x1, y1] = arr[(i + 1) % arr.length];
            acc.push(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
            return acc;
        },
        ["M", ...stroke[0], "Q"]
    );
    d.push("Z");
    return d.join(" ");
};

const getElementDrawable = (rc: any, element: ExcalidrawElement, options: any) => {
    // Create a stable cache key based on geometry and visual properties
    let key = `${element.type}-${element.seed}-${element.width}-${element.height}-${element.strokeWidth}-${element.strokeStyle}-${element.fillStyle}-${element.roughness}-${options.stroke}-${options.fill}`;

    // For path-based elements, include points in the key
    if (element.points && element.points.length > 0) {
        // Just Use first, middle, last and length for quick hashing
        const len = element.points.length;
        const mid = element.points[Math.floor(len / 2)];
        const last = element.points[len - 1];
        key += `-${len}-${element.points[0].x},${element.points[0].y}-${mid.x},${mid.y}-${last.x},${last.y}`;
    }

    if (drawableCache.has(key)) return drawableCache.get(key);

    let drawable: any = null;
    if (element.type === 'rectangle') {
        const r = element.roundness || 0;
        if (r > 0) {
            const { x, y, width: w, height: h } = element;
            const path = `M ${r} 0 L ${w - r} 0 A ${r} ${r} 0 0 1 ${w} ${r} L ${w} ${h - r} A ${r} ${r} 0 0 1 ${w - r} ${h} L ${r} ${h} A ${r} ${r} 0 0 1 0 ${h - r} L 0 ${r} A ${r} ${r} 0 0 1 ${r} 0 Z`;
            drawable = rc.generator.path(path, options);
        } else {
            drawable = rc.generator.rectangle(0, 0, element.width, element.height, options);
        }
    } else if (element.type === 'ellipse') {
        drawable = rc.generator.ellipse(element.width / 2, element.height / 2, element.width, element.height, options);
    } else if (element.type === 'diamond') {
        drawable = rc.generator.polygon([
            [element.width / 2, 0],
            [element.width, element.height / 2],
            [element.width / 2, element.height],
            [0, element.height / 2]
        ], options);
    } else if (element.type === 'arrow' || element.type === 'line') {
        if (element.points && element.points.length > 0) {
            const points = element.points.map(p => [p.x, p.y] as [number, number]);
            drawable = [rc.generator.linearPath(points, options)];
            if (element.type === "arrow") {
                const last = element.points[element.points.length - 1];
                const prev = element.points[element.points.length - 2] || { x: 0, y: 0 };
                const arrowAngle = Math.atan2(last.y - prev.y, last.x - prev.x);
                const headLen = Math.min(20, Math.max(10, element.strokeWidth * 4));
                const x2 = last.x;
                const y2 = last.y;
                const x1 = x2 - headLen * Math.cos(arrowAngle - Math.PI / 6);
                const y1 = y2 - headLen * Math.sin(arrowAngle - Math.PI / 6);
                const x3 = x2 - headLen * Math.cos(arrowAngle + Math.PI / 6);
                const y3 = y2 - headLen * Math.sin(arrowAngle + Math.PI / 6);
                drawable.push(rc.generator.linearPath([[x1, y1], [x2, y2], [x3, y3]], options));
            }
        }
    } else if (element.type === 'freedraw') {
        if (element.points && element.points.length > 0) {
            const stroke = getStroke(element.points.map(p => [p.x, p.y, p.pressure ?? 0.5]), {
                size: element.strokeWidth * 2,
                thinning: 0.5,
                smoothing: 0.5,
                streamline: 0.5,
                simulatePressure: element.simulatePressure ?? true,
            });
            const pathData = getSvgPathFromStroke(stroke);
            drawable = rc.generator.path(pathData, {
                ...options,
                fill: options.stroke, // Freedraw is a polygon now
                fillStyle: 'solid'
            });
        }
    }

    if (drawable) drawableCache.set(key, drawable);
    return drawable;
};

const drawElements = (
    ctx: CanvasRenderingContext2D,
    rc: any,
    elements: ExcalidrawElement[],
    theme: 'light' | 'dark',
    pendingDeletionIds: string[] = [],
    editingElementId: string | null = null,
    skipIds: string[] = [],
    draggingOffset?: { x: number, y: number },
    movingIds?: Set<string>
) => {
    const frameMap = new Map<string, ExcalidrawElement>();
    const pendingSet = new Set(pendingDeletionIds);
    const skipSet = new Set(skipIds);
    const movers = movingIds || new Set<string>();

    elements.forEach(el => {
        if (el.type === 'frame') frameMap.set(el.id, el);
    });

    elements.forEach(element => {
        if (skipSet.has(element.id)) return;

        const isPendingDeletion = pendingSet.has(element.id);
        const isMoving = movers.has(element.id);
        ctx.save();

        if (isPendingDeletion) {
            ctx.globalAlpha = 0.3;
            // Red tint for elements about to be deleted
        } else {
            ctx.globalAlpha = element.opacity / 100;
        }

        // Clip to frame
        // Apply dragging offset if moving
        let elementX = element.x;
        let elementY = element.y;
        if (isMoving && draggingOffset) {
            elementX += draggingOffset.x;
            elementY += draggingOffset.y;
        }

        // Clip to frame
        if (element.frameId) {
            const frame = frameMap.get(element.frameId);
            if (frame) {
                // Adjust frame clip if frame itself is moving
                let fx = frame.x;
                let fy = frame.y;
                if (movers.has(frame.id) && draggingOffset) {
                    fx += draggingOffset.x;
                    fy += draggingOffset.y;
                }

                ctx.beginPath();
                // @ts-ignore
                if (ctx.roundRect) ctx.roundRect(fx, fy, frame.width, frame.height, 8);
                else ctx.rect(fx, fy, frame.width, frame.height);
                ctx.clip();
            }
        }

        // Apply element rotation
        if (element.angle) {
            const cx = elementX + element.width / 2;
            const cy = elementY + element.height / 2;
            ctx.translate(cx, cy);
            ctx.rotate(element.angle);
            ctx.translate(-cx, -cy);
        }

        let adaptiveStrokeColor = element.strokeColor || "#000000";
        let adaptiveBackgroundColor = element.backgroundColor || "transparent";

        if (theme === 'dark') {
            if (adaptiveStrokeColor === '#000000' || adaptiveStrokeColor === 'black') adaptiveStrokeColor = '#ffffff';
            if (adaptiveBackgroundColor === '#ffffff' || adaptiveBackgroundColor === 'white') adaptiveBackgroundColor = '#121212';
        } else {
            if (adaptiveStrokeColor === '#ffffff' || adaptiveStrokeColor === 'white') adaptiveStrokeColor = '#000000';
        }

        const options = {
            seed: element.seed,
            stroke: isPendingDeletion ? "#ef4444" : adaptiveStrokeColor,
            strokeWidth: element.strokeWidth,
            fill: isPendingDeletion ? "#fee2e2" : (adaptiveBackgroundColor !== 'transparent' ? adaptiveBackgroundColor : undefined),
            fillStyle: element.fillStyle || 'hachure',
            fillWeight: element.strokeWidth / 2,
            hachureGap: 4,
            roughness: element.roughness ?? 0.5,
            bowing: 1.5,
            strokeLineDash: element.strokeStyle === 'dashed' ? [element.strokeWidth * 4, element.strokeWidth * 4] :
                element.strokeStyle === 'dotted' ? [element.strokeWidth, element.strokeWidth * 2] : undefined
        };

        if (element.type === 'text') {
            // Always render text, even if it's being edited (textarea overlay handles editing)
            // The textarea will be on top, but text should still be visible when not editing
            ctx.setLineDash([]);
            ctx.textBaseline = "top";
            ctx.fillStyle = adaptiveStrokeColor;
            const fontSize = element.fontSize || 20;
            const font = getFontString({
                fontSize,
                fontFamily: element.fontFamily || 1,
                fontWeight: element.fontWeight,
                fontStyle: element.fontStyle
            });
            ctx.font = font;
            drawText(ctx, element, elementX, elementY);
        } else if (element.type === 'frame') {
            ctx.save();
            const frameColor = "#a8a29e";
            ctx.strokeStyle = frameColor;
            ctx.lineWidth = 1;
            ctx.beginPath();
            // @ts-ignore
            if (ctx.roundRect) ctx.roundRect(elementX, elementY, element.width, element.height, 8);
            else ctx.rect(elementX, elementY, element.width, element.height);
            ctx.stroke();
            if (element.name) {
                ctx.font = `bold 14px "Inter", sans-serif`;
                ctx.fillStyle = frameColor;
                ctx.fillText(element.name, elementX, elementY - 12);
            }
            ctx.restore();
        } else if (element.type === 'icon') {
            ctx.fillStyle = adaptiveStrokeColor;
            ctx.font = `${element.width}px "Inter", sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(element.iconName || "?", elementX + element.width / 2, elementY + element.height / 2);
        } else {
            // Shapes with RoughJS drawable caching
            const drawable = getElementDrawable(rc, element, options);
            if (drawable) {
                ctx.save();
                ctx.translate(elementX, elementY);
                if (Array.isArray(drawable)) {
                    drawable.forEach(d => rc.draw(d));
                } else {
                    rc.draw(drawable);
                }
                ctx.restore();
            }
        }
        ctx.restore();
    });
};

export const renderStaticScene = (
    ctx: CanvasRenderingContext2D,
    elements: ExcalidrawElement[],
    pan: { x: number; y: number },
    zoom: number,
    theme: 'light' | 'dark' = 'light',
    showGrid: boolean = true,
    backgroundColor?: string,
    skipIds: string[] = [] // Support movement layering
) => {
    const dpr = window.devicePixelRatio || 1;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    if (backgroundColor && backgroundColor !== 'transparent') {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }

    drawGrid(ctx, ctx.canvas.width, ctx.canvas.height, pan, zoom, theme, showGrid);

    if (elements.length === 0) {
        drawWelcomeScreen(ctx, ctx.canvas.width / dpr, ctx.canvas.height / dpr, theme);
    }

    // Apply DPR, then pan and zoom
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(Math.round(pan.x), Math.round(pan.y));
    ctx.scale(zoom, zoom);

    const rc = rough.canvas(ctx.canvas);
    drawElements(ctx, rc, elements, theme, [], null, skipIds);

    ctx.restore();
};

export const renderDynamicScene = (
    ctx: CanvasRenderingContext2D,
    elements: ExcalidrawElement[],
    tempElement: ExcalidrawElement | null,
    appState: AppState,
    theme: 'light' | 'dark' = 'light',
    highlightedElementId: string | null = null,
    laserTrails: { x: number; y: number; time: number }[][] = [],
    eraserTrail: { x: number, y: number }[] = [],
    cursorPos: Point | null = null,
    roughCanvas?: any,
    draggingOffsetOverride?: { x: number, y: number },
    resizingElementOverride?: ExcalidrawElement | null
) => {
    const { pan, zoom, selectionBox, editingElementId, pendingDeletionIds } = appState;
    const effectiveDraggingOffset = draggingOffsetOverride || appState.draggingOffset;
    const rc = roughCanvas || rough.canvas(ctx.canvas);
    // Note: selectionIds doesn't exist on AppState in previous view, it was selectedElementIds.
    // Let's use the actual names from types.ts.
    const selIds = appState.selectedElementIds || [];

    const dpr = window.devicePixelRatio || 1;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    const movers = new Set<string>();
    const affectedConnectors = new Set<string>();
    const pendingSet = new Set(pendingDeletionIds);

    // If we are dragging, resizing or editing, we need to show previews
    if (effectiveDraggingOffset || appState.isDragging || resizingElementOverride || editingElementId) {
        selIds.forEach(id => movers.add(id));
        if (resizingElementOverride) movers.add(resizingElementOverride.id);
        if (editingElementId) movers.add(editingElementId);

        // One pass to find inheritance and connectors
        elements.forEach(el => {
            if (el.type !== 'frame' && el.frameId && movers.has(el.frameId) && !el.isLocked) {
                movers.add(el.id);
            }
        });

        // Another pass for affected connectors only
        elements.forEach(el => {
            if (el.type === 'arrow' || el.type === 'line') {
                const isAffected = (el.startBinding && movers.has(el.startBinding.elementId)) ||
                    (el.endBinding && movers.has(el.endBinding.elementId));
                if (isAffected && !movers.has(el.id)) affectedConnectors.add(el.id);
            }
        });
    }

    // 2. Draw Scene with Optimized Pass
    // Apply transformations
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(Math.round(pan.x), Math.round(pan.y));
    ctx.scale(zoom, zoom);

    // Draw all active previews (movers, connectors, pending deletions)
    const itemsToDrawPreview = elements.map(el => {
        if (resizingElementOverride && el.id === resizingElementOverride.id) return resizingElementOverride;
        return el;
    }).filter(el => movers.has(el.id) || affectedConnectors.has(el.id) || pendingSet.has(el.id));

    // For affected connectors that aren't movers, we still need a "light" recalculation
    // But we'll do it inside drawElements or a specialized pass
    drawElements(
        ctx,
        rc,
        itemsToDrawPreview,
        theme,
        pendingDeletionIds,
        editingElementId,
        [],
        effectiveDraggingOffset || undefined,
        movers
    );

    if (tempElement) {
        drawElements(ctx, rc, [tempElement], theme, [], editingElementId);
    }

    // 2. Draw Selection Overlays
    elements.forEach(element => {
        let displayElement = element;
        if (resizingElementOverride && element.id === resizingElementOverride.id) {
            displayElement = resizingElementOverride;
        }

        const isSelected = selIds.includes(displayElement.id);
        const isHighlighted = highlightedElementId === displayElement.id;
        const isBeingEdited = editingElementId === displayElement.id;

        // Only show full selection UI for selected elements, subtle border for hover
        if (isSelected && !isBeingEdited) {
            ctx.save();

            // Apply dragging offset to overlays if element is being dragged
            let elementX = displayElement.x;
            let elementY = displayElement.y;
            if (effectiveDraggingOffset && !displayElement.isLocked) {
                elementX = Math.round(elementX + effectiveDraggingOffset.x);
                elementY = Math.round(elementY + effectiveDraggingOffset.y);
            }

            const selectionColor = "#6965db";
            const handleFillColor = "#ffffff";
            ctx.strokeStyle = selectionColor;
            ctx.lineWidth = 1 / zoom;

            ctx.save();
            if (displayElement.angle) {
                const cx = Math.round(elementX + displayElement.width / 2);
                const cy = Math.round(elementY + displayElement.height / 2);
                ctx.translate(cx, cy);
                ctx.rotate(displayElement.angle);
                ctx.translate(-cx, -cy);
            }

            const padding = 8 / zoom;
            ctx.beginPath();
            // @ts-ignore
            if (ctx.roundRect) ctx.roundRect(elementX - padding, elementY - padding, displayElement.width + padding * 2, displayElement.height + padding * 2, 6 / zoom);
            else ctx.rect(elementX - padding, elementY - padding, displayElement.width + padding * 2, displayElement.height + padding * 2);
            ctx.stroke();
            ctx.restore();

            if (selIds.length === 1 && !displayElement.isLocked) {
                // Create a temporary element with shifted coordinates for handle calculations
                const proxyEl = { ...displayElement, x: elementX, y: elementY };
                const handles = getResizeHandles(proxyEl, zoom);
                const connectors = getConnectorHandles(proxyEl, zoom);
                const handleSize = 8 / zoom;

                ctx.save();
                for (const [key, p] of Object.entries(connectors)) {
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 7 / zoom, 0, Math.PI * 2);
                    ctx.fillStyle = "#ffffff";
                    ctx.fill();
                    ctx.strokeStyle = selectionColor;
                    ctx.lineWidth = 1.2 / zoom;
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.strokeStyle = selectionColor;
                    ctx.lineWidth = 1 / zoom;
                    const s = 3.5 / zoom;
                    ctx.moveTo(p.x - s, p.y);
                    ctx.lineTo(p.x + s, p.y);
                    ctx.moveTo(p.x, p.y - s);
                    ctx.lineTo(p.x, p.y + s);
                    ctx.stroke();
                }
                ctx.restore();

                Object.entries(handles).forEach(([key, pos]) => {
                    ctx.save();
                    const hx = pos.x;
                    const hy = pos.y;

                    if (key === 'rotation') {
                        const nHandle = handles['n'];
                        if (nHandle) {
                            ctx.setLineDash([4 / zoom, 4 / zoom]);
                            ctx.beginPath();
                            ctx.moveTo(nHandle.x, nHandle.y);
                            ctx.lineTo(hx, hy);
                            ctx.strokeStyle = selectionColor;
                            ctx.globalAlpha = 0.5;
                            ctx.stroke();
                        }
                        ctx.beginPath();
                        ctx.fillStyle = handleFillColor;
                        ctx.strokeStyle = selectionColor;
                        ctx.lineWidth = 1 / zoom;
                        ctx.globalAlpha = 1.0;
                        ctx.arc(hx, hy, handleSize / 2, 0, 2 * Math.PI);
                        ctx.fill();
                        ctx.stroke();
                    } else {
                        if (key.startsWith('p:') || key.startsWith('m:')) {
                            const isMid = key.startsWith('m:');
                            ctx.beginPath();
                            if (isMid) {
                                ctx.fillStyle = selectionColor;
                                ctx.globalAlpha = 0.5;
                                ctx.arc(hx, hy, handleSize / 2.5, 0, 2 * Math.PI);
                                ctx.fill();
                            } else {
                                ctx.fillStyle = handleFillColor;
                                ctx.strokeStyle = selectionColor;
                                ctx.lineWidth = 1 / zoom;
                                ctx.arc(hx, hy, handleSize / 1.8, 0, 2 * Math.PI);
                                ctx.fill();
                                ctx.stroke();
                            }
                        } else {
                            ctx.fillStyle = handleFillColor;
                            ctx.strokeStyle = selectionColor;
                            ctx.lineWidth = 1 / zoom;
                            const hs = handleSize;
                            // @ts-ignore
                            if (ctx.roundRect) {
                                ctx.beginPath();
                                ctx.roundRect(hx - hs / 2, hy - hs / 2, hs, hs, 2 / zoom);
                                ctx.fill();
                                ctx.stroke();
                            } else {
                                ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
                                ctx.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs);
                            }
                        }
                    }
                    ctx.restore();
                });
            }

            if (element.isLocked) {
                drawLockIcon(ctx, elementX + element.width / 2, elementY + element.height / 2, 20 / zoom);
            }

            ctx.restore();
        } else if (isHighlighted && !isSelected && !isBeingEdited && appState.tool === 'selection') {
            // Subtle hover feedback - just a thin border, no handles
            ctx.save();
            const padding = 4 / zoom;
            ctx.strokeStyle = "rgba(105, 101, 219, 0.3)";
            ctx.lineWidth = 1 / zoom;
            ctx.setLineDash([3 / zoom, 3 / zoom]);
            ctx.beginPath();
            // @ts-ignore
            if (ctx.roundRect) ctx.roundRect(element.x - padding, element.y - padding, element.width + padding * 2, element.height + padding * 2, 4 / zoom);
            else ctx.rect(element.x - padding, element.y - padding, element.width + padding * 2, element.height + padding * 2);
            ctx.stroke();
            ctx.restore();
        } else if (isHighlighted && !isSelected && !isBeingEdited && (appState.tool === 'arrow' || appState.tool === 'line')) {
            // Draw snap points for highlighted elements (during arrow/line drawing)
            const snapPoints = getSnapPoints(element);
            ctx.save();
            snapPoints.forEach(sp => {
                ctx.beginPath();
                ctx.arc(sp.x, sp.y, 6 / zoom, 0, Math.PI * 2);
                ctx.fillStyle = '#6965db';
                ctx.globalAlpha = 0.8;
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5 / zoom;
                ctx.stroke();
            });
            ctx.restore();
        }
    });

    // 3. Selection Box (Marquee)
    if (selectionBox) {
        ctx.save();
        ctx.fillStyle = "rgba(105, 101, 219, 0.05)";
        ctx.strokeStyle = "#6965db";
        ctx.setLineDash([5 / zoom, 5 / zoom]);
        ctx.lineWidth = 1 / zoom;
        ctx.beginPath();
        ctx.rect(selectionBox.x, selectionBox.y, selectionBox.width, selectionBox.height);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    // 4. Eraser Trail (Soft Red/Pink)
    if (eraserTrail.length > 2) {
        ctx.save();
        ctx.beginPath();
        const baseWidth = 8 / zoom;
        ctx.fillStyle = "rgba(255, 0, 89, 0.2)";
        for (let i = 0; i < eraserTrail.length - 1; i++) {
            const p1 = eraserTrail[i];
            const p2 = eraserTrail[i + 1];
            const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
            if (dist < 0.1) continue;
            const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            const progress = i / eraserTrail.length;
            const taper = Math.sin(progress * Math.PI);
            const w = baseWidth * taper;
            const dx = Math.cos(angle + Math.PI / 2) * w;
            const dy = Math.sin(angle + Math.PI / 2) * w;
            if (i === 0) ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p1.x + dx, p1.y + dy);
        }
        for (let i = eraserTrail.length - 1; i >= 0; i--) {
            const p1 = eraserTrail[i];
            const p2 = eraserTrail[Math.max(0, i - 1)];
            const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            const progress = i / eraserTrail.length;
            const taper = Math.sin(progress * Math.PI);
            const w = baseWidth * taper;
            const dx = Math.cos(angle + Math.PI / 2) * w;
            const dy = Math.sin(angle + Math.PI / 2) * w;
            ctx.lineTo(p1.x - dx, p1.y - dy);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    }

    // 5. Laser Trails
    if (laserTrails.length > 0) {
        const now = Date.now();
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        laserTrails.forEach(trail => {
            if (trail.length < 2) return;
            for (let i = 1; i < trail.length; i++) {
                const age = now - trail[i].time;
                const opacity = Math.max(0, 1 - age / 1000);
                if (opacity <= 0) continue;
                ctx.beginPath();
                ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
                ctx.lineTo(trail[i].x, trail[i].y);
                ctx.strokeStyle = `rgba(220, 38, 38, ${opacity})`;
                ctx.lineWidth = 4 / zoom;
                ctx.stroke();
            }
        });
        ctx.restore();
    }

    // 6. Eraser Cursor
    if (appState.tool === 'eraser' && cursorPos) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(cursorPos.x, cursorPos.y, 4 / zoom, 0, Math.PI * 2);
        ctx.strokeStyle = theme === 'dark' ? '#ffffff' : '#000000';
        ctx.lineWidth = 1 / zoom;
        ctx.stroke();
        ctx.restore();
    }

    ctx.restore();
};

// Keep existing helper (might need update later)
export const renderScene = (
    ctx: CanvasRenderingContext2D,
    elements: ExcalidrawElement[],
    pan: { x: number; y: number },
    zoom: number,
    selectionIds: string[] = [],
    highlightedElementId: string | null = null,
    selectionBox: { x: number; y: number; width: number; height: number } | null = null,
    laserTrails: { x: number; y: number; time: number }[][] = [],
    editingElementId: string | null = null,
    showSnapPoints: boolean = false,
    theme: 'light' | 'dark' = 'light',
    showGrid: boolean = true,
    padding: number = 0,
    backgroundColor?: string,
    eraserTrail: { x: number, y: number }[] = [],
    eraserSize: number = 20,
    cursorPos: Point | null = null,
    tool: string = "",
    pendingDeletionIds: string[] = []
) => {
    // Legacy support for exportToCanvas
    renderStaticScene(ctx, elements, pan, zoom, theme, showGrid, backgroundColor);
    // This is not perfect as it doesn't draw overlays, but for export it's usually what we want.
};

export const exportToCanvas = (
    elements: ExcalidrawElement[],
    options: {
        exportBackground: boolean;
        viewBackgroundColor: string;
        exportPadding?: number;
        theme?: 'light' | 'dark';
    }
): HTMLCanvasElement => {
    const padding = options.exportPadding || 20;

    // Calculate bounding box of all elements
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    elements.forEach(el => {
        minX = Math.min(minX, el.x);
        minY = Math.min(minY, el.y);
        maxX = Math.max(maxX, el.x + el.width);
        maxY = Math.max(maxY, el.y + el.height);
    });

    const width = maxX - minX + padding * 2;
    const height = maxY - minY + padding * 2;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return canvas;

    renderScene(
        ctx,
        elements,
        { x: -minX + padding, y: -minY + padding },
        1, // Zoom 1 for export
        [], // No selection ids
        null, // No highlighted id
        null, // No selection box
        [], // No laser trails
        null, // No editing id
        false, // No snap points
        options.theme || 'light',
        false, // No grid
        0,
        options.exportBackground ? options.viewBackgroundColor : 'transparent',
        [], // eraserTrail
        20, // eraserSize
        null, // cursorPos
        "" // tool
    );

    return canvas;
};
