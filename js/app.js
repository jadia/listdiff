/**
 * app.js — Main Application Entry Point
 * ========================================
 * This is the "conductor" — it initializes all modules in the right order
 * and wires them together. No business logic lives here, just orchestration.
 *
 * BOOT SEQUENCE:
 * 1. Load configuration (config.json)
 * 2. Initialize theme (light/dark)
 * 3. Initialize analytics (Firebase Firestore)
 * 4. Initialize UI (DOM bindings + event listeners)
 * 5. Log a page_load event for analytics
 *
 * WHY A SEPARATE ENTRY POINT:
 * Each module (config, theme, analytics, ui) is independent and focused
 * on one job. app.js is the only file that knows about all of them and
 * connects them together. This is the "composition root" pattern.
 */

import { loadConfig } from './config.js';
import { initTheme } from './theme.js';
import { initAnalytics } from './analytics.js';
import { createRateLimiter } from './rate-limiter.js';
import { initUI } from './ui.js';
import { getClientInfo } from './utils.js';

/**
 * Application boot function.
 *
 * We wrap everything in an async IIFE (Immediately Invoked Function Expression)
 * because top-level await isn't supported in all module contexts.
 *
 * ERROR HANDLING:
 * Each initialization step is wrapped to prevent one failure from
 * breaking the entire app. If analytics fails, the comparison tool
 * should still work perfectly.
 */
(async function boot() {
  try {
    // ----------------------------------------
    // Step 1: Load configuration
    // ----------------------------------------
    const config = await loadConfig();
    console.log(`[ListDiff] v${config.site?.version || '?'} loaded`);

    // ----------------------------------------
    // Step 2: Initialize theme
    // ----------------------------------------
    let logAction = async () => {};

    if (config.features?.themeToggle) {
      initTheme(config.defaults?.theme || 'light', (newTheme) => {
        /* Theme change callback — log to analytics */
        logAction({
          action: 'theme_toggle',
          listA: [],
          listB: [],
          options: { newTheme },
          resultCounts: {},
        });
      });
    }

    // ----------------------------------------
    // Step 3: Initialize analytics
    // ----------------------------------------
    try {
      const rateLimiter = createRateLimiter(config.analytics?.rateLimits || {});
      logAction = await initAnalytics(config.firebase, config.analytics, rateLimiter);
    } catch (error) {
      console.warn('[ListDiff] Analytics initialization failed:', error.message);
      /* logAction remains a no-op — app works without analytics */
    }

    // ----------------------------------------
    // Step 4: Initialize UI
    // ----------------------------------------
    initUI(config, logAction);

    // ----------------------------------------
    // Step 5: Log page load event
    // ----------------------------------------
    logAction({
      action: 'page_load',
      listA: [],
      listB: [],
      options: {},
      resultCounts: {},
      clientInfo: getClientInfo(),
    });

    console.log('[ListDiff] Ready!');
  } catch (error) {
    console.error('[ListDiff] Boot failed:', error);
    /*
     * Even if boot fails catastrophically, the HTML is still there.
     * The user can still paste text and see it — they just won't have
     * the interactive features. This is "progressive enhancement."
     */
  }
})();
