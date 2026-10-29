import { generateKeyPairSync, sign } from 'node:crypto';
import { verifyFirebaseIdToken } from '../src/server/firebaseIdToken.ts';

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
  console.log(`✅ ${message}`);
}

const originalFetch = globalThis.fetch;
const originalProjectId = process.env.FIREBASE_PROJECT_ID;
const projectId = 'klassik-tavla-auth-test';
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const exported = publicKey.export({ format: 'jwk' });
const signingKey = {
  ...exported,
  kid: 'test-signing-key',
  kty: 'RSA',
  alg: 'RS256',
  use: 'sig',
};

function makeToken(overrides: Record<string, unknown> = {}, keyId = 'test-signing-key'): string {
  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: keyId, typ: 'JWT' })).toString('base64url');
  const claims = Buffer.from(JSON.stringify({
    iss: `https://securetoken.google.com/${projectId}`,
    aud: projectId,
    sub: 'test-user-123',
    iat: now - 10,
    auth_time: now - 20,
    exp: now + 3600,
    ...overrides,
  })).toString('base64url');
  const unsigned = `${header}.${claims}`;
  return `${unsigned}.${sign('RSA-SHA256', Buffer.from(unsigned), privateKey).toString('base64url')}`;
}

async function run(): Promise<void> {
  process.env.FIREBASE_PROJECT_ID = projectId;
  globalThis.fetch = (async () => new Response(JSON.stringify({ keys: [signingKey] }), {
    status: 200,
    headers: { 'content-type': 'application/json', 'cache-control': 'max-age=300' },
  })) as typeof fetch;

  try {
    let malformedRejected = false;
    try {
      await verifyFirebaseIdToken('not-a-jwt');
    } catch {
      malformedRejected = true;
    }
    assert(malformedRejected, 'rejects malformed token input');

    delete process.env.FIREBASE_PROJECT_ID;
    let missingConfigRejected = false;
    try {
      await verifyFirebaseIdToken(makeToken());
    } catch {
      missingConfigRejected = true;
    }
    assert(missingConfigRejected, 'fails closed when Firebase project configuration is missing');
    process.env.FIREBASE_PROJECT_ID = projectId;

    const valid = await verifyFirebaseIdToken(makeToken());
    assert(valid.uid === 'test-user-123', 'verifies a correctly signed Firebase ID token and returns its UID');

    let badSignatureRejected = false;
    try {
      const token = makeToken();
      const parts = token.split('.');
      parts[2] = `${parts[2].slice(0, -2)}aa`;
      await verifyFirebaseIdToken(parts.join('.'));
    } catch {
      badSignatureRejected = true;
    }
    assert(badSignatureRejected, 'rejects a token with a tampered signature');

    let expiredRejected = false;
    try {
      await verifyFirebaseIdToken(makeToken({ exp: Math.floor(Date.now() / 1000) - 1 }));
    } catch {
      expiredRejected = true;
    }
    assert(expiredRejected, 'rejects an expired Firebase ID token');

    let wrongAudienceRejected = false;
    try {
      await verifyFirebaseIdToken(makeToken({ aud: 'another-project' }));
    } catch {
      wrongAudienceRejected = true;
    }
    assert(wrongAudienceRejected, 'rejects a token issued for a different Firebase project');

    let wrongIssuerRejected = false;
    try {
      await verifyFirebaseIdToken(makeToken({ iss: 'https://securetoken.google.com/another-project' }));
    } catch {
      wrongIssuerRejected = true;
    }
    assert(wrongIssuerRejected, 'rejects a token with the wrong issuer');

    const now = Math.floor(Date.now() / 1000);
    const invalidClaimsCases = [
      { overrides: { iat: now + 120 }, label: 'rejects a token issued too far in the future' },
      { overrides: { auth_time: 0 }, label: 'rejects a token with a non-positive authentication time' },
      { overrides: { auth_time: now + 60 }, label: 'rejects authentication time later than token issue time' },
      { overrides: { exp: now + 10, iat: now + 20 }, label: 'rejects a token whose expiry precedes issue time' },
    ];

    for (const item of invalidClaimsCases) {
      let rejected = false;
      try {
        await verifyFirebaseIdToken(makeToken(item.overrides));
      } catch {
        rejected = true;
      }
      assert(rejected, item.label);
    }

    let unknownKeyRejected = false;
    try {
      await verifyFirebaseIdToken(makeToken({}, 'unknown-signing-key'));
    } catch {
      unknownKeyRejected = true;
    }
    assert(unknownKeyRejected, 'rejects tokens signed with an unknown key ID after refreshing Google keys');
  } finally {
    globalThis.fetch = originalFetch;
    if (originalProjectId === undefined) delete process.env.FIREBASE_PROJECT_ID;
    else process.env.FIREBASE_PROJECT_ID = originalProjectId;
  }
}

run().catch((error) => {
  console.error('❌ Firebase ID-token verification test failed:', error);
  process.exitCode = 1;
});
