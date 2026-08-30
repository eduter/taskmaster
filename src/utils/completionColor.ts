interface ColorStop {
    rate: number;
    rgb: readonly [number, number, number];
}

const COMPLETION_COLOR_STOPS: readonly ColorStop[] = [
    { rate: 0, rgb: [248, 113, 113] },
    { rate: 0.33, rgb: [249, 115, 22] },
    { rate: 0.66, rgb: [251, 191, 36] },
    { rate: 1, rgb: [52, 211, 153] },
];

/** Maps a 0–1 completion rate to a red→orange→yellow→green color. */
function completionColor(rate: number): string {
    const clamped = Math.min(1, Math.max(0, rate));

    for (let index = 0; index < COMPLETION_COLOR_STOPS.length - 1; index++) {
        const start = COMPLETION_COLOR_STOPS[index];
        const end = COMPLETION_COLOR_STOPS[index + 1];
        if (clamped > end.rate) {
            continue;
        }

        const span = end.rate - start.rate;
        const t = span === 0 ? 0 : (clamped - start.rate) / span;
        const red = Math.round(start.rgb[0] + (end.rgb[0] - start.rgb[0]) * t);
        const green = Math.round(start.rgb[1] + (end.rgb[1] - start.rgb[1]) * t);
        const blue = Math.round(start.rgb[2] + (end.rgb[2] - start.rgb[2]) * t);
        return `#${[red, green, blue].map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
    }

    const last = COMPLETION_COLOR_STOPS[COMPLETION_COLOR_STOPS.length - 1];
    return `#${last.rgb.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
}

export { completionColor };
