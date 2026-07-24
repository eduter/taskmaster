import { withDbRead } from '../db/dbLifecycle.ts';
import { getAllGenerators } from '../db/generators.ts';
import { getTasksForDateRange } from '../db/tasks.ts';
import type { Task } from '../db/types.ts';
import { projectGeneratorTasks, type ProjectedTask } from './project.ts';

/** Concrete and projected tasks loaded for one calendar range. */
interface CalendarRangeData {
    scheduled: Task[];
    projected: ProjectedTask[];
}

/** Loads persisted tasks and computed generator projections for an inclusive range. */
async function loadCalendarRange(start: string, end: string, today: string): Promise<CalendarRangeData> {
    return withDbRead(async () => {
        const [scheduled, generators] = await Promise.all([getTasksForDateRange(start, end), getAllGenerators()]);
        return {
            scheduled,
            projected: projectGeneratorTasks(generators, scheduled, start, end, today),
        };
    });
}

export { loadCalendarRange };
export type { CalendarRangeData };
