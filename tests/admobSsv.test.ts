import { generateKeyPairSync, sign } from 'node:crypto';
import { verifyAdMobSsvCallback } from '../src/server/admobSsv';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
  console.log('✅ ' + message);
}
const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const pem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
const now = 1_800_000_000_000;
function makeCallback(overrides: Record<string, string> = {}) {
  const fields: Record<string, string> = {
    ad_unit: 'ca-app-pub-123/456', custom_data: 'player-1', reward_amount: '100',
    reward_item: 'coins', timestamp: String(now), transaction_id: 'transaction-unique-1',
    user_id: 'player-1', ...overrides,
  };
  const signedData = new URLSearchParams(fields).toString();
  const signature = sign('sha256', Buffer.from(signedData), privateKey).toString('base64url');
  return signedData + '&signature=' + signature + '&key_id=123';
}
const fetchKeys = async () => [{ keyId: 123, pem }];
const verified = await verifyAdMobSsvCallback(makeCallback(), { fetchKeys, nowMs: now });
assert(verified.transactionId === 'transaction-unique-1', 'valid ECDSA signature returns transaction ID');
assert(verified.rewardAmount === 100 && verified.userId === 'player-1', 'verified callback fields are parsed');
let rejected = false;
const originalCallback = makeCallback();
const tamperedCallback = originalCallback.replace('user_id=player-1', 'user_id=attacker');
try { await verifyAdMobSsvCallback(tamperedCallback, { fetchKeys, nowMs: now }); } catch { rejected = true; }
assert(rejected, 'modified callback payload is rejected');
rejected = false;
try { await verifyAdMobSsvCallback(makeCallback(), { fetchKeys: async () => [{ keyId: 456, pem }], nowMs: now }); } catch { rejected = true; }
assert(rejected, 'unknown signing key is rejected');
rejected = false;
try { await verifyAdMobSsvCallback(makeCallback({ timestamp: String(now - 20 * 60 * 1000) }), { fetchKeys, nowMs: now }); } catch { rejected = true; }
assert(rejected, 'stale callback is rejected');
rejected = false;
try { await verifyAdMobSsvCallback(makeCallback() + '&extra=bad', { fetchKeys, nowMs: now }); } catch { rejected = true; }
assert(rejected, 'unexpected parameters after key ID are rejected');
