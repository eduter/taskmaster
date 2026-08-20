/** Groups calendar items by date so every rendered day avoids scanning the full range. */
function indexCalendarItemsByDate<T extends { date: string }>(items: T[]): ReadonlyMap<string, T[]> {
    const indexed = new Map<string, T[]>();

    for (const item of items) {
        const dayItems = indexed.get(item.date);
        if (dayItems) {
            dayItems.push(item);
        } else {
            indexed.set(item.date, [item]);
        }
    }

    return indexed;
}

/** Keeps nearby pager content mounted while distant pages remain lightweight placeholders. */
function shouldRenderCalendarPage(index: number, currentIndex: number): boolean {
    return Math.abs(index - currentIndex) <= 2;
}

export { indexCalendarItemsByDate, shouldRenderCalendarPage };
