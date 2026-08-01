import { defineConfig, devices } from "@playwright/test";

/**
 * The small Chromium suite that covers what jsdom structurally cannot answer.
 *
 * Everything asserted here depends on the real platform rather than on the
 * application's own logic: the top layer a native `<dialog>` opens into, which
 * surface Escape belongs to when two are stacked, where focus lands afterwards,
 * and whether the page overflows at the narrowest viewport it claims to serve.
 * The unit suite already covers the reasoning; this covers the browser.
 *
 * It runs against the production build rather than the dev server, because that
 * is the artifact Pages deploys and the one whose console has to be clean.
 */

const PORT = 4173;
const ORIGIN = `http://127.0.0.1:${PORT}`;
const isCI = process.env["CI"] !== undefined;

export default defineConfig({
  testDir: "tests/browser",
  // Deliberately not `.test.ts` or `.spec.ts`: Vitest claims both by default and
  // runs the whole tree, so a browser spec under either name would be dragged
  // into jsdom by `npm test` and fail for reasons that mean nothing.
  testMatch: "**/*.browser.ts",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  // Spread rather than passed as `undefined`: the project builds with
  // `exactOptionalPropertyTypes`, where an absent property and one set to
  // `undefined` are not the same thing. Absent means "one worker per core",
  // which is the local default worth keeping.
  ...isCI ? { workers: 1 } : {},
  reporter: "list",
  use: {
    baseURL: ORIGIN,
    trace: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // `--host` is explicit because Vite's default binding resolves to IPv6
    // loopback only, and the runner would wait out its timeout on an address
    // nothing is listening at.
    command: `npm run preview -- --port ${PORT} --strictPort --host 127.0.0.1`,
    url: ORIGIN,
    reuseExistingServer: !isCI,
    timeout: 120_000,
  },
});
