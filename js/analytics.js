/**
 * analytics.js — Firebase Firestore Audit Logging
 * ==================================================
 * This module handles logging user actions to Firebase Firestore
 * for analytics purposes. Every comparison, copy, or theme toggle
 * gets recorded so you can analyze usage patterns later.
 *
 * ARCHITECTURE:
 * 1. `buildLogEntry()` — Pure function that constructs the log document.
 *    This is exported for testing (no Firebase dependency needed in tests).
 *
 * 2. `initAnalytics()` — Initializes the Firebase SDK and returns
 *    a `logAction()` function that writes to Firestore.
 *
 * 3. The rate limiter (separate module) decides whether a log is actually
 *    sent — this module just builds and sends the data.
 *
 * FIREBASE SDK:
 * We use Firebase's modular SDK (v9+) loaded from a CDN via import maps.
 * This tree-shakes unused code, keeping bundle size small.
 *
 * DATA FLOW:
 * User action → ui.js calls logAction() → analytics.js builds entry
 * → rate-limiter checks if allowed → if yes, write to Firestore
 */

import { sanitizeForStorage } from './utils.js';

// ============================================================================
// LOG ENTRY BUILDER (pure function — easy to test)
// ============================================================================

/**
 * Builds a structured log entry for Firestore.
 *
 * WHY A SEPARATE FUNCTION:
 * By separating "build the data" from "send to Firestore," we can
 * unit test the data structure without needing a Firebase connection.
 *
 * @param {object} params
 * @param {string} params.action - Action type (compare, copy, theme_toggle, page_load)
 * @param {string[]} params.listA - Items from List A (may be empty for non-compare actions)
 * @param {string[]} params.listB - Items from List B
 * @param {object} params.options - Comparison options used
 * @param {object} params.resultCounts - { aOnly, bOnly, intersection, union }
 * @param {object} params.analyticsConfig - { maxItemsPerList, maxItemLength }
 * @param {object} [params.clientInfo] - Browser/device info (optional, added at send time)
 * @returns {object} Structured log entry ready for Firestore
 */
export function buildLogEntry(params) {
  const {
    action,
    listA = [],
    listB = [],
    options = {},
    resultCounts = {},
    analyticsConfig = {},
    clientInfo = null,
  } = params;

  const limits = {
    maxItems: analyticsConfig.maxItemsPerList || 100,
    maxItemLength: analyticsConfig.maxItemLength || 200,
  };

  /* Sanitize both input lists — truncate if they exceed storage limits */
  const sanitizedA = sanitizeForStorage(listA, limits);
  const sanitizedB = sanitizeForStorage(listB, limits);

  /* Determine if ANY truncation occurred across either list */
  const dataTruncated = sanitizedA.truncated || sanitizedB.truncated;

  /* Build the base entry */
  const entry = {
    action,
    timestamp: new Date().toISOString(),
    inputSizeA: listA.length,
    inputSizeB: listB.length,
    options,
    resultCounts,
    inputSampleA: sanitizedA.data,
    inputSampleB: sanitizedB.data,
    dataTruncated,
  };

  /* Only include truncation details if truncation actually happened.
   * This keeps the Firestore document smaller for normal-sized inputs. */
  if (dataTruncated) {
    entry.truncationDetails = {
      listATruncated: sanitizedA.details.listTruncated,
      listBTruncated: sanitizedB.details.listTruncated,
      originalSizeA: sanitizedA.details.originalSize,
      originalSizeB: sanitizedB.details.originalSize,
      storedSizeA: sanitizedA.details.storedSize,
      storedSizeB: sanitizedB.details.storedSize,
      itemsLengthCappedA: sanitizedA.details.itemsLengthCapped,
      itemsLengthCappedB: sanitizedB.details.itemsLengthCapped,
    };
  }

  /* Add client info if provided */
  if (clientInfo) {
    entry.clientInfo = clientInfo;
  }

  return entry;
}

// ============================================================================
// FIREBASE INITIALIZATION & LOGGING
// ============================================================================

/**
 * Initializes Firebase and returns a logging function.
 *
 * HOW IT WORKS:
 * 1. Imports Firebase SDK modules (app, firestore) from the CDN
 * 2. Initializes the Firebase app with the provided config
 * 3. Returns a `logAction()` function bound to the Firestore instance
 *
 * WHY DYNAMIC IMPORT:
 * Firebase SDK is loaded dynamically from the CDN via importmap in index.html.
 * This avoids bundling Firebase into our code and lets the browser cache it.
 *
 * @param {object} firebaseConfig - Firebase configuration from config.json
 * @param {object} analyticsConfig - Analytics settings (collection name, limits)
 * @param {object} rateLimiter - Rate limiter instance
 * @returns {Function} logAction(params) — async function to log an action
 */
export async function initAnalytics(firebaseConfig, analyticsConfig, rateLimiter) {
  /*
   * If analytics is disabled in config, return a no-op function.
   * This lets the rest of the code call logAction() without checking
   * if analytics is enabled — the function just does nothing.
   */
  if (!firebaseConfig || !analyticsConfig?.enabled) {
    return async () => {}; // No-op function
  }

  try {
    /* Import Firebase modules from the CDN (defined in index.html importmap) */
    const { initializeApp } = await import('firebase/app');
    const { getFirestore, collection, addDoc, serverTimestamp } = await import('firebase/firestore');

    /* Initialize Firebase app */
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    /* Get the collection name from config */
    const collectionName = analyticsConfig.collectionName || 'audit_logs';

    /**
     * Logs an action to Firestore.
     *
     * FLOW:
     * 1. Check rate limiter — if blocked, silently skip
     * 2. Build the log entry
     * 3. Add server timestamp (more accurate than client timestamp)
     * 4. Write to Firestore
     * 5. Errors are caught and logged to console (never thrown to UI)
     *
     * @param {object} params - Same params as buildLogEntry
     */
    return async function logAction(params) {
      try {
        /* Check rate limiter first */
        if (rateLimiter && !rateLimiter.canPerform(params.action)) {
          return; // Silently skip — rate limited
        }

        /* Build the structured log entry */
        const entry = buildLogEntry({
          ...params,
          analyticsConfig,
        });

        /*
         * Replace our ISO timestamp with Firestore's server timestamp.
         * Server timestamps are more reliable because they use Google's
         * NTP-synced servers instead of the user's potentially wrong clock.
         */
        entry.serverTimestamp = serverTimestamp();

        /* Write to Firestore */
        await addDoc(collection(db, collectionName), entry);
      } catch (error) {
        /*
         * NEVER let analytics errors break the UI.
         * If Firestore is down, the user should still be able to
         * compare lists perfectly fine. Log for debugging only.
         */
        console.warn('[ListDiff Analytics] Failed to log action:', error.message);
      }
    };
  } catch (error) {
    console.warn('[ListDiff Analytics] Failed to initialize Firebase:', error.message);
    return async () => {}; // Return no-op on initialization failure
  }
}
