import { describe, expect, it } from 'vitest';
import {
    addMonths,
    getISOWeekNumber,
    getMonthGrid,
    getWeekDates,
    indexOfMonthStartWeek,
    isMonthStartWeek,
    monthForStartWeek,
    monthReelIndex,
    nearestMonthStartWeekIndex,
    startOfWeek,
    visibleMonthForWeekOffset,
} from './calendarDate.ts';

const AUGUST_TO_OCTOBER_WEEKS = [
    '2026-07-27',
    '2026-08-03',
    '2026-08-10',
    '2026-08-17',
    '2026-08-24',
    '2026-08-31',
    '2026-09-07',
    '2026-09-14',
    '2026-09-21',
    '2026-09-28',
];

describe('calendar dates', () => {
    it('starts weeks on Monday', () => {
        expect(startOfWeek('2026-07-24')).toBe('2026-07-20');
        expect(startOfWeek('2026-07-26')).toBe('2026-07-20');
        expect(getWeekDates('2026-07-24')).toEqual([
            '2026-07-20',
            '2026-07-21',
            '2026-07-22',
            '2026-07-23',
            '2026-07-24',
            '2026-07-25',
            '2026-07-26',
        ]);
    });

    it('uses ISO week numbers across year boundaries', () => {
        expect(getISOWeekNumber('2020-12-31')).toBe(53);
        expect(getISOWeekNumber('2021-01-01')).toBe(53);
        expect(getISOWeekNumber('2021-01-04')).toBe(1);
    });

    it('builds a stable six-week month grid with adjacent dates', () => {
        const grid = getMonthGrid('2026-08-14');

        expect(grid).toHaveLength(6);
        expect(grid[0]?.weekNumber).toBe(31);
        expect(grid[0]?.days[0]).toEqual({ date: '2026-07-27', inMonth: false });
        expect(grid[5]?.days[6]).toEqual({ date: '2026-09-06', inMonth: false });
    });

    it('adds months without carrying short months forward', () => {
        expect(addMonths('2026-01-31', 1)).toBe('2026-02-01');
        expect(addMonths('2026-12-01', 1)).toBe('2027-01-01');
    });

    it('identifies month-start weeks and their headlines', () => {
        expect(isMonthStartWeek('2026-07-27')).toBe(true);
        expect(isMonthStartWeek('2026-08-03')).toBe(false);
        expect(isMonthStartWeek('2026-08-31')).toBe(true);
        expect(monthForStartWeek('2026-07-27')).toBe('2026-08-01');
        expect(monthForStartWeek('2026-08-31')).toBe('2026-09-01');
        expect(indexOfMonthStartWeek(AUGUST_TO_OCTOBER_WEEKS, '2026-08-01')).toBe(0);
        expect(indexOfMonthStartWeek(AUGUST_TO_OCTOBER_WEEKS, '2026-09-01')).toBe(5);
        expect(indexOfMonthStartWeek(AUGUST_TO_OCTOBER_WEEKS, '2026-10-01')).toBe(9);
    });

    it('snaps the visible month to the nearest month-start week', () => {
        // August starts at 0, September at 5 (5 weeks), October at 9 (4 weeks).
        expect(nearestMonthStartWeekIndex(AUGUST_TO_OCTOBER_WEEKS, 0)).toBe(0);
        expect(nearestMonthStartWeekIndex(AUGUST_TO_OCTOBER_WEEKS, 2.4)).toBe(0);
        expect(nearestMonthStartWeekIndex(AUGUST_TO_OCTOBER_WEEKS, 2.5)).toBe(5);
        expect(nearestMonthStartWeekIndex(AUGUST_TO_OCTOBER_WEEKS, 4.4)).toBe(5);
        expect(nearestMonthStartWeekIndex(AUGUST_TO_OCTOBER_WEEKS, 5)).toBe(5);
        expect(nearestMonthStartWeekIndex(AUGUST_TO_OCTOBER_WEEKS, 6.9)).toBe(5);
        expect(nearestMonthStartWeekIndex(AUGUST_TO_OCTOBER_WEEKS, 7)).toBe(9);
        expect(nearestMonthStartWeekIndex(AUGUST_TO_OCTOBER_WEEKS, 9)).toBe(9);

        expect(visibleMonthForWeekOffset(AUGUST_TO_OCTOBER_WEEKS, 2.4)).toBe('2026-08-01');
        expect(visibleMonthForWeekOffset(AUGUST_TO_OCTOBER_WEEKS, 4.4)).toBe('2026-09-01');
        expect(visibleMonthForWeekOffset(AUGUST_TO_OCTOBER_WEEKS, 6.9)).toBe('2026-09-01');
        expect(visibleMonthForWeekOffset(AUGUST_TO_OCTOBER_WEEKS, 7)).toBe('2026-10-01');
    });

    it('maps scroll offset onto a month reel that stays in sync with snap progress', () => {
        expect(monthReelIndex(AUGUST_TO_OCTOBER_WEEKS, 0)).toBe(0);
        expect(monthReelIndex(AUGUST_TO_OCTOBER_WEEKS, 2.5)).toBe(0.5);
        expect(monthReelIndex(AUGUST_TO_OCTOBER_WEEKS, 5)).toBe(1);
        expect(monthReelIndex(AUGUST_TO_OCTOBER_WEEKS, 7)).toBe(1.5);
        expect(monthReelIndex(AUGUST_TO_OCTOBER_WEEKS, 9)).toBe(2);
        expect(monthReelIndex(AUGUST_TO_OCTOBER_WEEKS, -1)).toBe(0);
        expect(monthReelIndex(AUGUST_TO_OCTOBER_WEEKS, 20)).toBe(2);
    });
});
