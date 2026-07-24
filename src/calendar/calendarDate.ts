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

function parseDate(date: string): Date {
    return new Date(`${date}T12:00:00`);
}

export { addMonths, getISOWeekNumber, getMonthGrid, getWeekDates, startOfMonth, startOfWeek };
export type { MonthDay, MonthWeek };
