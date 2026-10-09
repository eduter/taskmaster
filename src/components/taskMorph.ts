const MORPH_PANEL = 'task-morph-panel';
const MORPH_TITLE = 'task-morph-title';
const PANEL_SELECTOR = '.task-editor-dialog';
const TITLE_SELECTOR = '.editable-summary-heading';
const SUMMARY_SELECTOR = '.task-card__summary';
const CARD_SELECTOR = '.task-card';
const MORPH_ID_ATTRIBUTE = 'data-task-morph-id';
/**
 * Set on `<html>` while a morph transition is animating. The source row is
 * hidden while its dialog is open, so the close morph reveals it; this flag
 * keeps the row's delete strip from flashing underneath the morphing card.
 */
const MORPH_ACTIVE_ATTRIBUTE = 'data-task-morph-active';

/** How long the update callback may wait for the dialog panel to render. */
const PANEL_WAIT_MS = 600;

/**
 * Gap between two identical lookups required before an element counts as
 * settled. Route changes re-render the task list asynchronously, so the first
 * matching card can be a doomed node that is replaced a few milliseconds later.
 */
const STABLE_CHECK_MS = 16;

let activeTransition: ViewTransition | undefined;
const namedElements = new Set<HTMLElement>();

/**
 * Whether a morph transition can run: same-document view transitions are
 * supported and the user has not asked for reduced motion.
 */
function canMorph(): boolean {
    if (typeof document === 'undefined' || typeof document.startViewTransition !== 'function') {
        return false;
    }
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return false;
    }
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function setMorphName(element: HTMLElement, name: string): void {
    element.style.viewTransitionName = name;
    namedElements.add(element);
}

function clearMorphNames(): void {
    for (const element of namedElements) {
        element.style.viewTransitionName = '';
    }
    namedElements.clear();
}

/** Skip any in-flight morph and drop stale names before capturing a new one. */
function prepareMorph(): void {
    activeTransition?.skipTransition();
    activeTransition = undefined;
    clearMorphNames();
}

function runMorph(update: () => void | Promise<void>): void {
    const transition = document.startViewTransition(update);
    activeTransition = transition;
    document.documentElement.setAttribute(MORPH_ACTIVE_ATTRIBUTE, '');
    transition.finished
        .catch(() => undefined)
        .finally(() => {
            // Only the current transition may clean up: a skipped predecessor's
            // `finished` resolves late and would otherwise wipe the names a newer
            // transition just set.
            if (activeTransition === transition) {
                activeTransition = undefined;
                clearMorphNames();
                document.documentElement.removeAttribute(MORPH_ACTIVE_ATTRIBUTE);
            }
        });
}

function resolveCard(source: HTMLElement | undefined): HTMLElement | null {
    if (!source) {
        return null;
    }
    if (source.matches(CARD_SELECTOR)) {
        return source;
    }
    return source.querySelector<HTMLElement>(CARD_SELECTOR);
}

function findDialogPanel(): HTMLElement | null {
    const panel = document.querySelector<HTMLElement>(PANEL_SELECTOR);
    if (!panel) {
        return null;
    }
    const dialog = panel.closest('dialog');
    if (dialog && !dialog.open) {
        return null;
    }
    return panel;
}

function findSourceCard(taskId: string): HTMLElement | null {
    return document.querySelector<HTMLElement>(`[${MORPH_ID_ATTRIBUTE}="${taskId}"]`);
}

/**
 * Resolves with the first element that `find` returns twice in a row (with a
 * short gap), so callers don't capture a node the router is about to replace.
 * Resolves with `null` if nothing settles before the timeout.
 */
function waitForStableElement(find: () => HTMLElement | null, timeoutMs: number): Promise<HTMLElement | null> {
    return new Promise((resolve) => {
        const startedAt = performance.now();
        let candidate: HTMLElement | null = null;
        const tick = (): void => {
            // The loop can outlive the test/SSR environment; bail before touching
            // `document` so a torn-down DOM doesn't throw from a stray timer.
            if (typeof document === 'undefined') {
                resolve(null);
                return;
            }
            const element = find();
            if (element && element === candidate) {
                resolve(element);
                return;
            }
            candidate = element;
            if (performance.now() - startedAt >= timeoutMs) {
                resolve(element);
                return;
            }
            // setTimeout, not requestAnimationFrame: frames can be paused while the
            // view-transition update callback is pending, which would stall the poll.
            setTimeout(tick, element ? STABLE_CHECK_MS : 0);
        };
        tick();
    });
}

/**
 * Opens the task dialog while morphing the tapped card into the dialog panel.
 *
 * The tapped card keeps its box and summary as the transition's "old" state; the
 * callback swaps the names onto the rendered dialog once it appears, so the
 * browser animates between the two.
 */
function morphTaskOpen(source: HTMLElement | undefined, navigate: () => void): void {
    if (!canMorph()) {
        navigate();
        return;
    }
    const card = resolveCard(source);
    if (!card) {
        navigate();
        return;
    }

    prepareMorph();
    setMorphName(card, MORPH_PANEL);
    const summary = card.querySelector<HTMLElement>(SUMMARY_SELECTOR);
    if (summary) {
        setMorphName(summary, MORPH_TITLE);
    }

    runMorph(async () => {
        card.style.viewTransitionName = '';
        if (summary) {
            summary.style.viewTransitionName = '';
        }
        navigate();

        const panel = await waitForStableElement(findDialogPanel, PANEL_WAIT_MS);
        if (!panel) {
            return;
        }
        setMorphName(panel, MORPH_PANEL);
        const title = panel.querySelector<HTMLElement>(TITLE_SELECTOR);
        if (title) {
            setMorphName(title, MORPH_TITLE);
        }
    });
}

/** Closes the task dialog while morphing it back into the task's list row. */
function morphTaskClose(taskId: string, navigate: () => void): void {
    if (!canMorph()) {
        navigate();
        return;
    }
    const panel = findDialogPanel();
    if (!panel) {
        navigate();
        return;
    }

    prepareMorph();
    setMorphName(panel, MORPH_PANEL);
    const title = panel.querySelector<HTMLElement>(TITLE_SELECTOR);
    if (title) {
        setMorphName(title, MORPH_TITLE);
    }

    runMorph(async () => {
        panel.style.viewTransitionName = '';
        if (title) {
            title.style.viewTransitionName = '';
        }
        navigate();

        const card = await waitForStableElement(() => findSourceCard(taskId), PANEL_WAIT_MS);
        if (!card) {
            return;
        }
        setMorphName(card, MORPH_PANEL);
        const summary = card.querySelector<HTMLElement>(SUMMARY_SELECTOR);
        if (summary) {
            setMorphName(summary, MORPH_TITLE);
        }
    });
}

export { canMorph, MORPH_ACTIVE_ATTRIBUTE, MORPH_ID_ATTRIBUTE, morphTaskClose, morphTaskOpen };
