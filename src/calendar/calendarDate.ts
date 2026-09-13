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

/**
 * Returns the month-start week index CSS snap would settle on for a fractional
 * scroller offset (scrollTop / rowHeight).
 */
function nearestMonthStartWeekIndex(weeks: readonly string[], weekOffset: number): number {
    const snaps = monthStartWeekIndexes(weeks);
    const fallback = Math.max(0, Math.min(Math.round(weekOffset), weeks.length - 1));
    if (snaps.length === 0) {
        return fallback;
    }

    let best = snaps[0] ?? fallback;
    let bestDistance = Math.abs(best - weekOffset);
    for (const snap of snaps) {
        const distance = Math.abs(snap - weekOffset);
        // Prefer the later snap on a tie so the midpoint matches nearest rounding.
        if (distance < bestDistance || (distance === bestDistance && snap > best)) {
            best = snap;
            bestDistance = distance;
        }
    }
    return best;
}

/** Returns the month headline that matches the nearest month-start snap. */
function visibleMonthForWeekOffset(weeks: readonly string[], weekOffset: number): string {
    const snapIndex = nearestMonthStartWeekIndex(weeks, weekOffset);
    const weekMonday = weeks[snapIndex];
    if (weekMonday && isMonthStartWeek(weekMonday)) {
        return monthForStartWeek(weekMonday);
    }
    return startOfMonth(weekMonday ?? '1970-01-01');
}

/**
 * Returns a fractional index into the month-start list so a clipped month
 * headline can scroll in lockstep with the calendar.
 */
function monthReelIndex(weeks: readonly string[], weekOffset: number): number {
    const snaps = monthStartWeekIndexes(weeks);
    if (snaps.length === 0) {
        return 0;
    }

    const first = snaps[0] ?? 0;
    const last = snaps.at(-1) ?? first;
    if (weekOffset <= first) {
        return 0;
    }
    if (weekOffset >= last) {
        return snaps.length - 1;
    }

    for (let index = 0; index < snaps.length - 1; index++) {
        const start = snaps[index] ?? first;
        const end = snaps[index + 1] ?? last;
        if (weekOffset > end) {
            continue;
        }
        if (end === start) {
            return index;
        }
        return index + (weekOffset - start) / (end - start);
    }
    return snaps.length - 1;
}

/** Returns the 1st-of-month dates for every snap week in the scroller. */
function monthStartMonths(weeks: readonly string[]): string[] {
    return monthStartWeekIndexes(weeks).map((index) => monthForStartWeek(weeks[index] ?? '1970-01-01'));
}

function monthStartWeekIndexes(weeks: readonly string[]): number[] {
    const indexes: number[] = [];
    for (let index = 0; index < weeks.length; index++) {
        const weekMonday = weeks[index];
        if (weekMonday && isMonthStartWeek(weekMonday)) {
            indexes.push(index);
        }
    }
    return indexes;
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
    monthReelIndex,
    monthStartMonths,
    nearestMonthStartWeekIndex,
    startOfMonth,
    startOfWeek,
    visibleMonthForWeekOffset,
};
export type { MonthDay, MonthWeek };
