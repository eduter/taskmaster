import { describe, expect, it } from 'vitest';
import { formatFullDate, formatRelativeDay } from './formatLogicalDay.ts';

describe('formatRelativeDay', () => {
    it('uses Today, Tomorrow, and Yesterday for nearby days', () => {
        expect(formatRelativeDay('2026-08-24', '2026-08-24')).toBe('Today');
        expect(formatRelativeDay('2026-08-25', '2026-08-24')).toBe('Tomorrow');
        expect(formatRelativeDay('2026-08-23', '2026-08-24')).toBe('Yesterday');
    });

    it('falls back to the full weekday date for anything else', () => {
        expect(formatRelativeDay('2026-08-28', '2026-08-24')).toBe(formatFullDate('2026-08-28'));
    });
});

describe('formatFullDate', () => {
    it('matches the calendar day-dialog style', () => {
        expect(formatFullDate('2026-08-28')).toBe(
            new Intl.DateTimeFormat(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
            }).format(new Date('2026-08-28T12:00:00'))
        );
    });
});
