import { useParams } from '@solidjs/router';
import { Show } from 'solid-js';
import { useAppNavigate } from '../routing/navigation.ts';
import { Dialog } from './Dialog.tsx';
import { GeneratorEditor } from './GeneratorEditor.tsx';

function GeneratorEditorModal() {
    const params = useParams();
    const { closeGeneratorDetail } = useAppNavigate();

    return (
        <Show when={params.id}>
            <Dialog open={true} onClose={closeGeneratorDetail} title="Generator">
                <GeneratorEditor onClose={closeGeneratorDetail} />
            </Dialog>
        </Show>
    );
}

export { GeneratorEditorModal };
