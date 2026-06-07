import { db } from '../db/database.ts';
import { getActiveGenerators, updateGenerator } from '../db/generators.ts';
import { createTask } from '../db/tasks.ts';
import { getLogicalDay } from '../utils/logicalDay.ts';
import { getGenerationStartDate, parseGeneratorRule, toISODate } from './rruleHelpers.ts';

interface GeneratorRunOutcome {
    created: number;
    generatorIds: string[];
}

async function taskExistsForGeneratorDate(generatorId: string, date: string): Promise<boolean> {
    const count = await db.tasks.filter((t) => t.generatorId === generatorId && t.date === date).count();
    return count > 0;
}

async function runGenerators(today: string = getLogicalDay()): Promise<GeneratorRunOutcome> {
    const generators = await getActiveGenerators();
    let created = 0;
    const generatorIds: string[] = [];

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
            if (await taskExistsForGeneratorDate(gen.id, dateStr)) {
                continue;
            }
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

        generatorIds.push(gen.id);
    }

    return { created, generatorIds };
}

async function commitGeneratorRuns(generatorIds: string[], today: string): Promise<void> {
    for (const id of generatorIds) {
        await updateGenerator(id, { lastGeneratedDate: today });
    }
}

export type { GeneratorRunOutcome };
export { commitGeneratorRuns, runGenerators };
