const MODAL_PARAM = 'modal';

const SYNC_MODAL = 'sync';
const LABELS_MODAL = 'labels';
const POSTPONE_MODAL = 'postpone';

/** Whether the sync settings modal is open in a query string. */
function hasSyncModal(search: string): boolean {
    return new URLSearchParams(search).get(MODAL_PARAM) === SYNC_MODAL;
}

/** Whether the labels picker modal is open in a query string. */
function hasLabelsModal(search: string): boolean {
    return new URLSearchParams(search).get(MODAL_PARAM) === LABELS_MODAL;
}

/** Whether the postpone picker modal is open in a query string. */
function hasPostponeModal(search: string): boolean {
    return new URLSearchParams(search).get(MODAL_PARAM) === POSTPONE_MODAL;
}

/** Whether a modal overlay should survive route helper navigation. */
function hasOverlayModal(search: string): boolean {
    return hasSyncModal(search) || hasLabelsModal(search) || hasPostponeModal(search);
}

export {
    hasLabelsModal,
    hasOverlayModal,
    hasPostponeModal,
    hasSyncModal,
    LABELS_MODAL,
    MODAL_PARAM,
    POSTPONE_MODAL,
    SYNC_MODAL,
};
