import { createSignal, For, Index, Show } from 'solid-js';
import type { Label } from '../../db/types.ts';
import trashIcon from '../../icons/trash.svg?raw';
import { defaultLabelColor } from './palette.ts';
import { addLabel, editLabel, labels, removeLabel } from '../../stores/labelStore.ts';
import { generateId } from '../../utils/id.ts';
import { ColorPicker } from './ColorPicker.tsx';
import { Dialog } from '../Dialog.tsx';
import { Icon } from '../Icon.tsx';
import './LabelsDialog.css';

type LabelDraft =
    | { kind: 'existing'; id: string; name: string; color: string }
    | { kind: 'new'; tempId: string; name: string; color: string };

interface LabelsDialogProps {
    open: boolean;
    onClose: () => void;
    selectedLabelIds: string[];
    onToggleLabel: (labelId: string) => void | Promise<void>;
    onDeleteLabel?: (labelId: string) => void | Promise<void>;
    stackLevel?: number;
}

function labelsToDraft(source: Label[]): LabelDraft[] {
    return source.map((label) => ({
        kind: 'existing',
        id: label.id,
        name: label.name,
        color: label.color,
    }));
}

function draftColors(draft: LabelDraft[]): string[] {
    return draft.map((row) => row.color);
}

function draftKey(row: LabelDraft): string {
    return `${row.name.trim().toLowerCase()}\0${row.color}`;
}

function hasDuplicateDrafts(draft: LabelDraft[]): boolean {
    const seen = new Set<string>();
    for (const row of draft) {
        const key = draftKey(row);
        if (seen.has(key)) {
            return true;
        }
        seen.add(key);
    }
    return false;
}

function draftRowId(row: LabelDraft): string {
    return row.kind === 'existing' ? row.id : row.tempId;
}

/** Modal for toggling labels on an entity and batch-editing label definitions. */
function LabelsDialog(props: LabelsDialogProps) {
    const [editing, setEditing] = createSignal(false);
    const [draft, setDraft] = createSignal<LabelDraft[]>([]);
    const [saveError, setSaveError] = createSignal('');

    function enterEditMode() {
        setDraft(labelsToDraft(labels() ?? []));
        setSaveError('');
        setEditing(true);
    }

    function cancelEdit() {
        setEditing(false);
        setDraft([]);
        setSaveError('');
    }

    function handleClose() {
        cancelEdit();
        props.onClose();
    }

    function updateDraftRow(rowId: string, patch: Partial<Pick<LabelDraft, 'name' | 'color'>>) {
        setDraft((rows) =>
            rows.map((row) => {
                if (draftRowId(row) !== rowId) {
                    return row;
                }
                return { ...row, ...patch };
            })
        );
    }

    function removeDraftRow(rowId: string) {
        setDraft((rows) => rows.filter((row) => draftRowId(row) !== rowId));
    }

    function addDraftRow() {
        const colors = draftColors(draft());
        setDraft((rows) => [
            ...rows,
            { kind: 'new', tempId: generateId(), name: '', color: defaultLabelColor(colors) },
        ]);
    }

    async function saveDraft() {
        const rows = draft();
        if (hasDuplicateDrafts(rows)) {
            setSaveError('Two labels share the same name and color.');
            return;
        }

        const snapshot = labels() ?? [];
        const snapshotById = new Map(snapshot.map((label) => [label.id, label]));
        const keptExistingIds = new Set(
            rows
                .filter((row): row is Extract<LabelDraft, { kind: 'existing' }> => row.kind === 'existing')
                .map((row) => row.id)
        );

        for (const label of snapshot) {
            if (!keptExistingIds.has(label.id)) {
                await removeLabel(label.id);
                await props.onDeleteLabel?.(label.id);
            }
        }

        for (const row of rows) {
            if (row.kind !== 'existing') {
                continue;
            }
            const original = snapshotById.get(row.id);
            if (!original) {
                continue;
            }
            const name = row.name.trim();
            if (name !== original.name || row.color !== original.color) {
                await editLabel(row.id, { name, color: row.color });
            }
        }

        for (const row of rows) {
            if (row.kind === 'new') {
                await addLabel(row.name.trim(), row.color);
            }
        }

        cancelEdit();
    }

    function deleteAriaLabel(row: LabelDraft): string {
        const name = row.name.trim();
        return name ? `Delete label ${name}` : 'Delete unnamed label';
    }

    return (
        <Show when={props.open}>
            <Dialog open={true} onClose={handleClose} title="Labels" stackLevel={props.stackLevel ?? 0}>
                <Show
                    when={!editing()}
                    fallback={
                        <div class="labels-dialog__edit">
                            <ul class="labels-dialog__edit-list">
                                <Index each={draft()}>
                                    {(row) => {
                                        const rowId = () => draftRowId(row());
                                        return (
                                            <li class="labels-dialog__edit-row">
                                                <ColorPicker
                                                    value={row().color}
                                                    onChange={(color) => updateDraftRow(rowId(), { color })}
                                                    aria-label="Label color"
                                                />
                                                <input
                                                    class="form-input labels-dialog__name-input"
                                                    type="text"
                                                    placeholder="Label name"
                                                    value={row().name}
                                                    onInput={(e) =>
                                                        updateDraftRow(rowId(), { name: e.currentTarget.value })
                                                    }
                                                />
                                                <button
                                                    type="button"
                                                    class="labels-dialog__delete"
                                                    aria-label={deleteAriaLabel(row())}
                                                    onClick={() => removeDraftRow(rowId())}
                                                >
                                                    <Icon src={trashIcon} width={18} height={18} />
                                                </button>
                                            </li>
                                        );
                                    }}
                                </Index>
                            </ul>
                            <button type="button" class="labels-dialog__add btn btn--secondary" onClick={addDraftRow}>
                                +
                            </button>
                            <Show when={saveError()}>
                                <p class="labels-dialog__error" role="alert">
                                    {saveError()}
                                </p>
                            </Show>
                            <div class="labels-dialog__actions">
                                <button
                                    type="button"
                                    class="btn btn--primary btn--grow"
                                    onClick={() => void saveDraft()}
                                >
                                    Save
                                </button>
                                <button type="button" class="btn btn--secondary btn--grow" onClick={cancelEdit}>
                                    Cancel
                                </button>
                            </div>
                        </div>
                    }
                >
                    <div class="labels-dialog__select">
                        <Show
                            when={(labels() ?? []).length > 0}
                            fallback={<p class="labels-dialog__empty">No labels yet.</p>}
                        >
                            <ul class="labels-dialog__select-list">
                                <For each={labels() ?? []}>
                                    {(label) => (
                                        <li>
                                            <label class="labels-dialog__select-item">
                                                <input
                                                    type="checkbox"
                                                    checked={props.selectedLabelIds.includes(label.id)}
                                                    onChange={() => props.onToggleLabel(label.id)}
                                                />
                                                <span
                                                    class="labels-dialog__select-chip label-surface"
                                                    classList={{ 'labels-dialog__select-chip--unnamed': !label.name }}
                                                    style={{ '--label-color': label.color }}
                                                >
                                                    {label.name || undefined}
                                                </span>
                                            </label>
                                        </li>
                                    )}
                                </For>
                            </ul>
                        </Show>
                        <button type="button" class="btn btn--secondary labels-dialog__manage" onClick={enterEditMode}>
                            Manage labels
                        </button>
                    </div>
                </Show>
            </Dialog>
        </Show>
    );
}

export type { LabelsDialogProps };
export { LabelsDialog };
