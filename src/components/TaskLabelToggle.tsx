import labelIcon from '../icons/label.svg?raw';
import { showTaskLabels, toggleTaskLabels } from '../stores/viewPreferencesStore.ts';
import { Icon } from './Icon.tsx';
import './TaskLabelToggle.css';

/** Header control for the device-local task label display preference. */
function TaskLabelToggle() {
    const label = () => (showTaskLabels() ? 'Hide labels' : 'Show labels');

    return (
        <button
            type="button"
            class="task-label-toggle"
            classList={{ 'task-label-toggle--active': showTaskLabels() }}
            aria-label={label()}
            aria-pressed={showTaskLabels()}
            onClick={toggleTaskLabels}
        >
            <Icon src={labelIcon} />
            <span class="task-label-toggle__text">{label()}</span>
        </button>
    );
}

export { TaskLabelToggle };
