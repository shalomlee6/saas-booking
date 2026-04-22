/**
 * When `USE_REAL_API=true`, seeds predictable data before tests.
 * Requires API `E2E_TEST_SEED_SECRET` and `SUPER_ADMIN_EMAILS` to include the seeded super-admin email.
 */
async function globalSetup(): Promise<void> {
  if (process.env.USE_REAL_API !== 'true') return;

  const base = (process.env.PLAYWRIGHT_API_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
  const secret = process.env.E2E_TEST_SEED_SECRET;
  if (!secret) {
    throw new Error(
      'USE_REAL_API=true requires E2E_TEST_SEED_SECRET to be set (must match the API env var).'
    );
  }

  const res = await fetch(`${base}/api/admin/test-seed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-e2e-test-seed-secret': secret,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`E2E test seed failed: ${res.status} ${text}`);
  }
}

export default globalSetup;
