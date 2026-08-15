const ACCESS_COOKIE = "rr_outlook_access";
const REFRESH_COOKIE = "rr_outlook_refresh";
const EXPIRES_COOKIE = "rr_outlook_expires";
const STATE_COOKIE = "rr_outlook_state";
const VERIFIER_COOKIE = "rr_outlook_verifier";

export const OUTLOOK_SCOPES = [
  "openid",
  "profile",
  "offline_access",
  "User.Read",
  "Mail.ReadWrite",
].join(" ");

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

export type OutlookSession = {
  accessToken: string;
  setCookies: string[];
};

function base64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function randomValue(size = 32) {
  return base64Url(crypto.getRandomValues(new Uint8Array(size)));
}

async function digest(value: string) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function encryptionKey() {
  const secret = process.env.OUTLOOK_COOKIE_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("OUTLOOK_COOKIE_SECRET must contain at least 32 characters.");
  }
  return crypto.subtle.importKey("raw", await digest(secret), "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encrypt(value: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    await encryptionKey(),
    new TextEncoder().encode(value),
  );
  const packed = new Uint8Array(iv.length + encrypted.byteLength);
  packed.set(iv);
  packed.set(new Uint8Array(encrypted), iv.length);
  return base64Url(packed);
}

async function decrypt(value?: string) {
  if (!value) return null;
  try {
    const packed = fromBase64Url(value);
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: packed.slice(0, 12) },
      await encryptionKey(),
      packed.slice(12),
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    return null;
  }
}

export function parseCookies(request: Request) {
  const cookies: Record<string, string> = {};
  for (const pair of (request.headers.get("cookie") || "").split(";")) {
    const separator = pair.indexOf("=");
    if (separator < 0) continue;
    const name = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    if (name) cookies[name] = decodeURIComponent(value);
  }
  return cookies;
}

export function cookie(request: Request, name: string, value: string, maxAge: number) {
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}

export function clearOutlookCookies(request: Request) {
  return [ACCESS_COOKIE, REFRESH_COOKIE, EXPIRES_COOKIE, STATE_COOKIE, VERIFIER_COOKIE].map((name) =>
    cookie(request, name, "", 0),
  );
}

export function appendCookies(response: Response, cookies: string[]) {
  const mutable = new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: new Headers(response.headers),
  });
  for (const value of cookies) mutable.headers.append("Set-Cookie", value);
  return mutable;
}

export function outlookConfigured() {
  return Boolean(
    process.env.MICROSOFT_CLIENT_ID &&
    process.env.MICROSOFT_CLIENT_SECRET &&
    process.env.OUTLOOK_COOKIE_SECRET &&
    process.env.OUTLOOK_COOKIE_SECRET.length >= 32,
  );
}

function tenant() {
  return process.env.MICROSOFT_TENANT_ID || "common";
}

export function redirectUri(request: Request) {
  return process.env.MICROSOFT_REDIRECT_URI || `${new URL(request.url).origin}/api/outlook/callback`;
}

export async function createAuthorization(request: Request) {
  if (!outlookConfigured()) throw new Error("Outlook integration is not configured.");
  const state = randomValue(24);
  const verifier = randomValue(48);
  const challenge = base64Url(await digest(verifier));
  const query = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!,
    response_type: "code",
    redirect_uri: redirectUri(request),
    response_mode: "query",
    scope: OUTLOOK_SCOPES,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });

  return {
    url: `https://login.microsoftonline.com/${encodeURIComponent(tenant())}/oauth2/v2.0/authorize?${query}`,
    cookies: [
      cookie(request, STATE_COOKIE, state, 600),
      cookie(request, VERIFIER_COOKIE, verifier, 600),
    ],
  };
}

async function tokenRequest(params: URLSearchParams) {
  const response = await fetch(
    `https://login.microsoftonline.com/${encodeURIComponent(tenant())}/oauth2/v2.0/token`,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: params,
    },
  );
  const payload = (await response.json()) as TokenResponse;
  if (!response.ok || !payload.access_token) {
    throw new Error(payload.error_description || payload.error || "Microsoft token exchange failed.");
  }
  return payload;
}

async function sessionCookies(request: Request, token: TokenResponse, previousRefresh?: string | null) {
  const expiresAt = Date.now() + Math.max(60, token.expires_in || 3600) * 1000;
  const values = [
    cookie(request, ACCESS_COOKIE, await encrypt(token.access_token!), 60 * 60 * 24 * 30),
    cookie(request, EXPIRES_COOKIE, String(expiresAt), 60 * 60 * 24 * 30),
  ];
  const refreshToken = token.refresh_token || previousRefresh;
  if (refreshToken) {
    values.push(cookie(request, REFRESH_COOKIE, await encrypt(refreshToken), 60 * 60 * 24 * 30));
  }
  return values;
}

export async function redeemAuthorizationCode(request: Request, code: string, state: string) {
  const cookies = parseCookies(request);
  if (!cookies[STATE_COOKIE] || cookies[STATE_COOKIE] !== state || !cookies[VERIFIER_COOKIE]) {
    throw new Error("The Microsoft sign-in request expired. Please try again.");
  }
  const token = await tokenRequest(new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!,
    client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri(request),
    scope: OUTLOOK_SCOPES,
    code_verifier: cookies[VERIFIER_COOKIE],
  }));
  return [
    ...(await sessionCookies(request, token)),
    cookie(request, STATE_COOKIE, "", 0),
    cookie(request, VERIFIER_COOKIE, "", 0),
  ];
}

export async function getOutlookSession(request: Request): Promise<OutlookSession | null> {
  if (!outlookConfigured()) return null;
  const cookies = parseCookies(request);
  const accessToken = await decrypt(cookies[ACCESS_COOKIE]);
  if (!accessToken) return null;
  const expiresAt = Number(cookies[EXPIRES_COOKIE] || 0);
  if (expiresAt > Date.now() + 90_000) return { accessToken, setCookies: [] };

  const refreshToken = await decrypt(cookies[REFRESH_COOKIE]);
  if (!refreshToken) return null;
  try {
    const token = await tokenRequest(new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID!,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      scope: OUTLOOK_SCOPES,
    }));
    return {
      accessToken: token.access_token!,
      setCookies: await sessionCookies(request, token, refreshToken),
    };
  } catch {
    return null;
  }
}

export async function graphRequest(request: Request, path: string, init: RequestInit = {}) {
  const session = await getOutlookSession(request);
  if (!session) return null;
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${session.accessToken}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`https://graph.microsoft.com/v1.0${path}`, { ...init, headers });
  return { response, setCookies: session.setCookies };
}

export function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}
