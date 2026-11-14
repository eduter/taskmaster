import {
    PAPER_DEFAULTS,
    type PaperConfig,
    type PaperPoint,
    type PaperPointer,
    type PaperState,
    paperPoint,
} from './paperDrag.ts';

const PAPER_BANDS = 8;
const PAPER_PERSPECTIVE = 850;

/** Snapshot an inert drag visual once; bend its bands and project filled shadow silhouettes. */
function createPaperSurface(
    host: HTMLElement,
    source: HTMLElement,
    width: number,
    height: number,
    shadowHost?: HTMLElement
): PaperSurface {
    const bands: HTMLDivElement[] = [];
    const shadow = shadowHost ? createPaperShadow(shadowHost, width, height) : undefined;
    host.style.width = `${width}px`;
    host.style.height = `${height}px`;
    host.style.perspective = `${PAPER_PERSPECTIVE}px`;
    host.style.pointerEvents = 'none';
    host.setAttribute('aria-hidden', 'true');
    host.inert = true;

    // Clip copies of the same snapshot, rather than re-rendering live components
    for (let index = 0; index < PAPER_BANDS; index++) {
        const band = document.createElement('div');
        const content = source.cloneNode(true) as HTMLElement;
        content.removeAttribute('id');
        for (const node of content.querySelectorAll('[id]')) {
            node.removeAttribute('id');
        }
        Object.assign(band.style, {
            position: 'absolute',
            left: '0',
            top: '0',
            width: '100%',
            height: `${height / PAPER_BANDS + (index < PAPER_BANDS - 1 ? 1 : 0)}px`,
            overflow: 'hidden',
            transformOrigin: '0 0',
            willChange: 'transform',
        });
        Object.assign(content.style, {
            visibility: 'visible',
            width: '100%',
            height: `${height}px`,
            margin: '0',
            position: 'absolute',
            top: `${(-height * index) / PAPER_BANDS}px`,
        });
        band.append(content);
        host.append(band);
        bands.push(band);
    }

    function paint(state: PaperState, grip: PaperPointer, config: PaperConfig = PAPER_DEFAULTS): void {
        const anchorY = Math.max(0, Math.min(height, grip.y));
        const points = Array.from({ length: PAPER_BANDS + 1 }, (_, i) =>
            paperPoint(state, i / PAPER_BANDS, height, config)
        );
        const gripBand = Math.min(PAPER_BANDS - 1, Math.floor((anchorY / height) * PAPER_BANDS));
        const ratio = (anchorY / height) * PAPER_BANDS - gripBand;
        // Pin the actual rendered segment, not the analytic curve between segments
        const anchor = {
            x: points[gripBand].x + (points[gripBand + 1].x - points[gripBand].x) * ratio,
            y: points[gripBand].y + (points[gripBand + 1].y - points[gripBand].y) * ratio,
        };
        shadow?.paint(points, grip, anchor, width, anchorY, state.top, config);
        host.style.perspectiveOrigin = `${grip.x}px ${grip.y}px`;
        for (let index = 0; index < PAPER_BANDS; index++) {
            const from = points[index];
            const to = points[index + 1];
            const step = height / PAPER_BANDS;
            const dx = (to.x - from.x) / step;
            const dy = (to.y - from.y) / step;
            const dz = (to.z - from.z) / step;
            // Matching endpoints make a continuous ruled surface; perspective
            // is centered on the real grip, keeping that point under the finger
            bands[index].style.transform =
                `matrix3d(1,0,0,0,${dx},${dy},${dz},0,0,0,1,0,${from.x - anchor.x},${from.y - anchor.y + anchorY},${from.z},1)`;
        }
    }

    function destroy(): void {
        shadow?.destroy();
        for (const band of bands) {
            band.remove();
        }
    }

    return { paint, destroy };
}

/** A fixed-size snapshot with eight connected 3D bands. */
interface PaperSurface {
    paint(state: PaperState, grip: PaperPointer, config?: PaperConfig): void;
    destroy(): void;
}

/** Filled black silhouettes have no unshadowed rectangular hole when the sheet curls. */
function createPaperShadow(host: HTMLElement, width: number, height: number) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(height));
    svg.setAttribute('aria-hidden', 'true');
    svg.style.overflow = 'visible';
    svg.style.position = 'absolute';
    svg.style.inset = '0';
    const paths = [0, 1].map(() => {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('fill', '#000');
        svg.append(path);
        return path;
    });
    host.append(svg);

    function paint(
        points: PaperPoint[],
        grip: PaperPointer,
        anchor: PaperPointer,
        sheetWidth: number,
        anchorY: number,
        lift: number,
        config: PaperConfig
    ): void {
        const amount = Math.max(0, Math.min(1, lift / Math.max(config.lift, 1)));
        for (let layer = 0; layer < paths.length; layer++) {
            const outline: string[] = [];
            for (let side = 0; side < 2; side++) {
                for (let i = 0; i < points.length; i++) {
                    const point = points[side === 0 ? i : points.length - 1 - i];
                    const scale = 1 / (1 - point.z / PAPER_PERSPECTIVE);
                    const x = grip.x + (side * sheetWidth + point.x - anchor.x - grip.x) * scale;
                    const y = grip.y + (point.y - anchor.y + anchorY - grip.y) * scale;
                    const offset = Math.max(0, point.z) * (layer === 0 ? 0.1 : 0.55);
                    outline.push(`${x.toFixed(3)},${(y + offset).toFixed(3)}`);
                }
            }
            paths[layer].setAttribute('d', `M${outline.join(' L')} Z`);
            paths[layer].setAttribute('fill-opacity', String(config.shadow * amount * (layer === 0 ? 0.45 : 1)));
            paths[layer].style.filter = `blur(${layer === 0 ? 4 + lift * 0.15 : 6 + lift * 0.4}px)`;
        }
    }

    function destroy(): void {
        svg.remove();
    }

    return { paint, destroy };
}

export type { PaperSurface };
export { createPaperSurface, PAPER_BANDS, PAPER_PERSPECTIVE };
