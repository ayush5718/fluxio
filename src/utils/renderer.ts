import rough from 'roughjs';
import { ExcalidrawElement, Point, ResizeHandle } from "../types";
import { getSnapPoints, getResizeHandles, getConnectorHandles } from "./geometry";

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

const drawText = (ctx: CanvasRenderingContext2D, element: ExcalidrawElement) => {
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
        ctx.fillText(line, element.x + xOffset, element.y + index * lineHeight);
    });
};

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
    backgroundColor?: string
) => {
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    if (backgroundColor && backgroundColor !== 'transparent') {
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }

    drawGrid(ctx, ctx.canvas.width, ctx.canvas.height, pan, zoom, theme, showGrid);

    if (elements.length === 0) {
        drawWelcomeScreen(ctx, ctx.canvas.width / (window.devicePixelRatio || 1), ctx.canvas.height / (window.devicePixelRatio || 1), theme);
    }
    ctx.restore();

    ctx.save(); // Main transform context
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    const rc = rough.canvas(ctx.canvas);
    const frameMap = new Map<string, ExcalidrawElement>();
    elements.forEach(el => {
        if (el.type === 'frame') frameMap.set(el.id, el);
    });

    // 1. Draw Elements
    elements.forEach(element => {
        if (editingElementId === element.id && element.type === 'text') return;

        ctx.save(); // Element transform context
        ctx.globalAlpha = element.opacity / 100;

        // Clip to frame
        if (element.frameId) {
            const frame = frameMap.get(element.frameId);
            if (frame) {
                ctx.beginPath();
                // @ts-ignore
                if (ctx.roundRect) ctx.roundRect(frame.x, frame.y, frame.width, frame.height, 8);
                else ctx.rect(frame.x, frame.y, frame.width, frame.height);
                ctx.clip();
            }
        }

        // Apply element rotation
        if (element.angle) {
            const cx = element.x + element.width / 2;
            const cy = element.y + element.height / 2;
            ctx.translate(cx, cy);
            ctx.rotate(element.angle);
            ctx.translate(-cx, -cy);
        }

        let adaptiveStrokeColor = element.strokeColor || "#000000";
        let adaptiveBackgroundColor = element.backgroundColor || "transparent";

        if (theme === 'dark') {
            if (adaptiveStrokeColor === '#000000' || adaptiveStrokeColor === 'black') adaptiveStrokeColor = '#ffffff';
            // Only adapt white background to dark gray if it was "white"
            if (adaptiveBackgroundColor === '#ffffff' || adaptiveBackgroundColor === 'white') adaptiveBackgroundColor = '#121212';
        } else {
            // In light mode, ensure white strokes are visible
            if (adaptiveStrokeColor === '#ffffff' || adaptiveStrokeColor === 'white') adaptiveStrokeColor = '#000000';
        }

        const options = {
            seed: element.seed,
            stroke: adaptiveStrokeColor,
            strokeWidth: element.strokeWidth,
            fill: adaptiveBackgroundColor !== 'transparent' ? adaptiveBackgroundColor : undefined,
            fillStyle: element.fillStyle || 'hachure',
            fillWeight: element.strokeWidth / 2,
            hachureGap: 4,
            roughness: 0.5, // Cleaner look
            bowing: 1.5,   // More organic curved lines
            strokeLineDash: element.strokeStyle === 'dashed' ? [element.strokeWidth * 4, element.strokeWidth * 4] :
                element.strokeStyle === 'dotted' ? [element.strokeWidth, element.strokeWidth * 2] : undefined
        };

        if (element.type === 'text') {
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
            drawText(ctx, element);
        } else if (element.type === 'rectangle') {
            const r = element.roundness || 0;
            if (r > 0) {
                const { x, y, width: w, height: h } = element;
                const path = `M ${x + r} ${y} L ${x + w - r} ${y} A ${r} ${r} 0 0 1 ${x + w} ${y + r} L ${x + w} ${y + h - r} A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} L ${x + r} ${y + h} A ${r} ${r} 0 0 1 ${x} ${y + h - r} L ${x} ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`;
                rc.path(path, options);
            } else {
                rc.rectangle(element.x, element.y, element.width, element.height, options);
            }
        } else if (element.type === 'frame') {
            ctx.save();
            const frameColor = "#a8a29e";
            ctx.strokeStyle = frameColor;
            ctx.lineWidth = 1;
            ctx.beginPath();
            // @ts-ignore
            if (ctx.roundRect) ctx.roundRect(element.x, element.y, element.width, element.height, 8);
            else ctx.rect(element.x, element.y, element.width, element.height);
            ctx.stroke();
            if (element.name) {
                ctx.font = `bold ${14 / zoom}px "Inter", sans-serif`;
                ctx.fillStyle = frameColor;
                ctx.fillText(element.name, element.x, element.y - (12 / zoom));
            }
            ctx.restore();
        } else if (element.type === 'ellipse') {
            rc.ellipse(element.x + element.width / 2, element.y + element.height / 2, element.width, element.height, options);
        } else if (element.type === 'diamond') {
            rc.polygon([
                [element.x + element.width / 2, element.y],
                [element.x + element.width, element.y + element.height / 2],
                [element.x + element.width / 2, element.y + element.height],
                [element.x, element.y + element.height / 2]
            ], options);
        } else if (element.type === 'arrow' || element.type === 'line') {
            if (element.points && element.points.length > 0) {
                const points = element.points.map(p => [element.x + p.x, element.y + p.y] as [number, number]);
                rc.linearPath(points, options);
                if (element.type === "arrow") {
                    const last = element.points[element.points.length - 1];
                    const prev = element.points[element.points.length - 2];
                    const arrowAngle = Math.atan2(last.y - prev.y, last.x - prev.x);
                    const headLen = Math.min(20, Math.max(10, element.strokeWidth * 4));
                    const x2 = element.x + last.x;
                    const y2 = element.y + last.y;
                    const x1 = x2 - headLen * Math.cos(arrowAngle - Math.PI / 6);
                    const y1 = y2 - headLen * Math.sin(arrowAngle - Math.PI / 6);
                    const x3 = x2 - headLen * Math.cos(arrowAngle + Math.PI / 6);
                    const y3 = y2 - headLen * Math.sin(arrowAngle + Math.PI / 6);
                    rc.linearPath([[x1, y1], [x2, y2], [x3, y3]], options);
                }
            }
        } else if (element.type === 'freedraw') {
            if (element.points && element.points.length > 0) {
                const points = element.points.map(p => [element.x + p.x, element.y + p.y] as [number, number]);
                rc.curve(points, options);
            }
        } else if (element.type === 'icon') {
            ctx.fillStyle = adaptiveStrokeColor;
            ctx.font = `${element.width}px "Inter", sans-serif`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(element.iconName || "?", element.x + element.width / 2, element.y + element.height / 2);
        }

        ctx.restore(); // Element transform context
    });

    // 2. Draw Selection Overlays
    elements.forEach(element => {
        const isSelected = selectionIds.includes(element.id);
        const isHighlighted = highlightedElementId === element.id;
        const isBeingEdited = editingElementId === element.id;

        // Skip selection UI for elements being edited
        if ((isSelected || isHighlighted) && !isBeingEdited) {
            ctx.save();
            const selectionColor = isSelected ? "#6965db" : "rgba(105, 101, 219, 0.4)";
            const handleFillColor = "#ffffff";
            ctx.strokeStyle = selectionColor;
            ctx.lineWidth = 1 / zoom;

            // 1. Draw Selection Outline
            ctx.save();
            if (element.angle) {
                const cx = element.x + element.width / 2;
                const cy = element.y + element.height / 2;
                ctx.translate(cx, cy);
                ctx.rotate(element.angle);
                ctx.translate(-cx, -cy);
            }

            const padding = 8 / zoom;
            ctx.beginPath();
            // @ts-ignore
            if (ctx.roundRect) ctx.roundRect(element.x - padding, element.y - padding, element.width + padding * 2, element.height + padding * 2, 6 / zoom);
            else ctx.rect(element.x - padding, element.y - padding, element.width + padding * 2, element.height + padding * 2);
            ctx.stroke();
            ctx.restore();

            // 2. Draw Handles for single selection
            if (isSelected && selectionIds.length === 1 && !element.isLocked) {
                const handles = getResizeHandles(element, zoom);
                const connectors = getConnectorHandles(element, zoom);
                const handleSize = 8 / zoom;

                // --- 2.1 Draw Connector Handles ---
                ctx.save();
                for (const [key, p] of Object.entries(connectors)) {
                    // Outer circle (White)
                    ctx.beginPath();
                    ctx.arc(p.x, p.y, 7 / zoom, 0, Math.PI * 2);
                    ctx.fillStyle = "#ffffff";
                    ctx.fill();

                    // Border
                    ctx.strokeStyle = selectionColor;
                    ctx.lineWidth = 1.2 / zoom;
                    ctx.stroke();

                    // Inner "+" icon
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

                // --- 2.2 Draw Resize Handles ---
                Object.entries(handles).forEach(([key, pos]) => {
                    ctx.save();
                    const hx = pos.x;
                    const hy = pos.y;

                    if (key === 'rotation') {
                        // Rotation Handle (Thin connector + empty circle)
                        const nHandle = handles['n'];
                        if (nHandle) {
                            ctx.setLineDash([4 / zoom, 4 / zoom]);
                            ctx.beginPath();
                            ctx.moveTo(nHandle.x, nHandle.y);
                            ctx.lineTo(hx, hy);
                            ctx.strokeStyle = selectionColor; // Ensure selection color
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
                            // Point or Mid-point handles
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
                            // Standard corner/side handles
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
                drawLockIcon(ctx, element.x + element.width / 2, element.y + element.height / 2, 20 / zoom);
            }
            ctx.restore();
        }
    });

    // 3. Highlight Snap Points
    if (highlightedElementId && showSnapPoints) {
        const element = elements.find(el => el.id === highlightedElementId);
        if (element && !element.isLocked && !selectionIds.includes(element.id)) {
            const snapPoints = getSnapPoints(element);
            ctx.save();
            ctx.fillStyle = "#a855f7";
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 2 / zoom;
            snapPoints.forEach(p => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 5 / zoom, 0, 2 * Math.PI);
                ctx.fill();
                ctx.stroke();
            });
            ctx.restore();
        }
    }

    // 4. Selection Box (Multi-select)
    if (selectionBox) {
        ctx.save();
        ctx.fillStyle = "rgba(139, 92, 246, 0.1)";
        ctx.strokeStyle = "#6965db";
        ctx.lineWidth = 1 / zoom;
        ctx.fillRect(selectionBox.x, selectionBox.y, selectionBox.width, selectionBox.height);
        ctx.strokeRect(selectionBox.x, selectionBox.y, selectionBox.width, selectionBox.height);
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

    ctx.restore(); // Main transform context
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
        options.exportBackground ? options.viewBackgroundColor : 'transparent'
    );

    return canvas;
};
