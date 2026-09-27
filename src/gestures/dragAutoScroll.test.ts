/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
    autoScrollVelocity,
    createDragAutoScroller,
    type DragAutoScrollConfig,
    dragScrollContainerBounds,
    findDragScrollContainer,
    isVerticallyScrollable,
} from './dragAutoScroll.ts';

const CONFIG: DragAutoScrollConfig = {
    edgePx: 64,
    minSpeedPxPerSec: 150,
    maxSpeedPxPerSec: 1200,
    maxFrameMs: 50,
};

const BOUNDS = { top: 0, bottom: 200 };

describe('autoScrollVelocity', () => {
    it('stays still in the middle of the container', () => {
        expect(autoScrollVelocity(100, BOUNDS, CONFIG)).toBe(0);
        expect(autoScrollVelocity(136, BOUNDS, CONFIG)).toBe(0);
        expect(autoScrollVelocity(64, BOUNDS, CONFIG)).toBe(0);
    });

    it('scrolls toward the start near the top edge', () => {
        expect(autoScrollVelocity(10, BOUNDS, CONFIG)).toBeLessThan(0);
    });

    it('scrolls toward the end near the bottom edge', () => {
        expect(autoScrollVelocity(190, BOUNDS, CONFIG)).toBeGreaterThan(0);
    });

    it('reaches max speed at the very edge', () => {
        expect(autoScrollVelocity(0, BOUNDS, CONFIG)).toBe(-CONFIG.maxSpeedPxPerSec);
        expect(autoScrollVelocity(200, BOUNDS, CONFIG)).toBe(CONFIG.maxSpeedPxPerSec);
    });

    it('kicks in just inside the edge zone at the minimum speed', () => {
        expect(autoScrollVelocity(64, BOUNDS, CONFIG)).toBe(0);
        const justInside = autoScrollVelocity(63.9, BOUNDS, CONFIG);
        expect(justInside).toBeLessThan(0);
        expect(justInside).toBeGreaterThanOrEqual(-CONFIG.minSpeedPxPerSec - 2);
    });

    it('ramps proportionally from min to max through the edge zone', () => {
        // Halfway through the top edge zone (32px from the edge).
        const halfTop = autoScrollVelocity(32, BOUNDS, CONFIG);
        expect(halfTop).toBeCloseTo(-(CONFIG.minSpeedPxPerSec + CONFIG.maxSpeedPxPerSec) / 2, 5);

        // Three quarters of the way into the bottom edge zone (16px from the edge).
        const nearBottom = autoScrollVelocity(184, BOUNDS, CONFIG);
        const expected = CONFIG.minSpeedPxPerSec + (CONFIG.maxSpeedPxPerSec - CONFIG.minSpeedPxPerSec) * (48 / 64);
        expect(nearBottom).toBeCloseTo(expected, 5);
    });

    it('clamps to max speed when the pointer is beyond the container edge', () => {
        expect(autoScrollVelocity(-50, BOUNDS, CONFIG)).toBe(-CONFIG.maxSpeedPxPerSec);
        expect(autoScrollVelocity(400, BOUNDS, CONFIG)).toBe(CONFIG.maxSpeedPxPerSec);
    });
});

describe('isVerticallyScrollable', () => {
    function elementWithScroll(overflowY: string, clientHeight: number, scrollHeight: number): HTMLElement {
        const element = document.createElement('div');
        element.style.overflowY = overflowY;
        Object.defineProperty(element, 'clientHeight', { value: clientHeight, configurable: true });
        Object.defineProperty(element, 'scrollHeight', { value: scrollHeight, configurable: true });
        return element;
    }

    it('accepts an overflowing auto container', () => {
        expect(isVerticallyScrollable(elementWithScroll('auto', 100, 300))).toBe(true);
    });

    it('accepts an overflowing scroll container', () => {
        expect(isVerticallyScrollable(elementWithScroll('scroll', 100, 300))).toBe(true);
    });

    it('rejects a container that does not overflow', () => {
        expect(isVerticallyScrollable(elementWithScroll('auto', 300, 100))).toBe(false);
    });

    it('rejects a hidden container', () => {
        expect(isVerticallyScrollable(elementWithScroll('hidden', 100, 300))).toBe(false);
    });
});

describe('findDragScrollContainer', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('returns the nearest vertical scrollable ancestor', () => {
        const outer = document.createElement('div');
        const inner = document.createElement('div');
        const surface = document.createElement('div');
        outer.style.overflowY = 'auto';
        Object.defineProperty(outer, 'clientHeight', { value: 100, configurable: true });
        Object.defineProperty(outer, 'scrollHeight', { value: 300, configurable: true });
        outer.append(inner);
        inner.append(surface);
        document.body.append(outer);

        expect(findDragScrollContainer(surface)).toBe(outer);
    });

    it('falls back to the page scroller when nothing above scrolls', () => {
        const surface = document.createElement('div');
        document.body.append(surface);

        const pageScroller = document.scrollingElement ?? document.documentElement;
        expect(findDragScrollContainer(surface)).toBe(pageScroller);
    });
});

describe('dragScrollContainerBounds', () => {
    afterEach(() => {
        document.body.innerHTML = '';
    });

    it('uses the viewport for the page scroller', () => {
        expect(dragScrollContainerBounds(document.documentElement)).toEqual({
            top: 0,
            bottom: window.innerHeight,
        });
    });

    it('uses the element rect for a nested scroller', () => {
        const element = document.createElement('div');
        element.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 40, width: 320, height: 200 });
        expect(dragScrollContainerBounds(element)).toEqual({ top: 40, bottom: 240 });
    });
});

describe('createDragAutoScroller', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
        document.body.innerHTML = '';
    });

    function makeScrollContainer(): { scroller: HTMLElement; surface: HTMLElement } {
        const scroller = document.createElement('div');
        scroller.style.overflowY = 'auto';
        Object.defineProperty(scroller, 'clientHeight', { value: 200, configurable: true });
        Object.defineProperty(scroller, 'scrollHeight', { value: 1000, configurable: true });
        let scrollTop = 100;
        Object.defineProperty(scroller, 'scrollTop', {
            get: () => scrollTop,
            set: (value: number) => {
                scrollTop = value;
            },
            configurable: true,
        });
        scroller.getBoundingClientRect = () => DOMRect.fromRect({ x: 0, y: 0, width: 320, height: 200 });
        const surface = document.createElement('div');
        scroller.append(surface);
        document.body.append(scroller);
        return { scroller, surface };
    }

    function stubFrames(): FrameRequestCallback[] {
        const frames: FrameRequestCallback[] = [];
        vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
            frames.push(callback);
            return frames.length;
        });
        vi.stubGlobal('cancelAnimationFrame', () => {});
        return frames;
    }

    function runFrame(frames: FrameRequestCallback[], timestamp: number): void {
        const callback = frames.shift();
        if (!callback) {
            throw new Error('expected a scheduled animation frame');
        }
        callback(timestamp);
    }

    it('scrolls the container while the pointer sits in the bottom edge zone', () => {
        const frames = stubFrames();
        const { scroller, surface } = makeScrollContainer();
        const onScroll = vi.fn();
        const autoScroller = createDragAutoScroller(CONFIG, onScroll);

        autoScroller.start(surface);
        autoScroller.moveTo(195);
        runFrame(frames, 0);
        runFrame(frames, 16);

        expect(onScroll).toHaveBeenCalled();
        expect(scroller.scrollTop).toBeGreaterThan(100);

        autoScroller.stop();
    });

    it('does not scroll when the pointer is in the middle', () => {
        const frames = stubFrames();
        const { scroller, surface } = makeScrollContainer();
        const onScroll = vi.fn();
        const autoScroller = createDragAutoScroller(CONFIG, onScroll);

        autoScroller.start(surface);
        autoScroller.moveTo(100);
        runFrame(frames, 0);
        runFrame(frames, 16);

        expect(onScroll).not.toHaveBeenCalled();
        expect(scroller.scrollTop).toBe(100);

        autoScroller.stop();
    });

    it('stops scrolling after stop', () => {
        const frames = stubFrames();
        const { scroller, surface } = makeScrollContainer();
        const onScroll = vi.fn();
        const autoScroller = createDragAutoScroller(CONFIG, onScroll);

        autoScroller.start(surface);
        autoScroller.moveTo(195);
        runFrame(frames, 0);
        autoScroller.stop();

        expect(scroller.scrollTop).toBe(100);
        expect(onScroll).not.toHaveBeenCalled();
    });
});
