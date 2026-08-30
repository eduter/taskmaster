import { createMemo, type JSX } from 'solid-js';
import checkIcon from '../icons/check.svg?raw';
import { tasks } from '../stores/taskStore.ts';
import { completionColor } from '../utils/completionColor.ts';
import { Icon } from './Icon.tsx';
import './TodayTabIcon.css';

const RING_RADIUS = 8;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function todayCompletionRate(taskList: readonly { completed: boolean }[] | undefined): number {
    const list = taskList ?? [];
    if (list.length === 0) {
        return 0;
    }

    const completedCount = list.filter((task) => task.completed).length;
    return completedCount / list.length;
}

/** Today's tab icon with a circular completion ring and check mark. */
function TodayTabIcon(): JSX.Element {
    const completionRate = createMemo(() => todayCompletionRate(tasks()));
    const color = createMemo(() => completionColor(completionRate()));
    const progressLength = createMemo(() => completionRate() * RING_CIRCUMFERENCE);

    return (
        <span
            class="today-tab-icon"
            style={{
                '--completion-rate': String(completionRate()),
                '--completion-color': color(),
            }}
            aria-hidden="true"
        >
            <svg class="today-tab-icon__svg" viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
                <circle class="today-tab-icon__track" cx="10" cy="10" r={RING_RADIUS} />
                <circle
                    class="today-tab-icon__progress"
                    cx="10"
                    cy="10"
                    r={RING_RADIUS}
                    stroke={color()}
                    stroke-dasharray={`${progressLength()} ${RING_CIRCUMFERENCE}`}
                    transform="rotate(-90 10 10)"
                />
            </svg>
            <Icon class="today-tab-icon__check" src={checkIcon} width={12} height={12} />
        </span>
    );
}

export { TodayTabIcon, todayCompletionRate };
