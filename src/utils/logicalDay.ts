const DAY_BOUNDARY_HOUR = 4;

function getLogicalDay(now: Date = new Date()): string {
    const adjusted = new Date(now);
    if (adjusted.getHours() < DAY_BOUNDARY_HOUR) {
        adjusted.setDate(adjusted.getDate() - 1);
    }
    return toDateString(adjusted);
}

function toDateString(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

function addDays(dateStr: string, days: number): string {
    const date = new Date(`${dateStr}T12:00:00`);
    date.setDate(date.getDate() + days);
    return toDateString(date);
}

function getNextMonday(dateStr: string): string {
    const date = new Date(`${dateStr}T12:00:00`);
    const day = date.getDay();
    const daysUntilMonday = day === 0 ? 1 : 8 - day;
    date.setDate(date.getDate() + daysUntilMonday);
    return toDateString(date);
}

export { addDays, DAY_BOUNDARY_HOUR, getLogicalDay, getNextMonday, toDateString };
