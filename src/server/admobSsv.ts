import { createPublicKey, verify as verifySignature } from 'node:crypto';

const GOOGLE_SSV_KEYS_URL = 'https://www.gstatic.com/admob/reward/verifier-keys.json';
const KEY_CACHE_TTL_MS = 60 * 60 * 1000;

export interface AdMobSsvKey { keyId: number; pem: string }
export interface VerifiedAdMobSsvCallback {
  adUnit: string; customData?: string; keyId: number; rewardAmount: number;
  rewardItem: string; timestamp: number; transactionId: string; userId: string;
}
type KeyFetcher = () => Promise<AdMobSsvKey[]>;
let cachedKeys: AdMobSsvKey[] = [];
let keysFetchedAt = 0;

async function fetchGoogleKeys(): Promise<AdMobSsvKey[]> {
  const response = await fetch(GOOGLE_SSV_KEYS_URL, { signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error('Google AdMob verifier keys unavailable');
  const payload = await response.json() as { keys?: Array<{ keyId?: number; pem?: string }> };
  if (!Array.isArray(payload.keys)) throw new Error('Invalid Google AdMob verifier key response');
  const keys = payload.keys.filter(
    (key): key is { keyId: number; pem: string } =>
      Number.isSafeInteger(key.keyId) && typeof key.pem === 'string' && key.pem.includes('BEGIN PUBLIC KEY'),
  ).map(({ keyId, pem }) => ({ keyId, pem }));
  if (!keys.length) throw new Error('No usable Google AdMob verifier keys');
  return keys;
}

async function getGoogleKeys(fetchKeys: KeyFetcher, forceRefresh = false): Promise<AdMobSsvKey[]> {
  if (!forceRefresh && fetchKeys === fetchGoogleKeys &&
      cachedKeys.length && Date.now() - keysFetchedAt < KEY_CACHE_TTL_MS) {
    return cachedKeys;
  }
  const keys = await fetchKeys();
  if (fetchKeys === fetchGoogleKeys) {
    cachedKeys = keys;
    keysFetchedAt = Date.now();
  }
  return keys;
}

/** Verifies the exact raw query. Do not rebuild it from parsed params: ordering and encoding are signed. */
export async function verifyAdMobSsvCallback(
  rawQuery: string,
  options: { fetchKeys?: KeyFetcher; nowMs?: number; maxAgeMs?: number } = {},
): Promise<VerifiedAdMobSsvCallback> {
  const query = rawQuery.startsWith('?') ? rawQuery.slice(1) : rawQuery;
  const marker = query.lastIndexOf('&signature=');
  if (marker <= 0 || !/&signature=[^&]+&key_id=\d+$/.test(query)) {
    throw new Error('Malformed AdMob SSV callback query');
  }
  const signedData = query.slice(0, marker);
  const params = new URLSearchParams(query);
  const tailParams = new URLSearchParams(query.slice(marker + 1));
  const signatureValue = tailParams.get('signature');
  const keyId = Number(tailParams.get('key_id'));
  if (!signatureValue || !Number.isSafeInteger(keyId) || keyId <= 0) {
    throw new Error('Missing AdMob SSV signature or key ID');
  }
  const fetchKeys = options.fetchKeys ?? fetchGoogleKeys;
  let keys = await getGoogleKeys(fetchKeys);
  let key = keys.find((candidate) => candidate.keyId === keyId);
  if (!key) {
    // Google can rotate verifier keys before the in-memory cache expires.
    keys = await getGoogleKeys(fetchKeys, true);
    key = keys.find((candidate) => candidate.keyId === keyId);
  }
  if (!key) throw new Error('Unknown AdMob SSV key ID');
  if (!/^[A-Za-z0-9_-]+$/.test(signatureValue) || signatureValue.length % 4 === 1) {
    throw new Error('Malformed AdMob SSV signature encoding');
  }

  const signature = Buffer.from(signatureValue.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  const validSignature = verifySignature('sha256', Buffer.from(signedData, 'utf8'), createPublicKey(key.pem), signature);
  if (!validSignature) throw new Error('Invalid AdMob SSV signature');

  const transactionId = params.get('transaction_id') ?? '';
  const userId = params.get('user_id') ?? '';
  const adUnit = params.get('ad_unit') ?? '';
  const rewardItem = params.get('reward_item') ?? '';
  const rewardAmount = Number(params.get('reward_amount'));
  const timestamp = Number(params.get('timestamp'));
  if (!transactionId || !userId || !adUnit || !rewardItem ||
      !Number.isSafeInteger(rewardAmount) || rewardAmount <= 0 ||
      !Number.isSafeInteger(timestamp) || timestamp <= 0) {
    throw new Error('Missing or invalid required AdMob SSV fields');
  }
  const nowMs = options.nowMs ?? Date.now();
  if (timestamp > nowMs + 60_000 || nowMs - timestamp > (options.maxAgeMs ?? 10 * 60 * 1000)) {
    throw new Error('AdMob SSV callback timestamp outside allowed window');
  }
  return { adUnit, customData: params.get('custom_data') ?? undefined, keyId, rewardAmount, rewardItem, timestamp, transactionId, userId };
}
