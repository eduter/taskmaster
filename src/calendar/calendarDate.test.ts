import { describe, expect, it } from 'vitest';
import { addMonths, getISOWeekNumber, getMonthGrid, getWeekDates, indexOfMonthStartWeek, isMonthStartWeek, monthForStartWeek, startOfWeek, visibleMonthForWeekIndex } from './calendarDate.ts';

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

    it('identifies month-start weeks and resolves visible months while scrolling', () => {
        const weeks = ['2026-07-27', '2026-08-03', '2026-08-10', '2026-08-17', '2026-08-24', '2026-08-31'];

        expect(isMonthStartWeek('2026-07-27')).toBe(true);
        expect(isMonthStartWeek('2026-08-03')).toBe(false);
        expect(isMonthStartWeek('2026-08-31')).toBe(true);
        expect(monthForStartWeek('2026-07-27')).toBe('2026-08-01');
        expect(monthForStartWeek('2026-08-31')).toBe('2026-09-01');
        expect(visibleMonthForWeekIndex(weeks, 2)).toBe('2026-08-01');
        expect(visibleMonthForWeekIndex(weeks, 5)).toBe('2026-09-01');
        expect(indexOfMonthStartWeek(weeks, '2026-08-01')).toBe(0);
        expect(indexOfMonthStartWeek(weeks, '2026-09-01')).toBe(5);
    });
});
