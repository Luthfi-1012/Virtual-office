import { defineConfig } from '@playwright/test';

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3100';

export default defineConfig({
  testDir: './tests', testMatch: '**/*.spec.ts', workers: 1, retries: 0,
  timeout: 45000, expect: { timeout: 10000 },
  use: { baseURL, channel: 'msedge', viewport: { width: 1440, height: 1000 }, screenshot: 'only-on-failure' },
  webServer: {
    command: process.env.PLAYWRIGHT_PRODUCTION === '1' ? 'npm run start -- --port 3100' : 'npm run dev -- --port 3100',
    url: baseURL, reuseExistingServer: Boolean(process.env.PLAYWRIGHT_BASE_URL), timeout: 120000,
    env: { OFFICE_DB_PATH: `.local/browser-${Date.now()}.sqlite`, NEXT_TELEMETRY_DISABLED: '1', QODERWAKE_CLI_PATH: 'qoderwake-unavailable-for-tests' },
  },
});
