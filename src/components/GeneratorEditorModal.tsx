import { useParams } from '@solidjs/router';
import { Show } from 'solid-js';
import { useAppNavigate } from '../routing/navigation.ts';
import { Dialog } from './Dialog.tsx';
import { GeneratorEditor } from './GeneratorEditor.tsx';

function GeneratorEditorModal() {
    const params = useParams();
    const { toGeneratorsList } = useAppNavigate();

    return (
        <Show when={params.id}>
            <Dialog open={true} onClose={toGeneratorsList} title="Generator">
                <GeneratorEditor onClose={toGeneratorsList} />
            </Dialog>
        </Show>
    );
}

export { GeneratorEditorModal };
