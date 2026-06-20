import { createEffect, createMemo } from 'solid-js';
import { useLocation, useNavigate, useResolvedPath, useSearchParams } from '@solidjs/router';
import { hasLabelsModal, hasSyncModal, LABELS_MODAL, MODAL_PARAM, SYNC_MODAL } from './modalParams.ts';

type AppTab = 'today' | 'calendar' | 'generators';

let syncModalPushed = false;
let labelsModalPushed = false;

const TAB_ROUTES: Record<AppTab, string> = {
    today: '/tasks',
    calendar: '/calendar',
    generators: '/generators',
};

function pathStartsWith(location: string, base: string | undefined): boolean {
    if (!base) {
        return false;
    }
    const loc = location.toLowerCase();
    const root = base.toLowerCase();
    return loc === root || loc.startsWith(`${root}/`);
}

function taskDetailPath(id: string): string {
    return `/tasks/${id}`;
}

function generatorDetailPath(id: string | 'new'): string {
    return `/generators/${id}`;
}

/** Route-aware navigation helpers aligned with the app's history rules. */
function useAppNavigate() {
    const navigate = useNavigate();
    const location = useLocation();
    const [, setSearchParams] = useSearchParams();

    function pathKeepingOverlays(pathname: string): string {
        return hasSyncModal(location.search) ? `${pathname}${location.search}` : pathname;
    }

    return {
        toTab(tab: AppTab) {
            navigate(pathKeepingOverlays(TAB_ROUTES[tab]), { replace: true });
        },
        toTask(id: string) {
            navigate(taskDetailPath(id));
        },
        closeTaskDetail() {
            navigate(-1);
        },
        toTasksList() {
            navigate(pathKeepingOverlays(TAB_ROUTES.today), { replace: true });
        },
        toGenerator(id: string | 'new') {
            navigate(generatorDetailPath(id));
        },
        closeGeneratorDetail() {
            navigate(-1);
        },
        toGeneratorsList() {
            navigate(pathKeepingOverlays(TAB_ROUTES.generators), { replace: true });
        },
        openSyncPanel() {
            setSearchParams({ [MODAL_PARAM]: SYNC_MODAL });
            syncModalPushed = true;
        },
        closeSyncPanel() {
            if (syncModalPushed) {
                syncModalPushed = false;
                navigate(-1);
                return;
            }
            setSearchParams({ [MODAL_PARAM]: null }, { replace: true });
        },
        openLabelsPicker() {
            setSearchParams({ [MODAL_PARAM]: LABELS_MODAL });
            labelsModalPushed = true;
        },
        closeLabelsPicker() {
            if (labelsModalPushed) {
                labelsModalPushed = false;
                navigate(-1);
                return;
            }
            setSearchParams({ [MODAL_PARAM]: null }, { replace: true });
        },
    };
}

/** Whether the labels picker overlay is open for the current location. */
function useLabelsPanelOpen() {
    const location = useLocation();

    const open = createMemo(() => hasLabelsModal(location.search));

    createEffect(() => {
        if (!open()) {
            labelsModalPushed = false;
        }
    });

    return open;
}

/** Whether the sync settings overlay is open for the current location. */
function useSyncPanelOpen() {
    const location = useLocation();

    const open = createMemo(() => hasSyncModal(location.search));

    createEffect(() => {
        if (!open()) {
            syncModalPushed = false;
        }
    });

    return open;
}

/** Derive the active main tab from the current pathname. */
function useActiveTab() {
    const location = useLocation();
    const calendarPath = useResolvedPath(() => TAB_ROUTES.calendar);
    const generatorsPath = useResolvedPath(() => TAB_ROUTES.generators);

    return createMemo((): AppTab => {
        const pathname = location.pathname;
        if (pathStartsWith(pathname, generatorsPath())) {
            return 'generators';
        }
        if (pathStartsWith(pathname, calendarPath())) {
            return 'calendar';
        }
        return 'today';
    });
}

export type { AppTab };
export {
    generatorDetailPath,
    TAB_ROUTES,
    taskDetailPath,
    useActiveTab,
    useAppNavigate,
    useLabelsPanelOpen,
    useSyncPanelOpen,
};
export { hasLabelsModal, hasSyncModal, LABELS_MODAL, MODAL_PARAM, SYNC_MODAL } from './modalParams.ts';
