import { Show } from 'solid-js';
import { setEditingGeneratorId, setShowGeneratorEditor, showGeneratorEditor } from '../stores/generatorStore.ts';
import { GeneratorEditor } from './GeneratorEditor.tsx';
import './GeneratorEditorModal.css';

function closeEditor() {
    setShowGeneratorEditor(false);
    setEditingGeneratorId(null);
}

function GeneratorEditorModal() {
    return (
        <Show when={showGeneratorEditor()}>
            <div class="gen-editor-overlay">
                <button
                    type="button"
                    class="gen-editor-overlay__backdrop"
                    aria-label="Close generator editor"
                    onClick={closeEditor}
                />
                <div class="gen-editor-panel">
                    <div class="gen-editor-panel__header">
                        <h2 class="gen-editor-panel__title">Generator</h2>
                        <button type="button" class="gen-editor-panel__close" onClick={closeEditor} aria-label="Close">
                            &times;
                        </button>
                    </div>
                    <GeneratorEditor onClose={closeEditor} />
                </div>
            </div>
        </Show>
    );
}

export { GeneratorEditorModal };
