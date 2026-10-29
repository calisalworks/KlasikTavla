import { spawn, type ChildProcess } from 'node:child_process';

const PORT = 3107;
const BASE_URL = `http://127.0.0.1:${PORT}`;
let serverProcess: ChildProcess | undefined;

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
  console.log(`✅ ${message}`);
}

async function waitForHealth(child: ChildProcess): Promise<void> {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Production-mode test server exited early (code ${child.exitCode}).`);
    }
    try {
      const response = await fetch(`${BASE_URL}/api/health`);
      if (response.ok) return;
    } catch {
      // The server may still be starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Production-mode test server did not become healthy within 20 seconds.');
}

async function run(): Promise<void> {
  serverProcess = spawn('bun', ['run', 'start'], {
    env: { ...process.env, NODE_ENV: 'production', PORT: String(PORT) },
    stdio: 'ignore',
  });

  try {
    await waitForHealth(serverProcess);

    const response = await fetch(`${BASE_URL}/api/coins/claim-ad`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // This header must never bypass the production fail-closed guard.
        'x-test-suite': 'true',
      },
      body: JSON.stringify({
        userId: 'security-test-user',
        adProof: `proof_${Date.now()}_not-google-signed`,
      }),
    });

    const body = await response.json() as { code?: string; success?: boolean; coinsAdded?: number };
    assert(response.status === 503, `production ad claim returns 503 (got ${response.status})`);
    assert(body.code === 'ADMOB_SSV_NOT_CONFIGURED', 'response identifies missing AdMob SSV configuration');
    assert(body.success !== true && body.coinsAdded === undefined, 'response grants no client-claimed ad reward');
  } finally {
    if (serverProcess && serverProcess.exitCode === null) {
      serverProcess.kill('SIGTERM');
    }
  }
}

run().catch((error) => {
  console.error('❌ Production fail-closed test failed:', error);
  process.exitCode = 1;
});
