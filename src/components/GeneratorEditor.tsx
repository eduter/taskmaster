import { createSignal, For, Show, createEffect, on } from "solid-js";
import {
  generators,
  editingGeneratorId,
  setEditingGeneratorId,
  addGenerator,
  editGenerator,
  removeGenerator,
} from "../stores/generatorStore.ts";
import type { Generator, TaskTemplate } from "../db/types.ts";
import "./GeneratorEditor.css";

const RRULE_PRESETS = [
  { label: "Every day", value: "FREQ=DAILY;INTERVAL=1" },
  { label: "Every weekday", value: "FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR" },
  { label: "Every week", value: "FREQ=WEEKLY;INTERVAL=1" },
  { label: "Every 2 weeks", value: "FREQ=WEEKLY;INTERVAL=2" },
  { label: "Every month", value: "FREQ=MONTHLY;INTERVAL=1" },
  { label: "Custom", value: "" },
] as const;

function GeneratorEditor() {
  const [name, setName] = createSignal("");
  const [rrule, setRrule] = createSignal<string>(RRULE_PRESETS[0].value);
  const [customRrule, setCustomRrule] = createSignal("");
  const [templates, setTemplates] = createSignal<TaskTemplate[]>([]);
  const [newTemplateSummary, setNewTemplateSummary] = createSignal("");
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
        const preset = RRULE_PRESETS.find((p) => p.value === gen.rrule);
        if (preset) {
          setRrule(gen.rrule);
          setCustomRrule("");
        } else {
          setRrule("");
          setCustomRrule(gen.rrule);
        }
      } else {
        resetForm();
      }
    }),
  );

  function resetForm() {
    setName("");
    setRrule(RRULE_PRESETS[0].value);
    setCustomRrule("");
    setTemplates([]);
    setNewTemplateSummary("");
    setActive(true);
    setEditingGeneratorId(null);
  }

  function addTemplate() {
    const summary = newTemplateSummary().trim();
    if (!summary) return;
    setTemplates([...templates(), { summary, description: "", labels: [] }]);
    setNewTemplateSummary("");
  }

  function removeTemplate(index: number) {
    setTemplates(templates().filter((_, i) => i !== index));
  }

  function handleTemplateKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      e.preventDefault();
      addTemplate();
    }
  }

  async function handleSave() {
    const n = name().trim();
    if (!n) return;
    const rule = rrule() || customRrule().trim();
    if (!rule) return;

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
        <label class="gen-editor__label">Recurrence</label>
        <select
          class="gen-editor__select"
          value={rrule()}
          onChange={(e) => setRrule(e.currentTarget.value)}
        >
          <For each={RRULE_PRESETS}>
            {(preset) => <option value={preset.value}>{preset.label}</option>}
          </For>
        </select>
        <Show when={rrule() === ""}>
          <input
            class="gen-editor__input"
            type="text"
            placeholder="RRULE e.g. FREQ=WEEKLY;BYDAY=MO,WE,FR"
            value={customRrule()}
            onInput={(e) => setCustomRrule(e.currentTarget.value)}
          />
        </Show>
      </div>

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
            />
            {" "}Active
          </label>
        </div>
      </Show>

      <div class="gen-editor__actions">
        <button class="gen-editor__btn-primary" onClick={handleSave}>
          {isEditing() ? "Update" : "Create"}
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
