/**
 * comparator.test.js — Tests for the List Comparison Engine
 * ===========================================================
 * These tests verify that the core comparison logic produces correct results
 * for every combination of options. Since comparator.js is pure functions
 * with no DOM dependency, these tests run blazingly fast in Node.js.
 *
 * TEST STRUCTURE:
 * - Each `describe` block groups tests for a specific feature
 * - Each `it` block tests one specific behavior
 * - We use `expect(...).toEqual(...)` for deep equality checks on arrays
 */

import { describe, it, expect } from 'vitest';
import { compareLists, parseInput, normalizeItem, applyTransforms } from '../js/comparator.js';

// ============================================================================
// parseInput — Converting raw text to arrays
// ============================================================================

describe('parseInput', () => {
  it('splits text by newlines into an array', () => {
    expect(parseInput('apple\nbanana\ncherry')).toEqual(['apple', 'banana', 'cherry']);
  });

  it('handles Windows-style line endings (\\r\\n)', () => {
    expect(parseInput('apple\r\nbanana\r\ncherry')).toEqual(['apple', 'banana', 'cherry']);
  });

  it('handles Mac Classic line endings (\\r)', () => {
    expect(parseInput('apple\rbanana\rcherry')).toEqual(['apple', 'banana', 'cherry']);
  });

  it('filters out completely empty lines', () => {
    expect(parseInput('apple\n\nbanana\n\n\ncherry')).toEqual(['apple', 'banana', 'cherry']);
  });

  it('keeps lines that are only whitespace (trimming is a separate concern)', () => {
    expect(parseInput('apple\n   \ncherry')).toEqual(['apple', '   ', 'cherry']);
  });

  it('returns empty array for null/undefined/empty input', () => {
    expect(parseInput(null)).toEqual([]);
    expect(parseInput(undefined)).toEqual([]);
    expect(parseInput('')).toEqual([]);
  });

  it('returns empty array for non-string input', () => {
    expect(parseInput(42)).toEqual([]);
    expect(parseInput({})).toEqual([]);
  });

  it('handles single item with no newline', () => {
    expect(parseInput('apple')).toEqual(['apple']);
  });
});

// ============================================================================
// normalizeItem — Preparing items for comparison
// ============================================================================

describe('normalizeItem', () => {
  it('trims begin/end spaces when enabled', () => {
    expect(normalizeItem('  apple  ', { ignoreBeginEndSpaces: true })).toBe('apple');
  });

  it('does not trim when disabled', () => {
    expect(normalizeItem('  apple  ', { ignoreBeginEndSpaces: false })).toBe('  apple  ');
  });

  it('collapses extra spaces when enabled', () => {
    expect(normalizeItem('hello   world', { ignoreExtraSpaces: true })).toBe('hello world');
  });

  it('collapses tabs and mixed whitespace', () => {
    expect(normalizeItem('hello\t\t world', { ignoreExtraSpaces: true })).toBe('hello world');
  });

  it('lowercases when case insensitive', () => {
    expect(normalizeItem('Apple', { caseSensitive: false })).toBe('apple');
  });

  it('preserves case when case sensitive', () => {
    expect(normalizeItem('Apple', { caseSensitive: true })).toBe('Apple');
  });

  it('removes leading zeroes when enabled', () => {
    expect(normalizeItem('007', { ignoreLeadingZeroes: true })).toBe('7');
    expect(normalizeItem('0042', { ignoreLeadingZeroes: true })).toBe('42');
  });

  it('preserves standalone zero', () => {
    /* "0" should stay "0", not become empty */
    expect(normalizeItem('0', { ignoreLeadingZeroes: true })).toBe('0');
  });

  it('preserves "00" as "0" since removing leading zeroes from "00" is ambiguous', () => {
    /* "00" → the regex matches 0+(\d+), "00" has 0+ followed by "0", so it becomes "0" */
    expect(normalizeItem('00', { ignoreLeadingZeroes: true })).toBe('0');
  });

  it('does not affect non-numeric strings with ignoreLeadingZeroes', () => {
    expect(normalizeItem('abc', { ignoreLeadingZeroes: true })).toBe('abc');
    expect(normalizeItem('0abc', { ignoreLeadingZeroes: true })).toBe('0abc');
  });

  it('applies multiple normalizations together', () => {
    const result = normalizeItem('  Hello   World  ', {
      ignoreBeginEndSpaces: true,
      ignoreExtraSpaces: true,
      caseSensitive: false,
    });
    expect(result).toBe('hello world');
  });

  it('returns original when no options are set', () => {
    expect(normalizeItem('  Hello  ', {})).toBe('  Hello  ');
  });
});

// ============================================================================
// compareLists — The main comparison function
// ============================================================================

describe('compareLists', () => {
  /* Default options for most tests */
  const defaultOptions = {
    caseSensitive: true,
    ignoreBeginEndSpaces: true,
    ignoreExtraSpaces: true,
    ignoreLeadingZeroes: false,
    lineNumbered: false,
    sortOption: 'none',
    caseTransform: 'none',
  };

  it('correctly identifies items unique to A', () => {
    const result = compareLists('apple\nbanana\ncherry', 'banana\ndate', defaultOptions);
    expect(result.aOnly).toEqual(['apple', 'cherry']);
  });

  it('correctly identifies items unique to B', () => {
    const result = compareLists('apple\nbanana', 'banana\ndate\nfig', defaultOptions);
    expect(result.bOnly).toEqual(['date', 'fig']);
  });

  it('correctly computes intersection', () => {
    const result = compareLists('apple\nbanana\ncherry', 'banana\ncherry\ndate', defaultOptions);
    expect(result.intersection).toEqual(['banana', 'cherry']);
  });

  it('correctly computes union', () => {
    const result = compareLists('apple\nbanana', 'banana\ncherry', defaultOptions);
    expect(result.union).toEqual(['apple', 'banana', 'cherry']);
  });

  it('handles identical lists — empty A-only and B-only', () => {
    const result = compareLists('apple\nbanana', 'apple\nbanana', defaultOptions);
    expect(result.aOnly).toEqual([]);
    expect(result.bOnly).toEqual([]);
    expect(result.intersection).toEqual(['apple', 'banana']);
  });

  it('handles completely different lists — empty intersection', () => {
    const result = compareLists('apple\nbanana', 'cherry\ndate', defaultOptions);
    expect(result.intersection).toEqual([]);
    expect(result.aOnly).toEqual(['apple', 'banana']);
    expect(result.bOnly).toEqual(['cherry', 'date']);
  });

  it('handles empty List A', () => {
    const result = compareLists('', 'apple\nbanana', defaultOptions);
    expect(result.aOnly).toEqual([]);
    expect(result.bOnly).toEqual(['apple', 'banana']);
    expect(result.intersection).toEqual([]);
    expect(result.union).toEqual(['apple', 'banana']);
  });

  it('handles empty List B', () => {
    const result = compareLists('apple\nbanana', '', defaultOptions);
    expect(result.aOnly).toEqual(['apple', 'banana']);
    expect(result.bOnly).toEqual([]);
    expect(result.intersection).toEqual([]);
    expect(result.union).toEqual(['apple', 'banana']);
  });

  it('handles both lists empty', () => {
    const result = compareLists('', '', defaultOptions);
    expect(result.aOnly).toEqual([]);
    expect(result.bOnly).toEqual([]);
    expect(result.intersection).toEqual([]);
    expect(result.union).toEqual([]);
  });

  it('handles duplicates within a list — deduplicates in results', () => {
    const result = compareLists('apple\napple\nbanana', 'banana\ncherry', defaultOptions);
    /* 'apple' appears twice in A but should appear once in aOnly */
    expect(result.union).toEqual(['apple', 'banana', 'cherry']);
  });

  it('case sensitive comparison — Apple ≠ apple', () => {
    const result = compareLists('Apple', 'apple', { ...defaultOptions, caseSensitive: true });
    expect(result.aOnly).toEqual(['Apple']);
    expect(result.bOnly).toEqual(['apple']);
    expect(result.intersection).toEqual([]);
  });

  it('case insensitive comparison — Apple = apple', () => {
    const result = compareLists('Apple', 'apple', { ...defaultOptions, caseSensitive: false });
    expect(result.aOnly).toEqual([]);
    expect(result.bOnly).toEqual([]);
    expect(result.intersection).toEqual(['Apple']); // Preserves A's display form
  });

  it('ignores leading/trailing spaces', () => {
    const result = compareLists('  apple  ', 'apple', {
      ...defaultOptions,
      ignoreBeginEndSpaces: true,
    });
    expect(result.intersection).toEqual(['  apple  ']); // Display form preserved
    expect(result.aOnly).toEqual([]);
  });

  it('ignores extra internal spaces', () => {
    const result = compareLists('hello   world', 'hello world', {
      ...defaultOptions,
      ignoreExtraSpaces: true,
    });
    expect(result.intersection).toEqual(['hello   world']);
    expect(result.aOnly).toEqual([]);
  });

  it('ignores leading zeroes', () => {
    const result = compareLists('007\n042', '7\n42', {
      ...defaultOptions,
      ignoreLeadingZeroes: true,
    });
    expect(result.intersection).toEqual(['007', '042']);
    expect(result.aOnly).toEqual([]);
    expect(result.bOnly).toEqual([]);
  });

  it('single item lists', () => {
    const result = compareLists('hello', 'world', defaultOptions);
    expect(result.aOnly).toEqual(['hello']);
    expect(result.bOnly).toEqual(['world']);
    expect(result.intersection).toEqual([]);
    expect(result.union).toEqual(['hello', 'world']);
  });

  it('handles special characters and unicode', () => {
    const result = compareLists('café\n日本語\n🎉', 'café\nहिन्दी\n🎉', defaultOptions);
    expect(result.intersection).toEqual(['café', '🎉']);
    expect(result.aOnly).toEqual(['日本語']);
    expect(result.bOnly).toEqual(['हिन्दी']);
  });

  it('handles items with tabs', () => {
    const result = compareLists('hello\tworld', 'hello\tworld', defaultOptions);
    expect(result.intersection).toEqual(['hello\tworld']);
  });

  it('handles large lists efficiently', () => {
    /* Generate two lists of 1000 items each with 500 overlapping */
    const listA = Array.from({ length: 1000 }, (_, i) => `item_${i}`);
    const listB = Array.from({ length: 1000 }, (_, i) => `item_${i + 500}`);

    const start = performance.now();
    const result = compareLists(listA.join('\n'), listB.join('\n'), defaultOptions);
    const elapsed = performance.now() - start;

    expect(result.aOnly.length).toBe(500);       // items 0–499
    expect(result.bOnly.length).toBe(500);        // items 1000–1499
    expect(result.intersection.length).toBe(500); // items 500–999
    expect(result.union.length).toBe(1500);       // all unique items

    /* Should complete in well under 1 second */
    expect(elapsed).toBeLessThan(1000);
  });
});

// ============================================================================
// applyTransforms — Post-processing results
// ============================================================================

describe('applyTransforms', () => {
  it('sorts ascending', () => {
    const result = applyTransforms(['cherry', 'apple', 'banana'], { sortOption: 'asc' });
    expect(result).toEqual(['apple', 'banana', 'cherry']);
  });

  it('sorts descending', () => {
    const result = applyTransforms(['cherry', 'apple', 'banana'], { sortOption: 'desc' });
    expect(result).toEqual(['cherry', 'banana', 'apple']);
  });

  it('transforms to lowercase', () => {
    const result = applyTransforms(['HELLO', 'World'], { caseTransform: 'lower' });
    expect(result).toEqual(['hello', 'world']);
  });

  it('transforms to uppercase', () => {
    const result = applyTransforms(['hello', 'World'], { caseTransform: 'upper' });
    expect(result).toEqual(['HELLO', 'WORLD']);
  });

  it('transforms to title case', () => {
    const result = applyTransforms(['hello world', 'foo bar'], { caseTransform: 'title' });
    expect(result).toEqual(['Hello World', 'Foo Bar']);
  });

  it('adds line numbers', () => {
    const result = applyTransforms(['apple', 'banana'], { lineNumbered: true });
    expect(result).toEqual(['1. apple', '2. banana']);
  });

  it('applies case transform before sorting', () => {
    const result = applyTransforms(['banana', 'Apple'], {
      caseTransform: 'lower',
      sortOption: 'asc',
    });
    expect(result).toEqual(['apple', 'banana']);
  });

  it('returns copy when no transforms specified', () => {
    const items = ['a', 'b'];
    const result = applyTransforms(items, {});
    expect(result).toEqual(['a', 'b']);
    /* Verify it's a new array, not the same reference */
    expect(result).not.toBe(items);
  });
});
