import { addDays } from './logicalDay.ts';

/**
 * Formats a logical day the way the calendar day dialog titles it.
 */
function formatFullDate(date: string): string {
    return new Intl.DateTimeFormat(undefined, {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    }).format(new Date(`${date}T12:00:00`));
}

/**
 * Nearby days as Today / Tomorrow / Yesterday; otherwise the full weekday date.
 */
function formatRelativeDay(date: string, today: string): string {
    if (date === today) {
        return 'Today';
    }
    if (date === addDays(today, 1)) {
        return 'Tomorrow';
    }
    if (date === addDays(today, -1)) {
        return 'Yesterday';
    }
    return formatFullDate(date);
}

export { formatFullDate, formatRelativeDay };
