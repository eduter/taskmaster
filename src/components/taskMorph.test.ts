/** @vitest-environment jsdom */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { canMorph, MORPH_ID_ATTRIBUTE, morphTaskClose, morphTaskOpen } from './taskMorph.ts';

interface TransitionStub {
    finish: () => void;
    skipped: boolean;
    update: (() => void | Promise<void>) | undefined;
}

function stubViewTransitions(): TransitionStub {
    let resolveFinished: () => void = () => {};
    const stub: TransitionStub = {
        finish: () => resolveFinished(),
        skipped: false,
        update: undefined,
    };
    const finished = new Promise<void>((resolve) => {
        resolveFinished = resolve;
    });
    Object.defineProperty(document, 'startViewTransition', {
        configurable: true,
        writable: true,
        value: (update: () => void | Promise<void>) => {
            stub.update = update;
            void update();
            return {
                finished,
                ready: Promise.resolve(),
                updateCallbackDone: Promise.resolve(),
                skipTransition: () => {
                    stub.skipped = true;
                },
            };
        },
    });
    window.matchMedia = (() => ({
        matches: false,
        addEventListener: () => {},
        removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
    return stub;
}

function removeViewTransitions(): void {
    Reflect.deleteProperty(document, 'startViewTransition');
}

/** Stubs view transitions with a separately resolvable `finished` per call. */
function stubManyViewTransitions(): TransitionStub[] {
    const handles: TransitionStub[] = [];
    Object.defineProperty(document, 'startViewTransition', {
        configurable: true,
        writable: true,
        value: (update: () => void | Promise<void>) => {
            let resolveFinished: () => void = () => {};
            const finished = new Promise<void>((resolve) => {
                resolveFinished = resolve;
            });
            const handle: TransitionStub = { finish: () => resolveFinished(), skipped: false, update };
            handles.push(handle);
            void update();
            return {
                finished,
                ready: Promise.resolve(),
                updateCallbackDone: Promise.resolve(),
                skipTransition: () => {
                    handle.skipped = true;
                },
            };
        },
    });
    window.matchMedia = (() => ({
        matches: false,
        addEventListener: () => {},
        removeEventListener: () => {},
    })) as unknown as typeof window.matchMedia;
    return handles;
}

function makeSourceCard(taskId: string, summary: string): HTMLElement {
    const card = document.createElement('div');
    card.className = 'task-card';
    card.setAttribute(MORPH_ID_ATTRIBUTE, taskId);
    const text = document.createElement('span');
    text.className = 'task-card__summary';
    text.textContent = summary;
    card.append(text);
    document.body.append(card);
    return card;
}

function appendDialogPanel(): HTMLElement {
    const dialog = document.createElement('dialog');
    dialog.open = true;
    const panel = document.createElement('div');
    panel.className = 'dialog__panel task-editor-dialog';
    const title = document.createElement('button');
    title.className = 'editable-summary-heading';
    panel.append(title);
    dialog.append(panel);
    document.body.append(dialog);
    return panel;
}

/** Waits past the morph module's stability re-check before asserting. */
async function flush(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 40));
}

afterEach(() => {
    vi.unstubAllGlobals();
    removeViewTransitions();
    document.body.replaceChildren();
});

describe('canMorph', () => {
    it('is false when the browser lacks same-document view transitions', () => {
        expect(canMorph()).toBe(false);
    });

    it('is false when the user prefers reduced motion', () => {
        stubViewTransitions();
        window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia;
        expect(canMorph()).toBe(false);
    });

    it('is true with support and no reduced-motion preference', () => {
        stubViewTransitions();
        expect(canMorph()).toBe(true);
    });
});

describe('morphTaskOpen', () => {
    it('navigates directly when view transitions are unavailable', () => {
        const navigate = vi.fn();
        morphTaskOpen(makeSourceCard('t1', 'Groceries'), navigate);
        expect(navigate).toHaveBeenCalledOnce();
    });

    it('moves the morph names from the tapped card to the dialog panel', async () => {
        const transition = stubViewTransitions();
        const card = makeSourceCard('t1', 'Groceries');
        const panel = appendDialogPanel();
        const navigate = vi.fn();

        morphTaskOpen(card, navigate);
        await flush();

        expect(navigate).toHaveBeenCalledOnce();
        expect(card.style.viewTransitionName).toBe('');
        expect(panel.style.viewTransitionName).toBe('task-morph-panel');
        expect(panel.querySelector('.editable-summary-heading')?.style.viewTransitionName).toBe('task-morph-title');

        transition.finish();
        await flush();
        expect(panel.style.viewTransitionName).toBe('');
    });

    it('skips the in-flight morph before starting a new one', () => {
        const transition = stubViewTransitions();
        morphTaskOpen(makeSourceCard('t1', 'Groceries'), vi.fn());
        const first = transition.skipped;
        morphTaskOpen(makeSourceCard('t2', 'Milk'), vi.fn());
        expect(first).toBe(false);
        expect(transition.skipped).toBe(true);
    });

    it('keeps the names a newer morph set when the skipped one finishes late', async () => {
        const handles = stubManyViewTransitions();
        const panel = appendDialogPanel();
        morphTaskOpen(makeSourceCard('t1', 'Groceries'), vi.fn());
        morphTaskOpen(makeSourceCard('t2', 'Milk'), vi.fn());
        await flush();
        expect(panel.style.viewTransitionName).toBe('task-morph-panel');

        // The skipped first transition resolves after the second one started.
        handles[0].finish();
        await flush();

        expect(panel.style.viewTransitionName).toBe('task-morph-panel');
    });
});

describe('morphTaskClose', () => {
    it('navigates directly when there is no open panel', () => {
        stubViewTransitions();
        const navigate = vi.fn();
        morphTaskClose('t1', navigate);
        expect(navigate).toHaveBeenCalledOnce();
    });

    it('moves the morph names from the dialog panel back to the task card', async () => {
        stubViewTransitions();
        const panel = appendDialogPanel();
        const navigate = vi.fn(() => {
            panel.closest('dialog')?.remove();
            makeSourceCard('t1', 'Groceries');
        });

        morphTaskClose('t1', navigate);
        await flush();

        expect(navigate).toHaveBeenCalledOnce();
        expect(panel.style.viewTransitionName).toBe('');
        const card = document.querySelector<HTMLElement>(`[${MORPH_ID_ATTRIBUTE}="t1"]`);
        expect(card?.style.viewTransitionName).toBe('task-morph-panel');
        expect(card?.querySelector('.task-card__summary')?.style.viewTransitionName).toBe('task-morph-title');
    });

    it('names the surviving card when the router replaces it mid-morph', async () => {
        stubViewTransitions();
        const panel = appendDialogPanel();
        const navigate = vi.fn(() => {
            panel.closest('dialog')?.remove();
            const doomed = makeSourceCard('t1', 'Groceries');
            // The router re-renders the list a beat later, swapping the card out.
            setTimeout(() => {
                doomed.remove();
                makeSourceCard('t1', 'Groceries');
            }, 5);
        });

        morphTaskClose('t1', navigate);
        await flush();

        const card = document.querySelector<HTMLElement>(`[${MORPH_ID_ATTRIBUTE}="t1"]`);
        expect(card?.style.viewTransitionName).toBe('task-morph-panel');
        expect(card?.querySelector('.task-card__summary')?.style.viewTransitionName).toBe('task-morph-title');
    });
});
