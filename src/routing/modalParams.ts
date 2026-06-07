const MODAL_PARAM = 'modal';

const SYNC_MODAL = 'sync';

/** Whether the sync settings modal is open in a query string. */
function hasSyncModal(search: string): boolean {
    return new URLSearchParams(search).get(MODAL_PARAM) === SYNC_MODAL;
}

export { hasSyncModal, MODAL_PARAM, SYNC_MODAL };
