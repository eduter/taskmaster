import { For, Show } from "solid-js";
import {
  generators,
  setEditingGeneratorId,
  showGeneratorList,
  setShowGeneratorList,
  invalidateGenerators,
} from "../stores/generatorStore.ts";
import { invalidateTasks } from "../stores/taskStore.ts";
import { runGenerators } from "../scheduling/generate.ts";
import { getLogicalDay, addDays } from "../utils/logicalDay.ts";
import { sync } from "../sync/syncEngine.ts";
import { GeneratorEditor } from "./GeneratorEditor.tsx";
import "./GeneratorList.css";

function GeneratorList() {
  const handleTestRun = async () => {
    const tomorrow = addDays(getLogicalDay(), 1);
    const created = await runGenerators(tomorrow);
    if (created > 0) {
      invalidateTasks();
      invalidateGenerators();
      await sync();
      alert(`Simulated generation for ${tomorrow}: Created ${created} task(s).`);
    } else {
      alert(`No tasks to generate for ${tomorrow}.`);
    }
  };

  return (
    <Show when={showGeneratorList()}>
      <div class="gen-overlay" onClick={() => setShowGeneratorList(false)}>
        <div class="gen-panel" onClick={(e) => e.stopPropagation()}>
          <div class="gen-panel__header">
            <h2 class="gen-panel__title">Generators</h2>
            <div class="gen-panel__header-actions">
              <button class="gen-panel__test-btn" onClick={handleTestRun} title="Run for Tomorrow">
                Test Run
              </button>
              <button
                class="gen-panel__close"
                onClick={() => setShowGeneratorList(false)}
                aria-label="Close"
              >
                &times;
              </button>
            </div>
          </div>

          <div class="gen-panel__list">
            <Show
              when={(generators() ?? []).length > 0}
              fallback={<p class="gen-panel__empty">No generators yet.</p>}
            >
              <For each={generators() ?? []}>
                {(gen) => (
                  <div
                    class="gen-panel__item"
                    classList={{ "gen-panel__item--inactive": !gen.active }}
                    onClick={() => setEditingGeneratorId(gen.id)}
                  >
                    <span class="gen-panel__item-name">{gen.name}</span>
                    <span class="gen-panel__item-count">
                      {gen.templates.length} task{gen.templates.length !== 1 ? "s" : ""}
                    </span>
                  </div>
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
