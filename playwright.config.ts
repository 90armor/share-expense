import path from "node:path";
import { defineConfig, devices } from "@playwright/test";

// Own port: the Docker dev app holds 3000.
const PORT = 3100;
const BASE_URL = `http://127.0.0.1:${PORT}`;
// Own scratch DB, never ./data/dev.db or ./data/docker.db. Migrated with
// db:deploy and never reset: every test creates its own group.
const DATABASE_URL = `file:${path.join(__dirname, "data", "e2e.db")}`;

export default defineConfig({
  testDir: "e2e",
  forbidOnly: !!process.env.CI,
  // A flaky test must fail, not pass on a retry.
  retries: 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // Production build, not `next dev`: Cache Components behaves differently
    // in dev, and this is what users get.
    command: `npm run db:deploy && npm run build && npm run start -- --hostname 127.0.0.1 --port ${PORT}`,
    // 200 only when SQLite answers, so tests never start against a broken DB.
    url: `${BASE_URL}/api/health`,
    // Merged over process.env; dotenv and Next never override a set variable.
    env: { DATABASE_URL },
    // Never test against whatever else might be listening on the port.
    reuseExistingServer: false,
    // Covers db:deploy + next build + start.
    timeout: 240_000,
  },
});
