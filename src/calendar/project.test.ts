import { describe, expect, it } from 'vitest';
import type { Generator, Task } from '../db/types.ts';
import { projectGeneratorTasks } from './project.ts';

function generator(overrides: Partial<Generator> = {}): Generator {
    return {
        id: 'daily',
        name: 'Daily chores',
        rrule: 'DTSTART:20260720T120000Z\nRRULE:FREQ=DAILY',
        templates: [
            { summary: 'First', description: '', labelIds: ['home'] },
            { summary: 'Second', description: '', labelIds: [] },
        ],
        active: true,
        lastGeneratedDate: '2026-07-24',
        createdAt: Date.parse('2026-07-20T12:00:00Z'),
        updatedAt: 1,
        ...overrides,
    };
}

function task(overrides: Partial<Task> = {}): Task {
    return {
        id: 'existing',
        summary: 'Existing',
        description: '',
        labelIds: [],
        date: '2026-07-26',
        sortOrder: 1,
        completed: false,
        completedAt: null,
        createdAt: 1,
        updatedAt: 1,
        generatorId: 'daily',
        parentTaskId: null,
        ...overrides,
    };
}

describe('projectGeneratorTasks', () => {
    it('projects active generator templates after today', () => {
        const projected = projectGeneratorTasks([generator()], [], '2026-07-24', '2026-07-27', '2026-07-24');

        expect(projected.map((item) => [item.date, item.summary])).toEqual([
            ['2026-07-25', 'First'],
            ['2026-07-25', 'Second'],
            ['2026-07-26', 'First'],
            ['2026-07-26', 'Second'],
            ['2026-07-27', 'First'],
            ['2026-07-27', 'Second'],
        ]);
    });

    it('does not duplicate a date that already has a generated task', () => {
        const projected = projectGeneratorTasks([generator()], [task()], '2026-07-25', '2026-07-27', '2026-07-24');

        expect(projected.map((item) => item.date)).toEqual([
            '2026-07-25',
            '2026-07-25',
            '2026-07-27',
            '2026-07-27',
        ]);
    });

    it('skips inactive generators and dates already generated', () => {
        const projected = projectGeneratorTasks(
            [generator({ active: false }), generator({ id: 'caught-up', lastGeneratedDate: '2026-07-27' })],
            [],
            '2026-07-24',
            '2026-07-27',
            '2026-07-24'
        );

        expect(projected).toEqual([]);
    });
});
