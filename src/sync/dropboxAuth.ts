import type { DropboxResponseError } from 'dropbox';
import { Dropbox, DropboxAuth } from 'dropbox';

const DROPBOX_CLIENT_ID = 'laodurqous9xun7';
const TOKEN_KEY = 'taskmaster_dropbox_token';
const REFRESH_TOKEN_KEY = 'taskmaster_dropbox_refresh_token';
const CODE_VERIFIER_KEY = 'taskmaster_dropbox_code_verifier';

function getStoredToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
}

function getStoredRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
}

function storeTokens(accessToken: string, refreshToken?: string) {
    localStorage.setItem(TOKEN_KEY, accessToken);
    if (refreshToken) {
        localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
}

function clearTokens() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(CODE_VERIFIER_KEY);
}

function isAuthenticated(): boolean {
    return !!getStoredToken();
}

function createAuth(): DropboxAuth {
    return new DropboxAuth({ clientId: DROPBOX_CLIENT_ID });
}

async function startAuthFlow(): Promise<string> {
    const auth = createAuth();

    const redirectUri = window.location.origin + window.location.pathname;
    const authUrl = await auth.getAuthenticationUrl(
        redirectUri,
        undefined,
        'code',
        'offline',
        undefined,
        undefined,
        true
    );

    const codeVerifier = auth.getCodeVerifier();
    localStorage.setItem(CODE_VERIFIER_KEY, codeVerifier);

    return authUrl as unknown as string;
}

async function handleAuthRedirect(): Promise<boolean> {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) {
        return false;
    }

    const codeVerifier = localStorage.getItem(CODE_VERIFIER_KEY);
    if (!codeVerifier) {
        return false;
    }

    const auth = createAuth();

    auth.setCodeVerifier(codeVerifier);
    const redirectUri = window.location.origin + window.location.pathname;
    const response = await auth.getAccessTokenFromCode(redirectUri, code);

    const result = response.result as { access_token: string; refresh_token?: string };
    storeTokens(result.access_token, result.refresh_token);
    localStorage.removeItem(CODE_VERIFIER_KEY);

    window.history.replaceState({}, '', window.location.pathname);
    return true;
}

function getDropboxClient(): Dropbox | null {
    const accessToken = getStoredToken();
    if (!accessToken) {
        return null;
    }

    const refreshToken = getStoredRefreshToken();
    return new Dropbox({
        accessToken,
        refreshToken: refreshToken ?? undefined,
        clientId: DROPBOX_CLIENT_ID,
    });
}

function persistTokensFromClient(dbx: Dropbox): void {
    if (typeof localStorage === 'undefined') {
        return;
    }
    const accessToken = (dbx as Dropbox & { auth: DropboxAuth }).auth.getAccessToken();
    if (accessToken && accessToken !== getStoredToken()) {
        localStorage.setItem(TOKEN_KEY, accessToken);
    }
}

function getDropboxErrorStatus(err: unknown): number | undefined {
    if (err && typeof err === 'object' && 'status' in err) {
        const status = (err as DropboxResponseError<unknown>).status;
        return typeof status === 'number' ? status : undefined;
    }
    return undefined;
}

function getDropboxErrorMessage(err: unknown): string {
    if (err instanceof Error) {
        return err.message;
    }
    if (err && typeof err === 'object' && 'error' in err) {
        const inner = (err as { error: unknown }).error;
        if (typeof inner === 'string') {
            return inner;
        }
        if (inner && typeof inner === 'object' && 'error_summary' in inner) {
            return String((inner as { error_summary: string }).error_summary);
        }
    }
    return 'Unknown Dropbox error';
}

async function tryRefreshAccessToken(): Promise<boolean> {
    const refreshToken = getStoredRefreshToken();
    if (!refreshToken) {
        return false;
    }

    const auth = createAuth();
    auth.setRefreshToken(refreshToken);
    auth.setClientId(DROPBOX_CLIENT_ID);

    try {
        await auth.refreshAccessToken();
        const accessToken = auth.getAccessToken();
        if (!accessToken) {
            return false;
        }
        storeTokens(accessToken, refreshToken);
        return true;
    } catch {
        return false;
    }
}

export {
    clearTokens,
    getDropboxClient,
    getDropboxErrorMessage,
    getDropboxErrorStatus,
    getStoredRefreshToken,
    getStoredToken,
    handleAuthRedirect,
    isAuthenticated,
    persistTokensFromClient,
    startAuthFlow,
    storeTokens,
    tryRefreshAccessToken,
};
