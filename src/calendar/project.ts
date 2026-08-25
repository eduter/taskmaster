import type { Generator, Task } from '../db/types.ts';
import { getGenerationStartDate, parseGeneratorRule, toISODate } from '../scheduling/rruleHelpers.ts';
import { addDays } from '../utils/logicalDay.ts';

/** A read-only task template occurrence that has not been persisted. */
interface ProjectedTask {
    kind: 'projected';
    id: string;
    date: string;
    summary: string;
    description: string;
    labelIds: string[];
    generatorId: string;
    generatorName: string;
    templateIndex: number;
}

/** Expands active generators into read-only future task occurrences. */
function projectGeneratorTasks(
    generators: Generator[],
    tasks: Task[],
    rangeStart: string,
    rangeEnd: string,
    today: string
): ProjectedTask[] {
    const existing = new Set(tasks.flatMap((task) => (task.generatorId ? [`${task.generatorId}:${task.date}`] : [])));
    const projected: ProjectedTask[] = [];

    for (const generator of generators) {
        if (!generator.active) {
            continue;
        }

        const firstUngenerated = getGenerationStartDate(generator);
        const start = latestDate(rangeStart, addDays(today, 1), firstUngenerated);
        if (start > rangeEnd) {
            continue;
        }

        const occurrences = parseGeneratorRule(generator).between(parseDate(start), parseDate(rangeEnd), true);
        for (const occurrence of occurrences) {
            const date = toISODate(occurrence);
            if (existing.has(`${generator.id}:${date}`)) {
                continue;
            }

            for (const [templateIndex, template] of generator.templates.entries()) {
                projected.push({
                    kind: 'projected',
                    id: `projected:${generator.id}:${date}:${templateIndex}`,
                    date,
                    summary: template.summary,
                    description: template.description,
                    labelIds: template.labelIds,
                    generatorId: generator.id,
                    generatorName: generator.name,
                    templateIndex,
                });
            }
        }
    }

    return projected.sort(
        (left, right) =>
            left.date.localeCompare(right.date) ||
            left.generatorName.localeCompare(right.generatorName) ||
            left.templateIndex - right.templateIndex
    );
}

function latestDate(...dates: string[]): string {
    return dates.reduce((latest, date) => (date > latest ? date : latest));
}

function parseDate(date: string): Date {
    // Match rrule DTSTART/occurrence instants (UTC noon), not local noon
    return new Date(`${date}T12:00:00Z`);
}

export { projectGeneratorTasks };
export type { ProjectedTask };
