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

export { hasLabelsModal, hasSyncModal, LABELS_MODAL, MODAL_PARAM, SYNC_MODAL };
