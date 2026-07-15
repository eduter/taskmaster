import { waitForDb } from '../db/dbLifecycle.ts';
import { commitGeneratorRuns, runGenerators } from '../scheduling/generate.ts';
import { invalidateGenerators } from '../stores/generatorStore.ts';
import { invalidateLabels } from '../stores/labelStore.ts';
import { recordError } from '../stores/syncStore.ts';
import { invalidateTasks, refreshTodayIfNeeded, today } from '../stores/taskStore.ts';
import { isAuthenticated } from '../sync/dropboxAuth.ts';
import { isSyncRunning, onSyncIdle, setPushPending, sync } from '../sync/syncEngine.ts';

const RESUME_DEBOUNCE_MS = 500;

let resumeTimer: ReturnType<typeof setTimeout> | null = null;
let resumeInFlight = false;
let resumePending = false;
let syncIdleHookInstalled = false;

async function onAppResume(): Promise<void> {
    try {
        refreshTodayIfNeeded();
        await waitForDb();

        if (isAuthenticated()) {
            const outcome = await sync();
            if (!outcome.ok) {
                return;
            }

            if (outcome.dataChanged) {
                invalidateTasks({ push: false });
                invalidateGenerators({ push: false });
                invalidateLabels({ push: false });
            }
        } else if (!import.meta.env.DEV) {
            await sync();
            return;
        }

        const { created, generatorIds } = await runGenerators();
        if (created > 0) {
            invalidateTasks({ push: false });

            await commitGeneratorRuns(generatorIds, today());

            if (isAuthenticated()) {
                await setPushPending(true);

                const pushOutcome = await sync();
                if (!pushOutcome.ok) {
                    return;
                }
            }
        }
    } catch (err: unknown) {
        console.error('App resume failed:', err);
        const message = err instanceof Error ? err.message : 'App resume failed';
        recordError(message);
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
