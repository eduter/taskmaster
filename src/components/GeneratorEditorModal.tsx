import { useParams } from '@solidjs/router';
import { Show } from 'solid-js';
import { useAppNavigate } from '../routing/navigation.ts';
import { GeneratorEditor } from './GeneratorEditor.tsx';
import './GeneratorEditorModal.css';

function GeneratorEditorModal() {
    const params = useParams();
    const { toGeneratorsList } = useAppNavigate();

    return (
        <Show when={params.id}>
            <div class="gen-editor-overlay">
                <button
                    type="button"
                    class="gen-editor-overlay__backdrop"
                    aria-label="Close generator editor"
                    onClick={toGeneratorsList}
                />
                <div class="gen-editor-panel">
                    <div class="gen-editor-panel__header">
                        <h2 class="gen-editor-panel__title">Generator</h2>
                        <button
                            type="button"
                            class="gen-editor-panel__close"
                            onClick={toGeneratorsList}
                            aria-label="Close"
                        >
                            &times;
                        </button>
                    </div>
                    <GeneratorEditor onClose={toGeneratorsList} />
                </div>
            </div>
        </Show>
    );
}

export { GeneratorEditorModal };
