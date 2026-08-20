import { describe, expect, it } from 'vitest';
import { indexCalendarItemsByDate, shouldRenderCalendarPage } from './calendarViewModel.ts';

describe('indexCalendarItemsByDate', () => {
    it('groups items once for constant-time day lookups', () => {
        const first = { id: 'first', date: '2026-08-20' };
        const second = { id: 'second', date: '2026-08-21' };
        const third = { id: 'third', date: '2026-08-20' };

        const indexed = indexCalendarItemsByDate([first, second, third]);

        expect(indexed.get('2026-08-20')).toEqual([first, third]);
        expect(indexed.get('2026-08-21')).toEqual([second]);
        expect(indexed.get('2026-08-22')).toBeUndefined();
    });
});

describe('shouldRenderCalendarPage', () => {
    it('limits expensive page contents to the current page and its neighbors', () => {
        expect(shouldRenderCalendarPage(10, 12)).toBe(true);
        expect(shouldRenderCalendarPage(12, 12)).toBe(true);
        expect(shouldRenderCalendarPage(14, 12)).toBe(true);
        expect(shouldRenderCalendarPage(9, 12)).toBe(false);
        expect(shouldRenderCalendarPage(15, 12)).toBe(false);
    });
});
