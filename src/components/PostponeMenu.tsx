import { createSignal, Show } from 'solid-js';
import { editTask, today } from '../stores/taskStore.ts';
import { addDays, getNextMonday } from '../utils/logicalDay.ts';
import './PostponeMenu.css';

interface PostponeMenuProps {
    taskId: string;
    onDone?: () => void;
}

function PostponeMenu(props: PostponeMenuProps) {
    const [showDatePicker, setShowDatePicker] = createSignal(false);
    const [customDate, setCustomDate] = createSignal('');

    async function postponeTo(date: string) {
        await editTask(props.taskId, { date });
        props.onDone?.();
    }

    function handleCustomSubmit(e: SubmitEvent) {
        e.preventDefault();
        const d = customDate();
        if (d) {
            postponeTo(d);
        }
    }

    return (
        <div class="postpone-menu">
            <span class="form-label">Postpone to</span>
            <div class="postpone-menu__options">
                <button type="button" class="postpone-menu__btn" onClick={() => postponeTo(addDays(today(), 1))}>
                    Tomorrow
                </button>
                <button type="button" class="postpone-menu__btn" onClick={() => postponeTo(getNextMonday(today()))}>
                    Next Monday
                </button>
                <button type="button" class="postpone-menu__btn" onClick={() => postponeTo(addDays(today(), 7))}>
                    Next week
                </button>
                <button type="button" class="postpone-menu__btn" onClick={() => setShowDatePicker(!showDatePicker())}>
                    Pick date…
                </button>
            </div>
            <Show when={showDatePicker()}>
                <form class="postpone-menu__picker" onSubmit={handleCustomSubmit}>
                    <input
                        class="form-input form-input--sm postpone-menu__date-input"
                        type="date"
                        min={addDays(today(), 1)}
                        value={customDate()}
                        onInput={(e) => setCustomDate(e.currentTarget.value)}
                    />
                    <button class="btn btn--primary btn--sm" type="submit" disabled={!customDate()}>
                        Go
                    </button>
                </form>
            </Show>
        </div>
    );
}

export type { PostponeMenuProps };
export { PostponeMenu };
