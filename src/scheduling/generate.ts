import { getActiveGenerators, updateGenerator } from '../db/generators.ts';
import { createTask } from '../db/tasks.ts';
import { getLogicalDay } from '../utils/logicalDay.ts';
import { getGenerationStartDate, parseGeneratorRule, toISODate } from './rruleHelpers.ts';

async function runGenerators(today: string = getLogicalDay()): Promise<number> {
    const generators = await getActiveGenerators();
    let created = 0;

    for (const gen of generators) {
        const startDate = getGenerationStartDate(gen);
        if (startDate > today) {
            continue;
        }

        const rule = parseGeneratorRule(gen);
        const start = new Date(`${startDate}T00:00:00`);
        const end = new Date(`${today}T23:59:59`);
        const occurrences = rule.between(start, end, true);

        for (const occ of occurrences) {
            const dateStr = toISODate(occ);
            for (const tmpl of gen.templates) {
                await createTask({
                    summary: tmpl.summary,
                    description: tmpl.description,
                    labels: tmpl.labels,
                    date: dateStr,
                    generatorId: gen.id,
                });
                created++;
            }
        }

        await updateGenerator(gen.id, { lastGeneratedDate: today });
    }

    return created;
}

export { runGenerators };
