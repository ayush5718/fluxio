
import { ExcalidrawElement, Point, ResizeHandle } from "../types";
import { getSnapPoints, getResizeHandles } from "./geometry";

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

/**
 * Splits text into lines based on maxWidth.
 * If maxWidth is not provided or 0, returns the original lines.
 */
export const wrapText = (text: string, font: string, maxWidth?: number) => {
    // If maxWidth is too small (e.g. newly created text), don't wrap tightly
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

    // Line height multiplier
    const lineHeight = fontSize * 1.25;
    const height = lines.length * lineHeight;

    // If maxWidth is provided, use it as width, otherwise use actual width
    return { width: maxWidth || calculatedWidth, height, actualWidth: calculatedWidth };
};

const drawGrid = (ctx: CanvasRenderingContext2D, width: number, height: number, pan: { x: number, y: number }, zoom: number) => {
    const gridSize = 20 * zoom;
    const offsetX = pan.x % gridSize;
    const offsetY = pan.y % gridSize;

    ctx.save();
    ctx.fillStyle = document.documentElement.classList.contains('dark') ? '#333' : '#f1f5f9';

    for (let x = offsetX; x < width; x += gridSize) {
        for (let y = offsetY; y < height; y += gridSize) {
            ctx.fillRect(x, y, 1 * zoom, 1 * zoom);
        }
    }
    ctx.restore();
};

const drawLockIcon = (ctx: CanvasRenderingContext2D, x: number, y: number, size: number) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#ef4444";

    // Simple lock shape
    const w = size;
    const h = size * 0.8;

    // Body
    ctx.fillRect(-w / 2, -h / 2 + h * 0.3, w, h * 0.7);

    // Shackle
    ctx.beginPath();
    ctx.arc(0, -h / 2 + h * 0.3, w * 0.3, Math.PI, 0);
    ctx.lineWidth = w * 0.15;
    ctx.strokeStyle = "#ef4444";
    ctx.stroke();

    ctx.restore();
};

// --- Welcome Screen Logic ---
// --- Welcome Screen Logic ---
const drawWelcomeScreen = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    ctx.save();
    const isDark = document.documentElement.classList.contains('dark');
    const primaryColor = isDark ? '#a78bfa' : '#7c3aed'; // Violet-ish
    const textColor = isDark ? '#94a3b8' : '#64748b'; // Gray-500
    const hintColor = isDark ? '#cbd5e1' : '#475569'; // Simple Hint Text

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // 1. Center Logo Text
    ctx.font = 'bold 80px "Kalam", cursive';
    ctx.fillStyle = primaryColor;
    ctx.fillText("FLUXIO", width / 2, height / 2 - 80);

    // 2. Subtitle
    ctx.font = '24px "Kalam", cursive';
    ctx.fillStyle = textColor;
    ctx.fillText("AI-Enhanced Virtual Whiteboard", width / 2, height / 2 - 10);
    ctx.fillText("Your data is saved locally in your browser.", width / 2, height / 2 + 25);

    // 3. Simple Centered Help Text
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
    showSnapPoints: boolean = false
) => {
    // Clear canvas
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Draw Grid
    drawGrid(ctx, ctx.canvas.width, ctx.canvas.height, pan, zoom);

    // If canvas is empty, draw welcome screen
    if (elements.length === 0) {
        drawWelcomeScreen(ctx, ctx.canvas.width / (window.devicePixelRatio || 1), ctx.canvas.height / (window.devicePixelRatio || 1));
    }

    ctx.restore();

    // Apply Pan and Zoom
    ctx.save();
    ctx.translate(pan.x, pan.y);
    ctx.scale(zoom, zoom);

    elements.forEach((element) => {
        // Skip if editing, but for Frames/Text we have specific logic
        if (editingElementId === element.id && element.type === 'text') return;

        ctx.save();
        ctx.globalAlpha = element.opacity / 100;
        ctx.lineWidth = element.strokeWidth;
        ctx.strokeStyle = element.strokeColor;
        ctx.fillStyle = element.backgroundColor;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        // Stroke Style (Dash/Dot)
        const sw = element.strokeWidth;
        const strokeStyle = element.strokeStyle || "solid";

        if (strokeStyle === "dashed") {
            ctx.setLineDash([sw * 4, sw * 4]);
        } else if (strokeStyle === "dotted") {
            ctx.setLineDash([sw, sw * 2]);
        } else {
            ctx.setLineDash([]);
        }

        // Hover Effect (faint outline)
        if (highlightedElementId === element.id && !selectionIds.includes(element.id)) {
            ctx.save();
            ctx.strokeStyle = "#8b5cf6";
            ctx.lineWidth = 1 / zoom;
            ctx.globalAlpha = 0.5;
            ctx.setLineDash([]);
            let bx = element.x, by = element.y, bw = element.width, bh = element.height;
            if (element.points) {
                const xs = element.points.map(p => p.x);
                const ys = element.points.map(p => p.y);
                bx = element.x + Math.min(...xs);
                by = element.y + Math.min(...ys);
                bw = Math.max(...xs) - Math.min(...xs);
                bh = Math.max(...ys) - Math.min(...ys);
            }
            ctx.strokeRect(bx - 5 / zoom, by - 5 / zoom, bw + 10 / zoom, bh + 10 / zoom);
            ctx.restore();
        }

        if (element.type === 'text') {
            ctx.setLineDash([]);

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

            // Use element width for wrapping
            const lines = wrapText(element.text || "", font, element.width);
            const lineHeight = fontSize * 1.25;

            lines.forEach((line, index) => {
                const lineWidth = ctx.measureText(line).width;
                let xOffset = 0;

                // Text Alignment
                if (element.textAlign === 'center') {
                    xOffset = (element.width - lineWidth) / 2;
                } else if (element.textAlign === 'right') {
                    xOffset = element.width - lineWidth;
                }

                ctx.fillText(line, element.x + xOffset, element.y + index * lineHeight);
            });
            ctx.restore();
        } else if (element.type === 'frame') {
            // Draw Frame Body
            ctx.lineWidth = 1;
            ctx.strokeStyle = document.documentElement.classList.contains('dark') ? '#4b5563' : '#9ca3af';

            ctx.beginPath();
            ctx.roundRect(element.x, element.y, element.width, element.height, 8);

            if (element.backgroundColor !== "transparent") {
                ctx.fillStyle = element.backgroundColor;
                ctx.fill();
            }
            ctx.stroke();

            if (editingElementId !== element.id) {
                ctx.setLineDash([]);
                ctx.font = `14px sans-serif`;
                ctx.fillStyle = document.documentElement.classList.contains('dark') ? '#9ca3af' : '#6b7280';
                const label = element.name || "Frame";
                ctx.fillText(label, element.x, element.y - 18);
            }

            ctx.restore();
        } else if (element.type === 'icon' && element.iconPath) {
            ctx.save();
            ctx.translate(element.x, element.y);
            ctx.fillStyle = element.backgroundColor !== "transparent" ? element.backgroundColor : "transparent";

            if (element.backgroundColor !== "transparent") {
                ctx.beginPath();
                ctx.roundRect(0, 0, element.width, element.height, 8);
                ctx.fill();
            }

            const scaleX = element.width / 24;
            const scaleY = element.height / 24;
            ctx.scale(scaleX, scaleY);

            ctx.strokeStyle = element.strokeColor;
            ctx.lineWidth = 2;

            const path = new Path2D(element.iconPath);
            ctx.stroke(path);

            ctx.restore();
        } else {
            switch (element.type) {
                case "rectangle":
                    ctx.beginPath();
                    ctx.roundRect(element.x, element.y, element.width, element.height, 4);
                    if (element.backgroundColor !== "transparent") ctx.fill();
                    ctx.stroke();
                    break;

                case "ellipse":
                    ctx.beginPath();
                    ctx.ellipse(
                        element.x + element.width / 2,
                        element.y + element.height / 2,
                        Math.abs(element.width / 2),
                        Math.abs(element.height / 2),
                        0,
                        0,
                        2 * Math.PI
                    );
                    if (element.backgroundColor !== "transparent") ctx.fill();
                    ctx.stroke();
                    break;

                case "diamond":
                    ctx.beginPath();
                    const midX = element.x + element.width / 2;
                    const midY = element.y + element.height / 2;
                    ctx.moveTo(midX, element.y);
                    ctx.lineTo(element.x + element.width, midY);
                    ctx.lineTo(midX, element.y + element.height);
                    ctx.lineTo(element.x, midY);
                    ctx.closePath();
                    if (element.backgroundColor !== "transparent") ctx.fill();
                    ctx.stroke();
                    break;

                case "arrow":
                case "line":
                    if (element.points && element.points.length > 1) {
                        ctx.beginPath();
                        const start = element.points[0];
                        ctx.moveTo(element.x + start.x, element.y + start.y);

                        if (element.points.length > 2) {
                            const radius = 8;
                            for (let i = 1; i < element.points.length - 1; i++) {
                                const p1 = element.points[i];
                                const p2 = element.points[i + 1];
                                const absP1 = { x: element.x + p1.x, y: element.y + p1.y };
                                const absP2 = { x: element.x + p2.x, y: element.y + p2.y };
                                ctx.arcTo(absP1.x, absP1.y, absP2.x, absP2.y, radius);
                            }
                            const last = element.points[element.points.length - 1];
                            ctx.lineTo(element.x + last.x, element.y + last.y);
                        } else {
                            for (let i = 1; i < element.points.length; i++) {
                                const cur = element.points[i];
                                ctx.lineTo(element.x + cur.x, element.y + cur.y);
                            }
                        }

                        ctx.stroke();

                        if (element.type === "arrow") {
                            const end = element.points[element.points.length - 1];
                            const prev = element.points[element.points.length - 2] || element.points[0];
                            const angle = Math.atan2(end.y - prev.y, end.x - prev.x);
                            const headLen = 15 + element.strokeWidth;

                            ctx.setLineDash([]);

                            ctx.beginPath();
                            ctx.moveTo(element.x + end.x, element.y + end.y);
                            ctx.lineTo(
                                element.x + end.x - headLen * Math.cos(angle - Math.PI / 6),
                                element.y + end.y - headLen * Math.sin(angle - Math.PI / 6)
                            );
                            ctx.moveTo(element.x + end.x, element.y + end.y);
                            ctx.lineTo(
                                element.x + end.x - headLen * Math.cos(angle + Math.PI / 6),
                                element.y + end.y - headLen * Math.sin(angle + Math.PI / 6)
                            );
                            ctx.stroke();
                        }
                    }
                    break;

                case "freedraw":
                    if (element.points && element.points.length > 0) {
                        ctx.beginPath();
                        ctx.moveTo(element.x + element.points[0].x, element.y + element.points[0].y);
                        for (let i = 1; i < element.points.length; i++) {
                            ctx.lineTo(element.x + element.points[i].x, element.y + element.points[i].y);
                        }
                        ctx.stroke();
                    }
                    break;
            }
            ctx.restore();
        }

        // --- Selection UI ---
        if (selectionIds.includes(element.id)) {
            ctx.save();
            // Selection Colors: Solid Purple like Excalidraw default or specific blue
            const selectionColor = element.isLocked ? "#ef4444" : "#8b5cf6";
            ctx.strokeStyle = selectionColor;
            ctx.lineWidth = 1 / zoom;
            ctx.setLineDash([]);

            const buffer = 8 / zoom; // Padding around the element

            let minX = element.x;
            let minY = element.y;
            let maxX = element.x + element.width;
            let maxY = element.y + element.height;

            if (element.points) {
                const xs = element.points.map(p => p.x);
                const ys = element.points.map(p => p.y);
                minX = element.x + Math.min(...xs);
                maxX = element.x + Math.max(...xs);
                minY = element.y + Math.min(...ys);
                maxY = element.y + Math.max(...ys);
            }

            const isLinear = element.type === 'line' || element.type === 'arrow';

            // Draw Selection Border
            // Only draw bbox if NOT linear or if multiple selection
            if (!isLinear || selectionIds.length > 1) {
                ctx.strokeRect(
                    minX - buffer,
                    minY - buffer,
                    (maxX - minX) + buffer * 2,
                    (maxY - minY) + buffer * 2
                );
            }

            // Draw Lock Icon if locked
            if (element.isLocked) {
                drawLockIcon(ctx, minX, minY - 20 / zoom, 14 / zoom);
            }

            // Draw Resize Handles (only if single selection and not locked)
            if (selectionIds.length === 1 && !element.isLocked) {
                const handles = getResizeHandles(element);
                const handleSize = 8 / zoom; // Smaller, cleaner handles

                ctx.strokeStyle = selectionColor;
                ctx.lineWidth = 1 / zoom;

                const keys = Object.keys(handles) as ResizeHandle[];

                keys.forEach(key => {
                    // @ts-ignore
                    const p = handles[key];

                    // Handle adjustment based on buffer
                    let hx = p.x;
                    let hy = p.y;

                    if (!isLinear && !(typeof key === 'string' && key.startsWith('p:'))) {
                        // Push handles out by buffer amount
                        if (key.includes('w')) hx -= buffer;
                        if (key.includes('e')) hx += buffer;
                        if (key.includes('n')) hy -= buffer;
                        if (key.includes('s')) hy += buffer;
                    }

                    ctx.beginPath();

                    if (typeof key === 'string' && (key.startsWith('p:') || key.startsWith('m:'))) {
                        // Circle handles for points
                        const isMid = key.startsWith('m:');
                        if (isMid) {
                            ctx.fillStyle = selectionColor;
                            ctx.globalAlpha = 0.5;
                            ctx.arc(hx, hy, handleSize / 2, 0, 2 * Math.PI);
                            ctx.fill();
                            ctx.globalAlpha = 1.0;
                        } else {
                            ctx.fillStyle = "#ffffff";
                            ctx.arc(hx, hy, handleSize / 1.5, 0, 2 * Math.PI);
                            ctx.fill();
                            ctx.stroke();
                        }
                    } else if (!isLinear) {
                        // Square handles for shapes (Solid Line + White Fill)
                        ctx.fillStyle = "#ffffff";
                        // Rounded rect for handle
                        ctx.roundRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize, 2 / zoom);
                        ctx.fill();
                        ctx.stroke();
                    }
                });
            }

            ctx.restore();
        }
    });

    // Draw Snap Points on Highlighted Element
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

    // Draw Selection Box
    if (selectionBox) {
        ctx.save();
        ctx.fillStyle = "rgba(139, 92, 246, 0.1)";
        ctx.strokeStyle = "#8b5cf6";
        ctx.lineWidth = 1 / zoom;
        ctx.fillRect(selectionBox.x, selectionBox.y, selectionBox.width, selectionBox.height);
        ctx.strokeRect(selectionBox.x, selectionBox.y, selectionBox.width, selectionBox.height);
        ctx.restore();
    }

    // Draw Laser
    if (laserTrails.length > 0) {
        const now = Date.now();
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        laserTrails.forEach(trail => {
            if (trail.length < 2) return;
            ctx.beginPath();
            ctx.moveTo(trail[0].x, trail[0].y);
            for (let i = 1; i < trail.length; i++) {
                const point = trail[i];
                const age = now - point.time;
                const opacity = Math.max(0, 1 - age / 1000);
                if (opacity <= 0) continue;
                ctx.beginPath();
                if (i > 0) ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
                ctx.lineTo(point.x, point.y);
                ctx.strokeStyle = `rgba(220, 38, 38, ${opacity})`;
                ctx.lineWidth = 4 / zoom;
                ctx.stroke();
            }
        });
    }

    ctx.restore();
};
