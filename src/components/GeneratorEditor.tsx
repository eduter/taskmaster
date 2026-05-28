import { createSignal, For, Show, createEffect, on } from 'solid-js';
import { RRule } from 'rrule';
import {
    generators,
    editingGeneratorId,
    setEditingGeneratorId,
    addGenerator,
    editGenerator,
    removeGenerator,
} from '../stores/generatorStore.ts';
import type { Generator, TaskTemplate } from '../db/types.ts';
import './GeneratorEditor.css';

const DAY_MAP = [
    { val: 'MO', label: 'M' },
    { val: 'TU', label: 'T' },
    { val: 'WE', label: 'W' },
    { val: 'TH', label: 'T' },
    { val: 'FR', label: 'F' },
    { val: 'SA', label: 'S' },
    { val: 'SU', label: 'S' },
];

function formatDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

function GeneratorEditor() {
    const [name, setName] = createSignal('');
    const [freq, setFreq] = createSignal<string>('DAILY');
    const [interval, setIntervalVal] = createSignal<number>(1);
    const [byday, setByday] = createSignal<string[]>([]);
    const [dtstart, setDtstart] = createSignal<string>(formatDate(new Date()));
    const [templates, setTemplates] = createSignal<TaskTemplate[]>([]);
    const [newTemplateSummary, setNewTemplateSummary] = createSignal('');
    const [active, setActive] = createSignal(true);

    const isEditing = () => editingGeneratorId() !== null;

    const editingGen = (): Generator | undefined => {
        const id = editingGeneratorId();
        if (!id) return undefined;
        return (generators() ?? []).find((g) => g.id === id);
    };

    createEffect(
        on(editingGeneratorId, () => {
            const gen = editingGen();
            if (gen) {
                setName(gen.name);
                setActive(gen.active);
                setTemplates([...gen.templates]);

                try {
                    const freqMatch = gen.rrule.match(/FREQ=(DAILY|WEEKLY|MONTHLY|YEARLY)/);
                    setFreq(freqMatch ? freqMatch[1] : 'DAILY');

                    const intervalMatch = gen.rrule.match(/INTERVAL=(\d+)/);
                    setIntervalVal(intervalMatch ? parseInt(intervalMatch[1], 10) : 1);

                    const bydayMatch = gen.rrule.match(/BYDAY=([A-Z,]+)/);
                    setByday(bydayMatch ? bydayMatch[1].split(',') : []);

                    const rule = RRule.fromString(gen.rrule);
                    const nextOccur = rule.after(new Date(), true);
                    if (nextOccur) {
                        setDtstart(formatDate(nextOccur));
                    } else {
                        setDtstart(formatDate(new Date()));
                    }
                } catch (e) {
                    console.error(e);
                    setDtstart(formatDate(new Date()));
                }
            } else {
                resetForm();
            }
        })
    );

    function resetForm() {
        setName('');
        setFreq('DAILY');
        setIntervalVal(1);
        setByday([]);
        setDtstart(formatDate(new Date()));
        setTemplates([]);
        setNewTemplateSummary('');
        setActive(true);
        setEditingGeneratorId(null);
    }

    function addTemplate() {
        const summary = newTemplateSummary().trim();
        if (!summary) return;
        setTemplates([...templates(), { summary, description: '', labels: [] }]);
        setNewTemplateSummary('');
    }

    function removeTemplate(index: number) {
        setTemplates(templates().filter((_, i) => i !== index));
    }

    function handleTemplateKeyDown(e: KeyboardEvent) {
        if (e.key === 'Enter') {
            e.preventDefault();
            addTemplate();
        }
    }

    async function handleSave() {
        const n = name().trim();
        if (!n) return;

        let ruleStr = `FREQ=${freq()};INTERVAL=${interval()}`;
        if (freq() === 'WEEKLY' && byday().length > 0) {
            ruleStr += `;BYDAY=${byday().join(',')}`;
        }

        const dObj = new Date(dtstart() + 'T12:00:00');
        const dStr = dObj.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
        const rule = `DTSTART:${dStr}\nRRULE:${ruleStr}`;

        if (isEditing()) {
            await editGenerator(editingGeneratorId()!, {
                name: n,
                rrule: rule,
                templates: templates(),
                active: active(),
            });
        } else {
            await addGenerator(n, rule, templates());
        }
        resetForm();
    }

    async function handleDelete() {
        const id = editingGeneratorId();
        if (!id) return;
        await removeGenerator(id);
        resetForm();
    }

    return (
        <div class="gen-editor">
            <div class="gen-editor__field">
                <label class="gen-editor__label">Generator name</label>
                <input
                    class="gen-editor__input"
                    type="text"
                    placeholder="e.g. Daily language practice"
                    value={name()}
                    onInput={(e) => setName(e.currentTarget.value)}
                />
            </div>

            <div class="gen-editor__field">
                <label class="gen-editor__label">Next Occurrence (Anchor)</label>
                <input
                    class="gen-editor__input"
                    type="date"
                    value={dtstart()}
                    onInput={(e) => setDtstart(e.currentTarget.value)}
                />
            </div>

            <div class="gen-editor__field gen-editor__recurrence-group">
                <label class="gen-editor__label">Repeat Every</label>
                <div class="gen-editor__recurrence-row">
                    <input
                        class="gen-editor__input gen-editor__interval-input"
                        type="number"
                        min="1"
                        value={interval()}
                        onInput={(e) => setIntervalVal(parseInt(e.currentTarget.value) || 1)}
                    />
                    <select class="gen-editor__select" value={freq()} onChange={(e) => setFreq(e.currentTarget.value)}>
                        <option value="DAILY">Days</option>
                        <option value="WEEKLY">Weeks</option>
                        <option value="MONTHLY">Months</option>
                        <option value="YEARLY">Years</option>
                    </select>
                </div>
            </div>

            <Show when={freq() === 'WEEKLY'}>
                <div class="gen-editor__field">
                    <label class="gen-editor__label">On Days</label>
                    <div class="gen-editor__day-toggles">
                        <For each={DAY_MAP}>
                            {(day) => (
                                <label class="gen-editor__day-toggle">
                                    <input
                                        type="checkbox"
                                        checked={byday().includes(day.val)}
                                        onChange={(e) => {
                                            if (e.currentTarget.checked) {
                                                setByday([...byday(), day.val]);
                                            } else {
                                                setByday(byday().filter((d) => d !== day.val));
                                            }
                                        }}
                                    />
                                    <span>{day.label}</span>
                                </label>
                            )}
                        </For>
                    </div>
                </div>
            </Show>

            <div class="gen-editor__field">
                <label class="gen-editor__label">Task templates</label>
                <For each={templates()}>
                    {(tmpl, i) => (
                        <div class="gen-editor__template">
                            <span>{tmpl.summary}</span>
                            <button class="gen-editor__template-remove" onClick={() => removeTemplate(i())}>
                                &times;
                            </button>
                        </div>
                    )}
                </For>
                <div class="gen-editor__template-add">
                    <input
                        class="gen-editor__input"
                        type="text"
                        placeholder="Task summary…"
                        value={newTemplateSummary()}
                        onInput={(e) => setNewTemplateSummary(e.currentTarget.value)}
                        onKeyDown={handleTemplateKeyDown}
                    />
                    <button class="gen-editor__btn-secondary" type="button" onClick={addTemplate}>
                        Add
                    </button>
                </div>
            </div>

            <Show when={isEditing()}>
                <div class="gen-editor__field gen-editor__active-toggle">
                    <label>
                        <input
                            type="checkbox"
                            checked={active()}
                            onChange={(e) => setActive(e.currentTarget.checked)}
                        />{' '}
                        Active
                    </label>
                </div>
            </Show>

            <div class="gen-editor__actions">
                <button class="gen-editor__btn-primary" onClick={handleSave}>
                    {isEditing() ? 'Update' : 'Create'}
                </button>
                <Show when={isEditing()}>
                    <button class="gen-editor__btn-danger" onClick={handleDelete}>
                        Delete
                    </button>
                </Show>
                <button class="gen-editor__btn-secondary" onClick={resetForm}>
                    Cancel
                </button>
            </div>
        </div>
    );
}

export { GeneratorEditor };
