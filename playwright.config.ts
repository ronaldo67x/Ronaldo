import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://127.0.0.1:4000',
  },
  webServer: {
    command: 'npm run dev --workspace @ronaldo/api',
    url: 'http://127.0.0.1:4000/api/v1/health',
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
