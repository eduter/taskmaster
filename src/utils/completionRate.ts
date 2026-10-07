/** Fraction of a list's items that are complete, or 0 for an empty or absent list. */
function completionRate(items: readonly { completed: boolean }[] | undefined): number {
    const list = items ?? [];
    if (list.length === 0) {
        return 0;
    }

    return list.filter((item) => item.completed).length / list.length;
}

export { completionRate };
