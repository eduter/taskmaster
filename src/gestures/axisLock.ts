type Axis = 'horizontal' | 'vertical' | null;

function resolveAxis(dx: number, dy: number, threshold: number): Axis {
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (absX < threshold && absY < threshold) {
        return null;
    }
    if (absX > absY) {
        return 'horizontal';
    }
    if (absY > absX) {
        return 'vertical';
    }
    return null;
}

/** True when movement is clearly a horizontal swipe, not a wobble during long-press. */
function isDominantHorizontal(dx: number, dy: number, threshold: number, dominance = 1.5): boolean {
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    if (absX < threshold) {
        return false;
    }
    return absX > absY * dominance;
}

export type { Axis };
export { isDominantHorizontal, resolveAxis };
