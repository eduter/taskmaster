import { createSignal, onMount, Show, type JSX } from 'solid-js';
import checkIcon from '../icons/check.svg?raw';
import plusIcon from '../icons/plus.svg?raw';
import { GestureRow } from './GestureRow.tsx';
import { Icon } from './Icon.tsx';
import { TaskLikeSortableList } from './TaskLikeSortableList.tsx';
import './ChecklistEditor.css';

interface ChecklistEditorItem {
    id: string;
    summary: string;
    completed?: boolean;
}

interface ChecklistEditorProps {
    items: ChecklistEditorItem[];
    startAdding?: boolean;
    onAdd: (summary: string) => void | Promise<void>;
    onRename: (id: string, summary: string) => void | Promise<void>;
    onToggle?: (id: string) => void | Promise<void>;
    onDelete: (id: string) => void | Promise<void>;
    onReorder: (orderedIds: string[]) => void | Promise<void>;
}

/** Inline checklist editor with the same gestures as the main task list. */
function ChecklistEditor(props: ChecklistEditorProps): JSX.Element {
    const [editingId, setEditingId] = createSignal<string | null>(null);
    const [editingSummary, setEditingSummary] = createSignal('');
    const [adding, setAdding] = createSignal(false);
    const [newSummary, setNewSummary] = createSignal('');

    onMount(() => {
        if (props.startAdding) {
            beginAdd();
        }
    });

    function beginAdd(): void {
        setEditingId(null);
        setNewSummary('');
        setAdding(true);
    }

    function commitAdd(): void {
        if (!adding()) {
            return;
        }

        const summary = newSummary().trim();
        setAdding(false);
        setNewSummary('');
        if (summary) {
            void props.onAdd(summary);
        }
    }

    function beginEdit(item: ChecklistEditorItem): void {
        setAdding(false);
        setEditingSummary(item.summary);
        setEditingId(item.id);
    }

    function commitEdit(): void {
        const id = editingId();
        if (!id) {
            return;
        }

        const summary = editingSummary().trim();
        const current = props.items.find((item) => item.id === id);
        setEditingId(null);
        if (summary && summary !== current?.summary) {
            void props.onRename(id, summary);
        }
    }

    function cancelInput(): void {
        setAdding(false);
        setEditingId(null);
        setNewSummary('');
    }

    function handleInputKeyDown(event: KeyboardEvent, commit: () => void): void {
        if (event.key === 'Enter') {
            event.preventDefault();
            commit();
        } else if (event.key === 'Escape') {
            event.preventDefault();
            cancelInput();
        }
    }

    return (
        <section class="checklist-editor" aria-label="Checklist">
            <span class="form-label">Checklist</span>
            <div class="form-field-body checklist-editor__body">
                <Show when={props.items.length > 0}>
                    <TaskLikeSortableList
                        items={props.items}
                        onReorder={props.onReorder}
                        renderRow={(item, row) => (
                            <GestureRow
                                id={item.id}
                                deleteRevealed={row.deleteRevealed}
                                deleteLabel={`Delete ${item.summary} from checklist`}
                                completed={item.completed}
                                allowCheckSwipe={editingId() !== item.id && !item.completed && !!props.onToggle}
                                onRevealChange={row.onRevealChange}
                                onRowTouchStart={row.onRowTouchStart}
                                onOpen={() => beginEdit(item)}
                                onDelete={() => props.onDelete(item.id)}
                                onComplete={props.onToggle ? () => props.onToggle?.(item.id) : undefined}
                                renderContent={(state) => (
                                    <>
                                        <ChecklistItemContent
                                            item={item}
                                            editing={editingId() === item.id}
                                            editingSummary={editingSummary()}
                                            visualCompleted={state.visualCompleted}
                                            showCheck={!!props.onToggle}
                                            onEditingSummaryChange={setEditingSummary}
                                            onCommitEdit={commitEdit}
                                            onCancel={cancelInput}
                                            onToggle={props.onToggle}
                                        />
                                        {state.showStrike && (
                                            <div
                                                class="task-row__strike checklist-editor__strike"
                                                style={{ width: state.strikeWidth }}
                                                aria-hidden="true"
                                            />
                                        )}
                                    </>
                                )}
                            />
                        )}
                        renderOverlay={(item) => (
                            <ChecklistItemContent
                                item={item}
                                editing={false}
                                editingSummary=""
                                visualCompleted={item.completed ?? false}
                                showCheck={!!props.onToggle}
                                onEditingSummaryChange={() => {}}
                                onCommitEdit={() => {}}
                                onCancel={() => {}}
                                onToggle={props.onToggle}
                            />
                        )}
                    />
                </Show>

                <Show
                    when={adding()}
                    fallback={
                        <button type="button" class="add-icon-btn" aria-label="Add checklist item" onClick={beginAdd}>
                            <Icon src={plusIcon} width={16} height={16} />
                        </button>
                    }
                >
                    <input
                        ref={focusInput}
                        class="checklist-editor__input checklist-editor__new-input"
                        aria-label="New checklist item"
                        value={newSummary()}
                        onInput={(event) => setNewSummary(event.currentTarget.value)}
                        onKeyDown={(event) => handleInputKeyDown(event, commitAdd)}
                        onBlur={commitAdd}
                    />
                </Show>
            </div>
        </section>
    );
}

interface ChecklistItemContentProps {
    item: ChecklistEditorItem;
    editing: boolean;
    editingSummary: string;
    visualCompleted: boolean;
    showCheck: boolean;
    onEditingSummaryChange: (summary: string) => void;
    onCommitEdit: () => void;
    onCancel: () => void;
    onToggle?: (id: string) => void | Promise<void>;
}

function ChecklistItemContent(props: ChecklistItemContentProps): JSX.Element {
    function stopRowGesture(event: Event): void {
        event.stopPropagation();
    }

    return (
        <div class="checklist-editor__item" classList={{ 'checklist-editor__item--completed': props.visualCompleted }}>
            <Show when={props.showCheck}>
                <button
                    type="button"
                    class="checklist-editor__check"
                    classList={{ 'checklist-editor__check--done': props.visualCompleted }}
                    aria-label={`Mark ${props.item.summary} ${props.visualCompleted ? 'incomplete' : 'complete'}`}
                    onPointerDown={stopRowGesture}
                    onClick={(event) => {
                        stopRowGesture(event);
                        void props.onToggle?.(props.item.id);
                    }}
                >
                    {props.visualCompleted && <Icon src={checkIcon} width={13} height={13} />}
                </button>
            </Show>

            <Show when={props.editing} fallback={<span class="checklist-editor__summary">{props.item.summary}</span>}>
                <input
                    ref={focusAtEnd}
                    class="checklist-editor__input"
                    aria-label={`Edit ${props.item.summary}`}
                    value={props.editingSummary}
                    onPointerDown={stopRowGesture}
                    onClick={stopRowGesture}
                    onInput={(event) => props.onEditingSummaryChange(event.currentTarget.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault();
                            props.onCommitEdit();
                        } else if (event.key === 'Escape') {
                            event.preventDefault();
                            props.onCancel();
                        }
                    }}
                    onBlur={props.onCommitEdit}
                />
            </Show>
        </div>
    );
}

function focusInput(element: HTMLInputElement): void {
    queueMicrotask(() => element.focus());
}

function focusAtEnd(element: HTMLInputElement): void {
    queueMicrotask(() => {
        element.focus();
        const end = element.value.length;
        element.setSelectionRange(end, end);
    });
}

export type { ChecklistEditorItem, ChecklistEditorProps };
export { ChecklistEditor };
