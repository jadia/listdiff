/**
 * utils.test.js — Tests for Utility Functions
 * ==============================================
 * Tests for the shared utility functions in utils.js.
 * These cover list manipulation, CSV parsing, data sanitization,
 * and HTML escaping.
 */

import { describe, it, expect } from 'vitest';
import {
  trimItems,
  deduplicateItems,
  sortItems,
  reverseItems,
  splitCSVRow,
  splitByDelimiter,
  countDuplicates,
  sanitizeForStorage,
  getClientInfo,
  debounce,
  escapeHtml,
  toTitleCase,
  generateId,
} from '../js/utils.js';

// ============================================================================
// trimItems
// ============================================================================

describe('trimItems', () => {
  it('trims whitespace from each item', () => {
    expect(trimItems(['  hello  ', 'world  '])).toEqual(['hello', 'world']);
  });

  it('removes empty strings after trimming', () => {
    expect(trimItems(['hello', '', '  ', 'world'])).toEqual(['hello', 'world']);
  });

  it('returns empty array for all-empty input', () => {
    expect(trimItems(['', '  ', '   '])).toEqual([]);
  });

  it('handles empty array', () => {
    expect(trimItems([])).toEqual([]);
  });
});

// ============================================================================
// deduplicateItems
// ============================================================================

describe('deduplicateItems', () => {
  it('removes duplicates keeping first occurrence', () => {
    expect(deduplicateItems(['a', 'b', 'a', 'c', 'b'])).toEqual(['a', 'b', 'c']);
  });

  it('returns same array when no duplicates', () => {
    expect(deduplicateItems(['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
  });

  it('handles empty array', () => {
    expect(deduplicateItems([])).toEqual([]);
  });

  it('handles single item', () => {
    expect(deduplicateItems(['a'])).toEqual(['a']);
  });
});

// ============================================================================
// sortItems
// ============================================================================

describe('sortItems', () => {
  it('sorts ascending by default', () => {
    expect(sortItems(['cherry', 'apple', 'banana'])).toEqual(['apple', 'banana', 'cherry']);
  });

  it('sorts descending', () => {
    expect(sortItems(['cherry', 'apple', 'banana'], 'desc')).toEqual(['cherry', 'banana', 'apple']);
  });

  it('does not mutate the original array', () => {
    const original = ['c', 'a', 'b'];
    sortItems(original);
    expect(original).toEqual(['c', 'a', 'b']);
  });

  it('handles empty array', () => {
    expect(sortItems([])).toEqual([]);
  });
});

// ============================================================================
// reverseItems
// ============================================================================

describe('reverseItems', () => {
  it('reverses the array', () => {
    expect(reverseItems(['a', 'b', 'c'])).toEqual(['c', 'b', 'a']);
  });

  it('does not mutate the original array', () => {
    const original = ['a', 'b', 'c'];
    reverseItems(original);
    expect(original).toEqual(['a', 'b', 'c']);
  });
});

// ============================================================================
// splitCSVRow — Quote-aware CSV parsing
// ============================================================================

describe('splitCSVRow', () => {
  it('splits by comma', () => {
    expect(splitCSVRow('a,b,c', /,/)).toEqual(['a', 'b', 'c']);
  });

  it('respects double-quoted sections', () => {
    expect(splitCSVRow('"hello,world",foo,bar', /,/)).toEqual(['"hello,world"', 'foo', 'bar']);
  });

  it('respects single-quoted sections', () => {
    expect(splitCSVRow("'hello,world',foo", /,/)).toEqual(["'hello,world'", 'foo']);
  });

  it('handles escaped characters inside quotes', () => {
    /* When a backslash appears inside quotes followed by a quote char,
     * the escaped quote is treated as a literal character */
    expect(splitCSVRow('"hello\\"world",foo', /,/)).toEqual(['"hello\\"world"', 'foo']);
  });

  it('splits by multiple delimiter types', () => {
    expect(splitCSVRow('a,b;c\td', /[,;\t]/)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('handles empty fields', () => {
    expect(splitCSVRow('a,,c', /,/)).toEqual(['a', '', 'c']);
  });

  it('handles single field with no delimiter', () => {
    expect(splitCSVRow('hello', /,/)).toEqual(['hello']);
  });
});

// ============================================================================
// splitByDelimiter — Full text splitting
// ============================================================================

describe('splitByDelimiter', () => {
  it('splits multi-line text with auto delimiter', () => {
    const result = splitByDelimiter('a,b\nc,d');
    expect(result).toEqual(['a', 'b', 'c', 'd']);
  });

  it('splits by comma delimiter', () => {
    const result = splitByDelimiter('apple,banana,cherry', 'comma');
    expect(result).toEqual(['apple', 'banana', 'cherry']);
  });

  it('splits by pipe delimiter', () => {
    const result = splitByDelimiter('apple|banana|cherry', 'pipe');
    expect(result).toEqual(['apple', 'banana', 'cherry']);
  });

  it('splits by tab delimiter', () => {
    const result = splitByDelimiter('apple\tbanana\tcherry', 'tab');
    expect(result).toEqual(['apple', 'banana', 'cherry']);
  });

  it('deduplicates results', () => {
    const result = splitByDelimiter('a,b\na,c');
    expect(result).toEqual(['a', 'b', 'c']);
  });

  it('skips empty lines', () => {
    const result = splitByDelimiter('a,b\n\nc,d');
    expect(result).toEqual(['a', 'b', 'c', 'd']);
  });

  it('trims whitespace from results', () => {
    const result = splitByDelimiter(' a , b , c ');
    expect(result).toEqual(['a', 'b', 'c']);
  });
});

// ============================================================================
// countDuplicates
// ============================================================================

describe('countDuplicates', () => {
  it('counts items that appear more than once', () => {
    expect(countDuplicates(['a', 'b', 'a', 'c', 'b', 'b'])).toBe(2); // 'a' and 'b'
  });

  it('returns 0 when no duplicates', () => {
    expect(countDuplicates(['a', 'b', 'c'])).toBe(0);
  });

  it('handles empty array', () => {
    expect(countDuplicates([])).toBe(0);
  });

  it('handles all identical items', () => {
    expect(countDuplicates(['a', 'a', 'a'])).toBe(1);
  });
});

// ============================================================================
// sanitizeForStorage — Data truncation for Firestore
// ============================================================================

describe('sanitizeForStorage', () => {
  it('returns unchanged data when under limits', () => {
    const items = ['apple', 'banana', 'cherry'];
    const result = sanitizeForStorage(items, { maxItems: 100, maxItemLength: 200 });
    expect(result.data).toEqual(['apple', 'banana', 'cherry']);
    expect(result.truncated).toBe(false);
  });

  it('truncates list when over item count limit', () => {
    const items = Array.from({ length: 150 }, (_, i) => `item_${i}`);
    const result = sanitizeForStorage(items, { maxItems: 100, maxItemLength: 200 });
    expect(result.data.length).toBe(100);
    expect(result.truncated).toBe(true);
    expect(result.details.listTruncated).toBe(true);
    expect(result.details.originalSize).toBe(150);
    expect(result.details.storedSize).toBe(100);
  });

  it('truncates individual items that exceed max length', () => {
    const longItem = 'a'.repeat(300);
    const result = sanitizeForStorage([longItem], { maxItems: 100, maxItemLength: 200 });
    expect(result.data[0].length).toBe(200);
    expect(result.data[0].endsWith('…')).toBe(true);
    expect(result.truncated).toBe(true);
    expect(result.details.itemsLengthCapped).toBe(1);
  });

  it('has correct truncation details when both types of truncation occur', () => {
    const items = Array.from({ length: 150 }, (_, i) => 'x'.repeat(250) + `_${i}`);
    const result = sanitizeForStorage(items, { maxItems: 100, maxItemLength: 200 });
    expect(result.truncated).toBe(true);
    expect(result.details.listTruncated).toBe(true);
    expect(result.details.itemsLengthCapped).toBe(100);
    expect(result.details.originalSize).toBe(150);
    expect(result.details.storedSize).toBe(100);
  });

  it('uses default limits when none provided', () => {
    const items = Array.from({ length: 50 }, (_, i) => `item_${i}`);
    const result = sanitizeForStorage(items);
    expect(result.data.length).toBe(50);
    expect(result.truncated).toBe(false);
  });

  it('handles empty array', () => {
    const result = sanitizeForStorage([], { maxItems: 100, maxItemLength: 200 });
    expect(result.data).toEqual([]);
    expect(result.truncated).toBe(false);
    expect(result.details.originalSize).toBe(0);
  });

  it('reports truncated=false when exactly at the limit', () => {
    const items = Array.from({ length: 100 }, (_, i) => `item_${i}`);
    const result = sanitizeForStorage(items, { maxItems: 100, maxItemLength: 200 });
    expect(result.truncated).toBe(false);
    expect(result.data.length).toBe(100);
  });
});

// ============================================================================
// escapeHtml — XSS prevention
// ============================================================================

describe('escapeHtml', () => {
  it('escapes < and >', () => {
    expect(escapeHtml('<script>')).toBe('&lt;script&gt;');
  });

  it('escapes ampersands', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapes quotes', () => {
    expect(escapeHtml('"hello"')).toBe('&quot;hello&quot;');
    expect(escapeHtml("'hello'")).toBe('&#039;hello&#039;');
  });

  it('handles strings with no special characters', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });

  it('does not double-escape', () => {
    /* First escape converts & to &amp; */
    const once = escapeHtml('a & b');
    expect(once).toBe('a &amp; b');
    /* Second escape should convert &amp; to &amp;amp; (double encoding) */
    const twice = escapeHtml(once);
    expect(twice).toBe('a &amp;amp; b');
  });
});

// ============================================================================
// toTitleCase
// ============================================================================

describe('toTitleCase', () => {
  it('capitalizes first letter of each word', () => {
    expect(toTitleCase('hello world')).toBe('Hello World');
  });

  it('handles already uppercase text', () => {
    expect(toTitleCase('HELLO WORLD')).toBe('Hello World');
  });

  it('handles single word', () => {
    expect(toTitleCase('hello')).toBe('Hello');
  });

  it('handles empty string', () => {
    expect(toTitleCase('')).toBe('');
  });
});

// ============================================================================
// debounce
// ============================================================================

describe('debounce', () => {
  it('delays function execution', async () => {
    let callCount = 0;
    const debounced = debounce(() => { callCount++; }, 50);

    debounced();
    debounced();
    debounced();

    /* Nothing should have fired yet */
    expect(callCount).toBe(0);

    /* Wait for the debounce to fire */
    await new Promise(resolve => setTimeout(resolve, 100));

    /* Should have fired exactly once */
    expect(callCount).toBe(1);
  });
});

// ============================================================================
// generateId
// ============================================================================

describe('generateId', () => {
  it('generates a string of default length if not provided', () => {
    const id = generateId();
    expect(id).toHaveLength(8);
  });

  it('generates a string of the specified length', () => {
    const id = generateId(12);
    expect(id).toHaveLength(12);
  });

  it('generates unique random strings', () => {
    const id1 = generateId(8);
    const id2 = generateId(8);
    expect(id1).not.toBe(id2);
  });
});
