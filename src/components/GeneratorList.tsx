import { For, Show } from 'solid-js';
import {
    generators,
    setEditingGeneratorId,
    setShowGeneratorList,
    showGeneratorList,
} from '../stores/generatorStore.ts';
import { GeneratorEditor } from './GeneratorEditor.tsx';
import './GeneratorList.css';

function GeneratorList() {
    return (
        <Show when={showGeneratorList()}>
            <div class="gen-overlay">
                <button
                    type="button"
                    class="gen-overlay__backdrop"
                    aria-label="Close generators"
                    onClick={() => setShowGeneratorList(false)}
                />
                <div class="gen-panel">
                    <div class="gen-panel__header">
                        <h2 class="gen-panel__title">Generators</h2>
                        <button
                            type="button"
                            class="gen-panel__close"
                            onClick={() => setShowGeneratorList(false)}
                            aria-label="Close"
                        >
                            &times;
                        </button>
                    </div>

                    <div class="gen-panel__list">
                        <Show
                            when={(generators() ?? []).length > 0}
                            fallback={<p class="gen-panel__empty">No generators yet.</p>}
                        >
                            <For each={generators() ?? []}>
                                {(gen) => (
                                    <button
                                        type="button"
                                        class="gen-panel__item"
                                        classList={{ 'gen-panel__item--inactive': !gen.active }}
                                        onClick={() => setEditingGeneratorId(gen.id)}
                                    >
                                        <span class="gen-panel__item-name">{gen.name}</span>
                                        <span class="gen-panel__item-count">
                                            {gen.templates.length} task{gen.templates.length !== 1 ? 's' : ''}
                                        </span>
                                    </button>
                                )}
                            </For>
                        </Show>
                    </div>

                    <div class="gen-panel__divider" />
                    <GeneratorEditor />
                </div>
            </div>
        </Show>
    );
}

export { GeneratorList };
