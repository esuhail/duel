import { defineConfig, devices } from "@playwright/test";

// PW_CHROME_PATH lets the tests use an already-installed Chrome
// (e.g. in sandboxes where Playwright can't download its own).
const executablePath = process.env.PW_CHROME_PATH || undefined;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  use: {
    baseURL: "http://localhost:4173",
    ...devices["Pixel 7"],
    launchOptions: { executablePath },
  },
  webServer: {
    command: "npm run build && npx vite preview --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
