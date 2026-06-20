/** Twenty visually distinct label colors from https://sashamaps.net/docs/resources/20-colors/ */
const LABEL_PALETTE = [
    '#e6194b',
    '#3cb44b',
    '#ffe119',
    '#4363d8',
    '#f58231',
    '#911eb4',
    '#46f0f0',
    '#f032e6',
    '#bcf60c',
    '#fabebe',
    '#008080',
    '#e6beff',
    '#9a6324',
    '#fffac8',
    '#800000',
    '#aaffc3',
    '#808000',
    '#ffd8b1',
    '#000075',
    '#808080',
] as const;

/** Returns the first palette color not already used, or round-robins when all are taken. */
function defaultLabelColor(usedColors: readonly string[]): string {
    const unused = LABEL_PALETTE.find((color) => !usedColors.includes(color));
    if (unused) {
        return unused;
    }
    return LABEL_PALETTE[usedColors.length % LABEL_PALETTE.length];
}

export { defaultLabelColor, LABEL_PALETTE };
