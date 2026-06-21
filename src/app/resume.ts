import { commitGeneratorRuns, runGenerators } from '../scheduling/generate.ts';
import { invalidateGenerators } from '../stores/generatorStore.ts';
import { invalidateLabels } from '../stores/labelStore.ts';
import { invalidateTasks, refreshTodayIfNeeded, today } from '../stores/taskStore.ts';
import { isSyncRunning, onSyncIdle, setPushPending, sync } from '../sync/syncEngine.ts';

const RESUME_DEBOUNCE_MS = 500;

let resumeTimer: ReturnType<typeof setTimeout> | null = null;
let resumeInFlight = false;
let resumePending = false;
let syncIdleHookInstalled = false;

async function onAppResume(): Promise<void> {
    refreshTodayIfNeeded();

    const outcome = await sync();
    if (!outcome.ok) {
        return;
    }

    if (outcome.dataChanged) {
        invalidateTasks({ push: false });
        invalidateGenerators({ push: false });
        invalidateLabels({ push: false });
    }

    const { created, generatorIds } = await runGenerators();
    if (created > 0) {
        invalidateTasks({ push: false });

        await commitGeneratorRuns(generatorIds, today());
        await setPushPending(true);

        const pushOutcome = await sync();
        if (!pushOutcome.ok) {
            return;
        }
    }
}

function scheduleAppResume(): void {
    if (resumeTimer) {
        clearTimeout(resumeTimer);
    }
    resumeTimer = setTimeout(() => {
        resumeTimer = null;
        void runAppResume();
    }, RESUME_DEBOUNCE_MS);
}

async function runAppResume(): Promise<void> {
    if (resumeInFlight) {
        return;
    }
    if (isSyncRunning()) {
        resumePending = true;
        return;
    }
    resumeInFlight = true;
    try {
        await onAppResume();
    } finally {
        resumeInFlight = false;
    }
}

function setupResumeListeners(): void {
    if (!syncIdleHookInstalled) {
        syncIdleHookInstalled = true;
        onSyncIdle(() => {
            if (resumePending && !resumeInFlight && !isSyncRunning()) {
                resumePending = false;
                void runAppResume();
            }
        });
    }

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            scheduleAppResume();
        }
    });

    window.addEventListener('pageshow', (event) => {
        if (event.persisted) {
            scheduleAppResume();
        }
    });
}

export { onAppResume, setupResumeListeners };
