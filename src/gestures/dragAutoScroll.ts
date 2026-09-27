/**
 * Tuning for drag edge auto-scroll. The pointer's distance to the container edge
 * is mapped to a scroll velocity: no movement until within `edgePx`, then a
 * proportional ramp from `minSpeedPxPerSec` at the zone's inner boundary up to
 * `maxSpeedPxPerSec` at the very edge.
 */
interface DragAutoScrollConfig {
    edgePx: number;
    minSpeedPxPerSec: number;
    maxSpeedPxPerSec: number;
    maxFrameMs: number;
}

interface DragScrollBounds {
    top: number;
    bottom: number;
}

interface DragAutoScroller {
    /** Begin watching a dragged row; resolves the nearest scroll container it lives in. */
    start(surface: HTMLElement): void;
    /** Feed the pointer's current viewport Y position. */
    moveTo(clientY: number): void;
    /** Stop scrolling and release the animation frame. */
    stop(): void;
}

/**
 * Scroll velocity (px/second, positive = toward the end) for a pointer at
 * `clientY` inside `bounds`. Zero while in the safe middle zone.
 */
function autoScrollVelocity(clientY: number, bounds: DragScrollBounds, config: DragAutoScrollConfig): number {
    const { top, bottom } = bounds;
    const { edgePx, minSpeedPxPerSec, maxSpeedPxPerSec } = config;
    if (bottom - top <= 0) {
        return 0;
    }

    const zone = Math.min(edgePx, (bottom - top) / 2);
    if (zone <= 0) {
        return 0;
    }

    if (clientY < top + zone) {
        const depth = top + zone - clientY;
        return -rampedSpeed(depth, zone, minSpeedPxPerSec, maxSpeedPxPerSec);
    }
    if (clientY > bottom - zone) {
        const depth = clientY - (bottom - zone);
        return rampedSpeed(depth, zone, minSpeedPxPerSec, maxSpeedPxPerSec);
    }
    return 0;
}

function rampedSpeed(depth: number, zone: number, min: number, max: number): number {
    const ratio = Math.min(1, Math.max(0, depth / zone));
    return min + (max - min) * ratio;
}

function isVerticallyScrollable(element: HTMLElement): boolean {
    const overflowY = getComputedStyle(element).overflowY;
    if (overflowY !== 'auto' && overflowY !== 'scroll') {
        return false;
    }
    return element.scrollHeight > element.clientHeight;
}

/** Nearest vertical scroll container above the dragged row, or the page scroller. */
function findDragScrollContainer(surface: HTMLElement): HTMLElement {
    let current: HTMLElement | null = surface.parentElement;
    while (current) {
        if (current === document.body || current === document.documentElement) {
            break;
        }
        if (isVerticallyScrollable(current)) {
            return current;
        }
        current = current.parentElement;
    }
    return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
}

/** Viewport-space top/bottom of the scroll bounds the pointer is tested against. */
function dragScrollContainerBounds(container: HTMLElement): DragScrollBounds {
    if (container === document.scrollingElement || container === document.documentElement) {
        return { top: 0, bottom: window.innerHeight };
    }
    const rect = container.getBoundingClientRect();
    return { top: rect.top, bottom: rect.bottom };
}

/**
 * Drives proportional edge auto-scroll for an active drag. The scroll container
 * is resolved from the dragged row once, when the drag starts.
 */
function createDragAutoScroller(config: DragAutoScrollConfig, onScroll: () => void): DragAutoScroller {
    let container: HTMLElement | null = null;
    let frame: number | null = null;
    let pointerY = 0;
    let lastFrameMs: number | null = null;

    function scrollBy(deltaY: number): void {
        if (!container || deltaY === 0) {
            return;
        }
        const before = container.scrollTop;
        container.scrollTop = before + deltaY;
        if (container.scrollTop !== before) {
            onScroll();
        }
    }

    function tick(timestamp: number): void {
        frame = null;
        if (!container) {
            return;
        }

        const elapsed = lastFrameMs === null ? 0 : Math.min(timestamp - lastFrameMs, config.maxFrameMs);
        lastFrameMs = timestamp;

        const velocity = autoScrollVelocity(pointerY, dragScrollContainerBounds(container), config);
        scrollBy((velocity * elapsed) / 1000);

        schedule();
    }

    function schedule(): void {
        if (frame !== null) {
            return;
        }
        frame = requestAnimationFrame(tick);
    }

    function start(surface: HTMLElement): void {
        stop();
        container = findDragScrollContainer(surface);
        lastFrameMs = null;
        pointerY = dragScrollContainerBounds(container).top;
        schedule();
    }

    function moveTo(clientY: number): void {
        pointerY = clientY;
        schedule();
    }

    function stop(): void {
        if (frame !== null) {
            cancelAnimationFrame(frame);
            frame = null;
        }
        container = null;
        lastFrameMs = null;
    }

    return { start, moveTo, stop };
}

export type { DragAutoScroller, DragAutoScrollConfig, DragScrollBounds };
export {
    autoScrollVelocity,
    createDragAutoScroller,
    dragScrollContainerBounds,
    findDragScrollContainer,
    isVerticallyScrollable,
};
