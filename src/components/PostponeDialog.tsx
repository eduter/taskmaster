import { createEffect, createMemo, createSignal, For, type JSX } from 'solid-js';
import { addMonths, getMonthGrid, startOfMonth } from '../calendar/calendarDate.ts';
import { today } from '../stores/taskStore.ts';
import { addDays, getNextMonday } from '../utils/logicalDay.ts';
import { Dialog } from './Dialog.tsx';
import './PostponeDialog.css';

interface PostponeDialogProps {
    open: boolean;
    selectedDate: string;
    onClose: () => void;
    onPick: (date: string) => void | Promise<void>;
    stackLevel?: number;
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** Postpone picker: presets plus a month grid. Dismiss with ×, backdrop, ESC, or back. */
function PostponeDialog(props: PostponeDialogProps): JSX.Element {
    const initialMonth = () => startOfMonth(props.selectedDate || today());
    const [month, setMonth] = createSignal(initialMonth());

    createEffect(() => {
        if (props.open) {
            setMonth(startOfMonth(props.selectedDate || today()));
        }
    });

    const grid = createMemo(() => getMonthGrid(month()));
    const caption = createMemo(() =>
        new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date(`${month()}T12:00:00`))
    );

    function pick(date: string): void {
        void props.onPick(date);
    }

    return (
        <Dialog
            open={props.open}
            onClose={props.onClose}
            title="When"
            stackLevel={props.stackLevel}
            panelClass="postpone-dialog"
        >
            <div class="postpone-dialog__presets">
                <button type="button" class="postpone-dialog__preset" onClick={() => pick(addDays(today(), 1))}>
                    Tomorrow
                </button>
                <button type="button" class="postpone-dialog__preset" onClick={() => pick(getNextMonday(today()))}>
                    Next Monday
                </button>
                <button type="button" class="postpone-dialog__preset" onClick={() => pick(addDays(today(), 7))}>
                    Next week
                </button>
            </div>

            <div class="postpone-dialog__cal">
                <div class="postpone-dialog__caption">
                    <button
                        type="button"
                        class="postpone-dialog__nav"
                        aria-label="Previous month"
                        onClick={() => setMonth(addMonths(month(), -1))}
                    >
                        ‹
                    </button>
                    <span>{caption()}</span>
                    <button
                        type="button"
                        class="postpone-dialog__nav"
                        aria-label="Next month"
                        onClick={() => setMonth(addMonths(month(), 1))}
                    >
                        ›
                    </button>
                </div>
                <div class="postpone-dialog__grid">
                    <For each={WEEKDAYS}>{(day) => <div class="postpone-dialog__dow">{day}</div>}</For>
                    <For each={grid()}>
                        {(week) => (
                            <For each={week.days}>
                                {(day) => (
                                    <PostponeDayButton
                                        date={day.date}
                                        inMonth={day.inMonth}
                                        selected={day.date === props.selectedDate}
                                        onPick={pick}
                                    />
                                )}
                            </For>
                        )}
                    </For>
                </div>
            </div>
        </Dialog>
    );
}

interface PostponeDayButtonProps {
    date: string;
    inMonth: boolean;
    selected: boolean;
    onPick: (date: string) => void;
}

function PostponeDayButton(props: PostponeDayButtonProps): JSX.Element {
    const disabled = () => props.date < today();

    return (
        <button
            type="button"
            class="postpone-dialog__day"
            classList={{
                'postpone-dialog__day--muted': !props.inMonth,
                'postpone-dialog__day--today': props.date === today(),
                'postpone-dialog__day--selected': props.selected,
            }}
            disabled={disabled()}
            aria-label={props.date}
            onClick={() => props.onPick(props.date)}
        >
            {Number(props.date.slice(8))}
        </button>
    );
}

export type { PostponeDialogProps };
export { PostponeDialog };
