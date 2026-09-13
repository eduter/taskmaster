import { addDays, toDateString } from '../utils/logicalDay.ts';

/** One rendered week in a six-row month grid. */
interface MonthWeek {
    weekNumber: number;
    days: MonthDay[];
}

/** A day and whether it belongs to the grid's headline month. */
interface MonthDay {
    date: string;
    inMonth: boolean;
}

/** Returns the Monday containing the supplied date. */
function startOfWeek(date: string): string {
    const day = parseDate(date).getDay();
    return addDays(date, -(day === 0 ? 6 : day - 1));
}

/** Returns the seven Monday-first dates containing the supplied date. */
function getWeekDates(date: string): string[] {
    const monday = startOfWeek(date);
    return Array.from({ length: 7 }, (_, index) => addDays(monday, index));
}

/** Returns the ISO-8601 week number for a logical date. */
function getISOWeekNumber(date: string): number {
    const value = parseDate(date);
    const utc = new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()));
    const weekday = utc.getUTCDay() || 7;
    utc.setUTCDate(utc.getUTCDate() + 4 - weekday);
    const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
    return Math.ceil(((utc.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

/** Returns six complete Monday-first weeks for the supplied month. */
function getMonthGrid(date: string): MonthWeek[] {
    const monthStart = startOfMonth(date);
    const gridStart = startOfWeek(monthStart);
    const month = monthStart.slice(0, 7);

    return Array.from({ length: 6 }, (_, weekIndex) => {
        const monday = addDays(gridStart, weekIndex * 7);
        return {
            weekNumber: getISOWeekNumber(monday),
            days: Array.from({ length: 7 }, (_, dayIndex) => {
                const day = addDays(monday, dayIndex);
                return { date: day, inMonth: day.startsWith(month) };
            }),
        };
    });
}

/** Returns the first day of a month offset from the supplied date. */
function addMonths(date: string, months: number): string {
    const value = parseDate(date);
    value.setDate(1);
    value.setMonth(value.getMonth() + months);
    return toDateString(value);
}

/** Returns the first day of the supplied date's month. */
function startOfMonth(date: string): string {
    return `${date.slice(0, 7)}-01`;
}

/** True when the week row contains the first day of a month. */
function isMonthStartWeek(weekMonday: string): boolean {
    return getWeekDates(weekMonday).some((date) => date.endsWith('-01'));
}

/** Returns the month headline for a week row containing that month's first day. */
function monthForStartWeek(weekMonday: string): string {
    const firstOfMonth = getWeekDates(weekMonday).find((date) => date.endsWith('-01'));
    if (!firstOfMonth) {
        throw new Error(`week ${weekMonday} is not a month-start week`);
    }
    return startOfMonth(firstOfMonth);
}

/** Returns the month headline shown while a week index is near the top of the scroller. */
function visibleMonthForWeekIndex(weeks: readonly string[], weekIndex: number): string {
    const boundedIndex = Math.max(0, Math.min(weekIndex, weeks.length - 1));
    for (let index = boundedIndex; index >= 0; index--) {
        const weekMonday = weeks[index];
        if (weekMonday && isMonthStartWeek(weekMonday)) {
            return monthForStartWeek(weekMonday);
        }
    }
    return startOfMonth(weeks[boundedIndex] ?? '1970-01-01');
}

/** Returns the week index whose row should align with the supplied month headline. */
function indexOfMonthStartWeek(weeks: readonly string[], month: string): number {
    const monthStartWeek = startOfWeek(month);
    const index = weeks.indexOf(monthStartWeek);
    if (index === -1) {
        throw new Error(`month ${month} is outside the rendered week range`);
    }
    return index;
}

function parseDate(date: string): Date {
    return new Date(`${date}T12:00:00`);
}

export {
    addMonths,
    getISOWeekNumber,
    getMonthGrid,
    getWeekDates,
    indexOfMonthStartWeek,
    isMonthStartWeek,
    monthForStartWeek,
    startOfMonth,
    startOfWeek,
    visibleMonthForWeekIndex,
};
export type { MonthDay, MonthWeek };
