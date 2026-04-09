import { Dropbox, DropboxAuth } from "dropbox";

const DROPBOX_CLIENT_ID = "laodurqous9xun7";
const TOKEN_KEY = "taskmaster_dropbox_token";
const REFRESH_TOKEN_KEY = "taskmaster_dropbox_refresh_token";
const CODE_VERIFIER_KEY = "taskmaster_dropbox_code_verifier";

function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function storeTokens(accessToken: string, refreshToken?: string) {
  localStorage.setItem(TOKEN_KEY, accessToken);
  if (refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
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
    "code",
    "offline",
    undefined,
    undefined,
    true,
  );

  const codeVerifier = auth.getCodeVerifier();
  localStorage.setItem(CODE_VERIFIER_KEY, codeVerifier);

  return authUrl as unknown as string;
}

async function handleAuthRedirect(): Promise<boolean> {
  const params = new URLSearchParams(window.location.search);
  const code = params.get("code");
  if (!code) return false;

  const codeVerifier = localStorage.getItem(CODE_VERIFIER_KEY);
  if (!codeVerifier) return false;

  const auth = createAuth();

  auth.setCodeVerifier(codeVerifier);
  const redirectUri = window.location.origin + window.location.pathname;
  const response = await auth.getAccessTokenFromCode(redirectUri, code);

  const result = response.result as { access_token: string; refresh_token?: string };
  storeTokens(result.access_token, result.refresh_token);
  localStorage.removeItem(CODE_VERIFIER_KEY);

  window.history.replaceState({}, "", window.location.pathname);
  return true;
}

function getDropboxClient(): Dropbox | null {
  const token = getStoredToken();
  if (!token) return null;
  return new Dropbox({ accessToken: token, clientId: DROPBOX_CLIENT_ID });
}

export {
  getStoredToken,
  isAuthenticated,
  startAuthFlow,
  handleAuthRedirect,
  getDropboxClient,
  clearTokens,
  storeTokens,
};
