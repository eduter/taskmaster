import { describe, expect, it } from 'vitest';
import { addMonths, getISOWeekNumber, getMonthGrid, getWeekDates, startOfWeek } from './calendarDate.ts';

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
});
