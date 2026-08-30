/** @vitest-environment jsdom */
import { cleanup, render } from '@solidjs/testing-library';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Task } from '../db/types.ts';
import { TodayTabIcon } from './TodayTabIcon.tsx';

const taskState = vi.hoisted(() => ({
    tasks: [] as Task[] | undefined,
}));

vi.mock('../stores/taskStore.ts', () => ({
    tasks: () => taskState.tasks,
}));

function makeTask(overrides: Partial<Task> & Pick<Task, 'id'>): Task {
    return {
        summary: 'Task',
        description: '',
        labelIds: [],
        date: '2026-08-30',
        sortOrder: 0,
        completed: false,
        completedAt: null,
        createdAt: 0,
        updatedAt: 0,
        generatorId: null,
        parentTaskId: null,
        checklistItems: [],
        ...overrides,
    };
}

function dasharrayValues(element: Element | null): [number, number] | null {
    const value = element?.getAttribute('stroke-dasharray');
    if (!value) {
        return null;
    }

    const [filled, total] = value.split(/\s+/).map(Number);
    return [filled, total];
}

afterEach(() => {
    cleanup();
    taskState.tasks = [];
});

describe('TodayTabIcon', () => {
    it('shows an empty red ring when there are no tasks', () => {
        taskState.tasks = [];

        const result = render(() => <TodayTabIcon />);
        const icon = result.container.querySelector('.today-tab-icon') as HTMLElement;

        expect(icon.style.getPropertyValue('--completion-rate')).toBe('0');
        expect(icon.style.getPropertyValue('--completion-color')).toBe('#f87171');
        const dasharray = dasharrayValues(result.container.querySelector('.today-tab-icon__progress'));
        expect(dasharray?.[0]).toBe(0);
        expect(dasharray?.[1]).toBeCloseTo(50.265, 2);
    });

    it('fills half the ring when half of today tasks are complete', () => {
        taskState.tasks = [makeTask({ id: 'a', completed: true }), makeTask({ id: 'b', completed: false })];

        const result = render(() => <TodayTabIcon />);
        const icon = result.container.querySelector('.today-tab-icon') as HTMLElement;

        expect(icon.style.getPropertyValue('--completion-rate')).toBe('0.5');
        const dasharray = dasharrayValues(result.container.querySelector('.today-tab-icon__progress'));
        expect(dasharray?.[0]).toBeCloseTo(25.133, 2);
        expect(dasharray?.[1]).toBeCloseTo(50.265, 2);
    });

    it('fills the full ring in success green when every task is complete', () => {
        taskState.tasks = [makeTask({ id: 'a', completed: true }), makeTask({ id: 'b', completed: true })];

        const result = render(() => <TodayTabIcon />);
        const icon = result.container.querySelector('.today-tab-icon') as HTMLElement;

        expect(icon.style.getPropertyValue('--completion-rate')).toBe('1');
        expect(icon.style.getPropertyValue('--completion-color')).toBe('#34d399');
        const dasharray = dasharrayValues(result.container.querySelector('.today-tab-icon__progress'));
        expect(dasharray?.[0]).toBeCloseTo(50.265, 2);
        expect(dasharray?.[1]).toBeCloseTo(50.265, 2);
    });
});
