/**
 * analytics.test.js — Tests for Audit Log Data Building
 * ========================================================
 * These tests verify that audit log entries are correctly structured
 * and that data truncation/sanitization works properly.
 *
 * NOTE: We do NOT test actual Firestore writes here — that would require
 * a Firebase emulator. Instead, we test the `buildLogEntry()` function
 * which prepares the data before it's sent to Firestore.
 */

import { describe, it, expect } from 'vitest';
import { buildLogEntry } from '../js/analytics.js';

// ============================================================================
// buildLogEntry — Constructing the audit log document
// ============================================================================

describe('buildLogEntry', () => {
  /* Standard test parameters */
  const baseParams = {
    action: 'compare',
    listA: ['apple', 'banana', 'cherry'],
    listB: ['banana', 'date'],
    options: {
      caseSensitive: true,
      ignoreBeginEndSpaces: true,
    },
    resultCounts: { aOnly: 2, bOnly: 1, intersection: 1, union: 4 },
    analyticsConfig: {
      maxItemsPerList: 100,
      maxItemLength: 200,
    },
  };

  it('produces an entry with the correct shape', () => {
    const entry = buildLogEntry(baseParams);

    expect(entry).toHaveProperty('action', 'compare');
    expect(entry).toHaveProperty('inputSizeA', 3);
    expect(entry).toHaveProperty('inputSizeB', 2);
    expect(entry).toHaveProperty('options');
    expect(entry).toHaveProperty('resultCounts');
    expect(entry).toHaveProperty('inputSampleA');
    expect(entry).toHaveProperty('inputSampleB');
    expect(entry).toHaveProperty('dataTruncated');
    expect(entry).toHaveProperty('timestamp');
  });

  it('includes correct input sizes', () => {
    const entry = buildLogEntry(baseParams);
    expect(entry.inputSizeA).toBe(3);
    expect(entry.inputSizeB).toBe(2);
  });

  it('includes the comparison options used', () => {
    const entry = buildLogEntry(baseParams);
    expect(entry.options.caseSensitive).toBe(true);
    expect(entry.options.ignoreBeginEndSpaces).toBe(true);
  });

  it('includes result counts', () => {
    const entry = buildLogEntry(baseParams);
    expect(entry.resultCounts).toEqual({ aOnly: 2, bOnly: 1, intersection: 1, union: 4 });
  });

  it('stores input samples when under limit', () => {
    const entry = buildLogEntry(baseParams);
    expect(entry.inputSampleA).toEqual(['apple', 'banana', 'cherry']);
    expect(entry.inputSampleB).toEqual(['banana', 'date']);
    expect(entry.dataTruncated).toBe(false);
  });

  it('truncates large lists and sets dataTruncated flag', () => {
    const largeList = Array.from({ length: 200 }, (_, i) => `item_${i}`);
    const entry = buildLogEntry({
      ...baseParams,
      listA: largeList,
      analyticsConfig: { maxItemsPerList: 50, maxItemLength: 200 },
    });

    expect(entry.inputSampleA.length).toBe(50);
    expect(entry.dataTruncated).toBe(true);
    expect(entry.truncationDetails.listATruncated).toBe(true);
    expect(entry.truncationDetails.originalSizeA).toBe(200);
  });

  it('truncates long individual items', () => {
    const longItems = ['a'.repeat(300), 'short'];
    const entry = buildLogEntry({
      ...baseParams,
      listA: longItems,
      analyticsConfig: { maxItemsPerList: 100, maxItemLength: 50 },
    });

    expect(entry.inputSampleA[0].length).toBe(50);
    expect(entry.inputSampleA[0].endsWith('…')).toBe(true);
    expect(entry.inputSampleA[1]).toBe('short');
    expect(entry.dataTruncated).toBe(true);
  });

  it('handles empty lists', () => {
    const entry = buildLogEntry({
      ...baseParams,
      listA: [],
      listB: [],
    });

    expect(entry.inputSizeA).toBe(0);
    expect(entry.inputSizeB).toBe(0);
    expect(entry.inputSampleA).toEqual([]);
    expect(entry.inputSampleB).toEqual([]);
    expect(entry.dataTruncated).toBe(false);
  });

  it('does not include truncationDetails when dataTruncated is false', () => {
    const entry = buildLogEntry(baseParams);
    expect(entry.dataTruncated).toBe(false);
    expect(entry.truncationDetails).toBeUndefined();
  });

  it('uses provided action type', () => {
    const entry = buildLogEntry({ ...baseParams, action: 'copy' });
    expect(entry.action).toBe('copy');
  });

  it('creates a timestamp', () => {
    const entry = buildLogEntry(baseParams);
    expect(entry.timestamp).toBeDefined();
    /* Timestamp should be a recent ISO string */
    const timeDiff = Date.now() - new Date(entry.timestamp).getTime();
    expect(timeDiff).toBeLessThan(5000); // Within 5 seconds
  });
});
