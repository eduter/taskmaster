import { createMemo } from 'solid-js';
import { useLocation, useNavigate, useResolvedPath } from '@solidjs/router';

type AppTab = 'today' | 'calendar' | 'generators';

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

    return {
        toTab(tab: AppTab) {
            navigate(TAB_ROUTES[tab], { replace: true });
        },
        toTask(id: string) {
            navigate(taskDetailPath(id));
        },
        toTasksList() {
            navigate(TAB_ROUTES.today, { replace: true });
        },
        toGenerator(id: string | 'new') {
            navigate(generatorDetailPath(id));
        },
        toGeneratorsList() {
            navigate(TAB_ROUTES.generators, { replace: true });
        },
    };
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
export { generatorDetailPath, TAB_ROUTES, taskDetailPath, useActiveTab, useAppNavigate };
