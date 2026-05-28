import { RRule } from 'rrule';
import { addDays } from '../utils/logicalDay.ts';
import type { Generator } from '../db/types.ts';

function parseGeneratorRule(gen: Generator): RRule {
    try {
        if (gen.rrule.includes('DTSTART:')) {
            return RRule.fromString(gen.rrule) as RRule;
        }
        throw new Error('Fallback');
    } catch {
        const options = RRule.parseString(gen.rrule);
        if (!options.dtstart) {
            options.dtstart = new Date(gen.createdAt);
        }
        return new RRule(options);
    }
}

function getDtStartDate(gen: Generator): string {
    const rule = parseGeneratorRule(gen);
    const dtstart = rule.options.dtstart;
    if (!dtstart) {
        return toISODate(new Date(gen.createdAt));
    }
    return toISODate(dtstart);
}

function getGenerationStartDate(gen: Generator): string {
    if (gen.lastGeneratedDate) {
        return addDays(gen.lastGeneratedDate, 1);
    }
    return getDtStartDate(gen);
}

function toISODate(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

export { parseGeneratorRule, getGenerationStartDate, getDtStartDate, toISODate };
