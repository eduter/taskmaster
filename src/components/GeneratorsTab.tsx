import { createMemo, For, Show } from 'solid-js';
import type { Generator } from '../db/types.ts';
import { parseGeneratorRule } from '../scheduling/rruleHelpers.ts';
import { useAppNavigate } from '../routing/navigation.ts';
import { generators } from '../stores/generatorStore.ts';
import './GeneratorsTab.css';

function scheduleLabel(gen: Generator): string {
    try {
        return parseGeneratorRule(gen).toText();
    } catch {
        return gen.rrule;
    }
}

function GeneratorsTab() {
    const { toGenerator } = useAppNavigate();
    const sortedGenerators = createMemo(() => [...(generators() ?? [])].sort((a, b) => a.name.localeCompare(b.name)));

    return (
        <div class="generators-tab">
            <div class="generators-tab__header">
                <button
                    type="button"
                    class="generators-tab__add"
                    onClick={() => toGenerator('new')}
                    aria-label="New generator"
                >
                    <svg viewBox="0 0 20 20" width="20" height="20" fill="none" aria-hidden="true">
                        <path d="M10 3v14M3 10h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
                    </svg>
                </button>
            </div>

            <div class="generators-tab__list">
                <Show
                    when={(generators() ?? []).length > 0}
                    fallback={<p class="generators-tab__empty">No generators yet.</p>}
                >
                    <For each={sortedGenerators()}>
                        {(gen) => (
                            <button
                                type="button"
                                class="generators-tab__item"
                                classList={{ 'generators-tab__item--inactive': !gen.active }}
                                onClick={() => toGenerator(gen.id)}
                            >
                                <span class="generators-tab__item-main">
                                    <span class="generators-tab__item-name">{gen.name}</span>
                                    <span class="generators-tab__item-schedule">{scheduleLabel(gen)}</span>
                                </span>
                                <span class="generators-tab__item-count">
                                    {gen.templates.length} task{gen.templates.length !== 1 ? 's' : ''}
                                </span>
                            </button>
                        )}
                    </For>
                </Show>
            </div>
        </div>
    );
}

export { GeneratorsTab };
