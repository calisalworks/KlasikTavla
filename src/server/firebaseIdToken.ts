import { createPublicKey, verify as verifySignature } from 'node:crypto';

const GOOGLE_SECURETOKEN_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';
const MAX_CLOCK_SKEW_SECONDS = 60;

type Jwk = {
  kid?: string;
  kty?: string;
  alg?: string;
  use?: string;
  n?: string;
  e?: string;
};

type JwksResponse = { keys?: Jwk[] };

let cachedKeys: Jwk[] = [];
let keysExpiresAt = 0;
let keysRequest: Promise<Jwk[]> | null = null;

function decodeBase64UrlJson<T>(part: string): T {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as T;
}

async function getGoogleSigningKeys(): Promise<Jwk[]> {
  if (cachedKeys.length && Date.now() < keysExpiresAt) return cachedKeys;
  if (keysRequest) return keysRequest;

  keysRequest = (async () => {
    const response = await fetch(GOOGLE_SECURETOKEN_JWKS_URL, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) throw new Error('Firebase token signing keys are unavailable.');

    const body = (await response.json()) as JwksResponse;
    const keys = Array.isArray(body.keys)
      ? body.keys.filter((key) => key.kid && key.kty === 'RSA' && key.n && key.e)
      : [];
    if (!keys.length) throw new Error('Firebase token signing keys response was invalid.');

    const cacheControl = response.headers.get('cache-control') ?? '';
    const maxAgeMatch = cacheControl.match(/(?:^|,)\s*max-age=(\d+)/i);
    const maxAgeSeconds = maxAgeMatch ? Number(maxAgeMatch[1]) : 300;
    cachedKeys = keys;
    keysExpiresAt = Date.now() + Math.max(30, Math.min(maxAgeSeconds, 3600)) * 1000;
    return keys;
  })();

  try {
    return await keysRequest;
  } finally {
    keysRequest = null;
  }
}

/**
 * Verifies a Firebase Authentication ID token using Google's published
 * Secure Token public keys. This never trusts a UID supplied in a request body.
 * Set FIREBASE_PROJECT_ID on the server; absent configuration fails closed.
 */
export async function verifyFirebaseIdToken(token: string): Promise<{ uid: string; claims: Record<string, unknown> }> {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  if (!projectId) throw new Error('FIREBASE_PROJECT_ID is not configured.');

  const parts = token.split('.');
  if (parts.length !== 3 || parts.some((part) => !part)) {
    throw new Error('Invalid Firebase ID token format.');
  }

  let header: { alg?: string; kid?: string };
  let claims: Record<string, unknown>;
  try {
    header = decodeBase64UrlJson(parts[0]);
    claims = decodeBase64UrlJson<Record<string, unknown>>(parts[1]);
  } catch {
    throw new Error('Invalid Firebase ID token encoding.');
  }

  if (header.alg !== 'RS256' || typeof header.kid !== 'string' || !header.kid) {
    throw new Error('Unsupported Firebase ID token signing header.');
  }

  const keys = await getGoogleSigningKeys();
  const jwk = keys.find((key) => key.kid === header.kid);
  if (!jwk) {
    // Refresh once when an unknown kid may indicate Google rotated signing keys.
    cachedKeys = [];
    keysExpiresAt = 0;
    const refreshedKeys = await getGoogleSigningKeys();
    const refreshedJwk = refreshedKeys.find((key) => key.kid === header.kid);
    if (!refreshedJwk) throw new Error('Firebase ID token signing key is unknown.');
    return verifyClaimsAndSignature(parts, refreshedJwk, claims, projectId);
  }

  return verifyClaimsAndSignature(parts, jwk, claims, projectId);
}

function verifyClaimsAndSignature(
  parts: string[],
  jwk: Jwk,
  claims: Record<string, unknown>,
  projectId: string,
): { uid: string; claims: Record<string, unknown> } {
  const now = Math.floor(Date.now() / 1000);
  const uid = claims.sub;
  if (
    claims.iss !== `https://securetoken.google.com/${projectId}` ||
    claims.aud !== projectId ||
    typeof uid !== 'string' ||
    uid.length < 1 ||
    uid.length > 128 ||
    typeof claims.exp !== 'number' ||
    claims.exp <= now ||
    typeof claims.iat !== 'number' ||
    claims.iat > now + MAX_CLOCK_SKEW_SECONDS ||
    claims.iat <= 0 ||
    claims.exp <= claims.iat ||
    typeof claims.auth_time !== 'number' ||
    claims.auth_time <= 0 ||
    claims.auth_time > claims.iat ||
    claims.auth_time > now + MAX_CLOCK_SKEW_SECONDS
  ) {
    throw new Error('Firebase ID token claims are invalid or expired.');
  }

  const publicKey = createPublicKey({ key: jwk as import('node:crypto').JsonWebKey, format: 'jwk' });
  const signedContent = `${parts[0]}.${parts[1]}`;
  const signature = Buffer.from(parts[2], 'base64url');
  if (!verifySignature('RSA-SHA256', Buffer.from(signedContent), publicKey, signature)) {
    throw new Error('Firebase ID token signature is invalid.');
  }

  return { uid, claims };
}
