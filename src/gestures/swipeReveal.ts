function revealOffsetX(dx: number, revealWidth: number, deleteRevealed: boolean): number {
    if (deleteRevealed) {
        const base = -revealWidth;
        return Math.min(0, Math.max(-revealWidth, base + dx));
    }
    return Math.min(0, Math.max(-revealWidth, dx));
}

function snapRevealOpen(offsetX: number, revealWidth: number, openRatio: number): boolean {
    return Math.abs(offsetX) > revealWidth * openRatio;
}

export { revealOffsetX, snapRevealOpen };
