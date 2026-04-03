/**
 * rate-limiter.js — Client-Side Rate Limiting
 * =============================================
 * Prevents abuse of the Firestore audit logging by limiting how often
 * certain actions can be logged.
 *
 * WHY CLIENT-SIDE RATE LIMITING?
 * Our Firestore rules allow anyone to write to audit_logs (since we have
 * no authentication). Without rate limiting, a malicious user could flood
 * the database with thousands of writes per second. Client-side limiting
 * isn't bulletproof (someone could bypass it), but it prevents accidental
 * abuse and discourages casual abuse.
 *
 * PATTERN: Token Bucket (simplified)
 * - Each action type has a cooldown period
 * - After an action is logged, it can't be logged again until the cooldown expires
 * - Different action types have independent cooldowns
 * - "once" type actions (like page_load) can only fire once per session
 *
 * NOTE: This is NOT a replacement for server-side rate limiting.
 * For a production app, you'd also add Firebase security rules that
 * limit write frequency. For this educational project, client-side is sufficient.
 */

/**
 * Creates a new rate limiter instance.
 *
 * FACTORY FUNCTION:
 * Instead of using a class, we use a factory function that returns an object.
 * The internal state (lastActionTimes, onceFired) is enclosed in the closure —
 * it's private and can't be accessed from outside.
 *
 * @param {object} rateLimits - Map of action type → cooldown in ms (or "once")
 *   Example: { compare: 3000, copy: 2000, page_load: "once" }
 * @returns {object} Rate limiter with a `canPerform(action)` method
 */
export function createRateLimiter(rateLimits = {}) {
  /*
   * Internal state:
   * - lastActionTimes: Map of action → timestamp of last allowed execution
   * - onceFired: Set of action types that have fired once (for "once" actions)
   */
  const lastActionTimes = new Map();
  const onceFired = new Set();

  return {
    /**
     * Checks whether an action is allowed right now.
     *
     * LOGIC:
     * 1. If no limit is configured for this action → always allow
     * 2. If the limit is "once" → allow only if it hasn't fired before
     * 3. If the limit is a number → allow only if enough time has passed
     *
     * SIDE EFFECT: If allowed, records the current time as the last action time.
     * This means calling canPerform() is both a check AND a consume operation.
     *
     * @param {string} actionType - The type of action (e.g., 'compare', 'copy')
     * @returns {boolean} True if the action is allowed
     */
    canPerform(actionType) {
      const limit = rateLimits[actionType];

      /* No limit configured for this action — always allow */
      if (limit === undefined || limit === null) {
        return true;
      }

      /* "once" — only allow the first time in this session */
      if (limit === 'once') {
        if (onceFired.has(actionType)) {
          return false;
        }
        onceFired.add(actionType);
        return true;
      }

      /* Numeric limit — check if enough time has elapsed */
      const now = Date.now();
      const lastTime = lastActionTimes.get(actionType) || 0;

      if (now - lastTime >= limit) {
        lastActionTimes.set(actionType, now);
        return true;
      }

      /* Too soon — action is rate-limited */
      return false;
    },

    /**
     * Resets all rate limiting state.
     * Useful for testing or when the user reloads the page.
     */
    reset() {
      lastActionTimes.clear();
      onceFired.clear();
    },
  };
}
