/**
 * Vitest Configuration
 * ====================
 * Vitest is a fast unit test runner built for ES modules.
 * Since our JS modules are pure functions (no DOM), we don't need
 * a browser environment — the default Node.js environment works perfectly.
 */
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    /* Where to find test files — any .test.js file in the tests/ directory */
    include: ['tests/**/*.test.js'],

    /* Use Node.js environment since our core logic has no DOM dependencies */
    environment: 'node',

    /* Show individual test results, not just summaries */
    reporter: 'verbose',
  },
});
