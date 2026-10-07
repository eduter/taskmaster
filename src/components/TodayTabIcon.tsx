import { createMemo, type JSX } from 'solid-js';
import checkIcon from '../icons/check.svg?raw';
import { tasks } from '../stores/taskStore.ts';
import { completionColor } from '../utils/completionColor.ts';
import { completionRate } from '../utils/completionRate.ts';
import { CompletionRing } from './CompletionRing.tsx';
import { Icon } from './Icon.tsx';
import './TodayTabIcon.css';

const RING_SIZE = 20;
const RING_RADIUS = 8;

/** Today's tab icon with a circular completion ring and check mark. */
function TodayTabIcon(): JSX.Element {
    const rate = createMemo(() => completionRate(tasks()));
    const color = createMemo(() => completionColor(rate()));

    return (
        <span
            class="today-tab-icon"
            style={{
                '--completion-rate': String(rate()),
                '--completion-color': color(),
            }}
            aria-hidden="true"
        >
            <CompletionRing
                class="today-tab-icon__svg"
                trackClass="today-tab-icon__track"
                progressClass="today-tab-icon__progress"
                rate={rate()}
                color={color()}
                size={RING_SIZE}
                radius={RING_RADIUS}
            />
            <Icon class="today-tab-icon__check" src={checkIcon} width={12} height={12} />
        </span>
    );
}

export { TodayTabIcon };
