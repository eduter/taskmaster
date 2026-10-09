/** @vitest-environment jsdom */
import { MemoryRouter, Route, createMemoryHistory } from '@solidjs/router';
import { cleanup, render, screen } from '@solidjs/testing-library';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { refetchGenerators } from '../stores/generatorStore.ts';
import { resetDb, seedGenerator } from '../test/helpers.ts';
import { GeneratorEditor } from './GeneratorEditor.tsx';

describe('GeneratorEditor', () => {
    beforeEach(async () => {
        HTMLDialogElement.prototype.showModal = function showModal(): void {
            this.open = true;
        };
        HTMLDialogElement.prototype.close = function close(): void {
            this.open = false;
        };
        await resetDb();
        await seedGenerator({
            id: 'gen-1',
            name: 'Daily practice',
            rrule: 'FREQ=DAILY',
            templates: [{ summary: 'Practice piano', description: '', labelIds: [], checklistItems: [] }],
        });
    });

    afterEach(() => {
        cleanup();
    });

    it('hydrates the editor when loaded directly at a generator URL', async () => {
        // Start the store read but render before it resolves: a direct URL load
        // mounts the editor while the generator list is still loading.
        void refetchGenerators();

        const history = createMemoryHistory();
        history.set({ value: '/generators/gen-1', replace: true });

        const { container } = render(() => (
            <MemoryRouter history={history}>
                <Route path="/generators/:id" component={GeneratorEditor} />
            </MemoryRouter>
        ));

        expect(await screen.findByDisplayValue('Daily practice')).toBeTruthy();
        expect(await screen.findByText('Practice piano')).toBeTruthy();
        expect(container.querySelectorAll('.task-list__item')).toHaveLength(1);
    });
});
