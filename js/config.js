/**
 * config.js — Configuration Loader
 * ===================================
 * Loads the master config.json file and makes it available to all modules.
 *
 * HOW IT WORKS:
 * 1. Fetches config.json via HTTP (same-origin request)
 * 2. Parses the JSON response
 * 3. Freezes the object so no module can accidentally modify it
 * 4. Stores it in a module-level variable for subsequent imports
 *
 * WHY FETCH INSTEAD OF IMPORT:
 * JSON files can be imported as ES modules in some environments,
 * but browser support isn't universal. fetch() works everywhere
 * and doesn't require any build tooling.
 *
 * WHY FREEZE:
 * Object.freeze() prevents accidental mutations. If module A modifies
 * the config, module B would see the changed values — that's a bug.
 * Freezing makes the config truly read-only at runtime.
 *
 * USAGE:
 *   import { loadConfig, getConfig } from './config.js';
 *   await loadConfig();           // Call once at startup
 *   const cfg = getConfig();      // Use anywhere after that
 */

/** Module-level variable to store the loaded config */
let config = null;

/**
 * Loads config.json from the server.
 * Call this once during app initialization (in app.js).
 *
 * WHY ASYNC:
 * fetch() is asynchronous — it makes an HTTP request. We need to
 * `await` the response before we can use the config values.
 *
 * ERROR HANDLING:
 * If config.json fails to load (network error, missing file),
 * we fall back to sensible defaults. The app should still work
 * without config — just with default settings.
 *
 * @returns {object} The loaded (or default) configuration
 */
export async function loadConfig() {
  try {
    /*
     * Try loading a local configuration first (for development overrides).
     * This file is ignored by git (.gitignore) so it's safe for secrets.
     * Use a relative path so it works regardless of where the app is hosted.
     */
    let response;
    try {
      const localResponse = await fetch('./config.local.json');
      if (localResponse.ok) {
        response = localResponse;
        console.log('[ListDiff Config] Using local configuration overrides');
      } else {
        response = await fetch('./config.json');
      }
    } catch (e) {
      /* fetch() might throw if file doesn't exist in some environments */
      response = await fetch('./config.json');
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    /*
     * Object.freeze() makes the object immutable.
     * NOTE: This is a shallow freeze — nested objects are still mutable.
     * For our use case (simple config values), shallow freeze is sufficient.
     * For deep freeze, you'd recursively freeze all nested objects.
     */
    config = Object.freeze(data);
  } catch (error) {
    console.warn('[ListDiff Config] Failed to load config.json, using defaults:', error.message);
    config = Object.freeze(getDefaults());
  }

  return config;
}

/**
 * Returns the current configuration.
 * Must be called after loadConfig() has completed.
 *
 * @returns {object} The configuration object
 * @throws {Error} If called before loadConfig()
 */
export function getConfig() {
  if (!config) {
    throw new Error(
      '[ListDiff Config] Config not loaded yet. Call loadConfig() first.'
    );
  }
  return config;
}

/**
 * Returns default configuration values.
 * Used as a fallback when config.json fails to load.
 *
 * These should mirror the structure of config.json so the app
 * works correctly even without the config file.
 */
function getDefaults() {
  return {
    site: {
      name: 'ListDiff',
      tagline: 'Compare lists instantly',
      description: 'A clean, fast tool to compare two lists.',
      basePath: '/listdiff',
      version: '1.0.0',
      footerText: 'Made with ♡',
    },
    firebase: null, // Analytics disabled without config
    analytics: {
      enabled: false,
      collectionName: 'audit_logs',
      maxItemsPerList: 100,
      maxItemLength: 200,
      rateLimits: {
        compare: 3000,
        copy: 2000,
        theme_toggle: 2000,
        page_load: 'once',
      },
    },
    defaults: {
      caseSensitive: true,
      ignoreBeginEndSpaces: true,
      ignoreExtraSpaces: true,
      ignoreLeadingZeroes: false,
      lineNumbered: false,
      sortOption: 'none',
      caseTransform: 'none',
      theme: 'light',
    },
    features: {
      themeToggle: true,
      splitDialog: true,
      toastNotifications: true,
      keyboardShortcuts: true,
      liveCounts: true,
    },
  };
}
