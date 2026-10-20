import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 30000,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:8000", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: { command: "cd .. && .venv/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8000", url: "http://127.0.0.1:8000/api/health", reuseExistingServer: true, timeout: 120000, env: { DATABASE_PATH: "/private/tmp/kanban-playwright.db" } },
});
