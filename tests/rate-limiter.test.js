/**
 * rate-limiter.test.js — Tests for Client-Side Rate Limiting
 * ============================================================
 * Tests verify that the rate limiter correctly allows/blocks actions
 * based on configured cooldown periods.
 *
 * NOTE: We use Vitest's fake timer API (vi.useFakeTimers) to control
 * time progression, so tests don't need real delays.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRateLimiter } from '../js/rate-limiter.js';

describe('createRateLimiter', () => {
  beforeEach(() => {
    /* Replace real timers with fake ones so we can control Date.now() */
    vi.useFakeTimers();
  });

  afterEach(() => {
    /* Restore real timers after each test */
    vi.useRealTimers();
  });

  it('allows the first action', () => {
    const limiter = createRateLimiter({ compare: 3000 });
    expect(limiter.canPerform('compare')).toBe(true);
  });

  it('blocks immediate repeated action', () => {
    const limiter = createRateLimiter({ compare: 3000 });
    limiter.canPerform('compare');  // First call — allowed
    expect(limiter.canPerform('compare')).toBe(false);  // Second call — blocked
  });

  it('allows action after cooldown period', () => {
    const limiter = createRateLimiter({ compare: 3000 });
    limiter.canPerform('compare');  // First call at t=0

    /* Advance time by 3 seconds */
    vi.advanceTimersByTime(3000);

    expect(limiter.canPerform('compare')).toBe(true);  // Should be allowed now
  });

  it('blocks action when not enough time has passed', () => {
    const limiter = createRateLimiter({ compare: 3000 });
    limiter.canPerform('compare');

    /* Only advance 2 seconds (less than 3s cooldown) */
    vi.advanceTimersByTime(2000);

    expect(limiter.canPerform('compare')).toBe(false);
  });

  it('tracks different action types independently', () => {
    const limiter = createRateLimiter({ compare: 3000, copy: 2000 });

    limiter.canPerform('compare');  // compare at t=0

    /* Copy should still be allowed even though compare just fired */
    expect(limiter.canPerform('copy')).toBe(true);

    /* Both should be blocked now */
    expect(limiter.canPerform('compare')).toBe(false);
    expect(limiter.canPerform('copy')).toBe(false);
  });

  it('handles "once" type — allows only first time', () => {
    const limiter = createRateLimiter({ page_load: 'once' });

    expect(limiter.canPerform('page_load')).toBe(true);   // First time — allowed
    expect(limiter.canPerform('page_load')).toBe(false);  // Second time — blocked

    /* Even after a long time, still blocked */
    vi.advanceTimersByTime(999999);
    expect(limiter.canPerform('page_load')).toBe(false);
  });

  it('allows unknown action types (no limit configured)', () => {
    const limiter = createRateLimiter({ compare: 3000 });

    /* 'unknown_action' has no limit → should always be allowed */
    expect(limiter.canPerform('unknown_action')).toBe(true);
    expect(limiter.canPerform('unknown_action')).toBe(true);
  });

  it('reset clears all state', () => {
    const limiter = createRateLimiter({ compare: 3000, page_load: 'once' });

    limiter.canPerform('compare');
    limiter.canPerform('page_load');

    /* Both should be blocked */
    expect(limiter.canPerform('compare')).toBe(false);
    expect(limiter.canPerform('page_load')).toBe(false);

    /* Reset and try again */
    limiter.reset();
    expect(limiter.canPerform('compare')).toBe(true);
    expect(limiter.canPerform('page_load')).toBe(true);
  });
});
