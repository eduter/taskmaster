const MODAL_PARAM = 'modal';

const SYNC_MODAL = 'sync';
const LABELS_MODAL = 'labels';

/** Whether the sync settings modal is open in a query string. */
function hasSyncModal(search: string): boolean {
    return new URLSearchParams(search).get(MODAL_PARAM) === SYNC_MODAL;
}

/** Whether the labels picker modal is open in a query string. */
function hasLabelsModal(search: string): boolean {
    return new URLSearchParams(search).get(MODAL_PARAM) === LABELS_MODAL;
}

/** Whether a modal overlay should survive route helper navigation. */
function hasOverlayModal(search: string): boolean {
    return hasSyncModal(search) || hasLabelsModal(search);
}

export { hasLabelsModal, hasOverlayModal, hasSyncModal, LABELS_MODAL, MODAL_PARAM, SYNC_MODAL };
