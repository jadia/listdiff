/**
 * comparator.js — Core List Comparison Engine
 * =============================================
 * This is the brain of ListDiff. It contains the pure logic for comparing
 * two lists and computing their differences and commonalities.
 *
 * DESIGN PRINCIPLES:
 * 1. PURE FUNCTIONS — No DOM, no side effects, no global state.
 *    Every function takes inputs and returns outputs. Period.
 *    This makes the code dead-simple to test.
 *
 * 2. NORMALIZATION vs. DISPLAY — We separate "how we compare" from
 *    "how we show results." Items are normalized for comparison (e.g.,
 *    lowercased, trimmed) but the original form is displayed in results.
 *
 * 3. SET OPERATIONS — The core algorithm uses mathematical set operations:
 *    - A \ B  (A only)     = items in A but not in B
 *    - B \ A  (B only)     = items in B but not in A
 *    - A ∩ B (intersection) = items in both A and B
 *    - A ∪ B (union)        = all unique items from both lists
 *
 * PERFORMANCE:
 * Using a Map for lookups gives us O(n) comparison instead of O(n²).
 * A list of 10,000 items compares in milliseconds.
 */

import { toTitleCase } from './utils.js';

// ============================================================================
// MAIN COMPARISON FUNCTION
// ============================================================================

/**
 * Compares two lists and returns their differences and commonalities.
 *
 * This is the main entry point — call this from the UI when the user
 * clicks "Compare Lists."
 *
 * ALGORITHM:
 * 1. Parse both inputs from raw text into arrays of lines
 * 2. Normalize each item according to the options (case, spaces, zeroes)
 * 3. Build a lookup Map from List B: normalized → original display form
 * 4. Walk through List A:
 *    - If normalized form exists in B's map → it's in the intersection
 *    - If not → it's A-only
 * 5. Walk through List B:
 *    - If normalized form was NOT seen in A → it's B-only
 * 6. Union = deduplicated combination of both lists
 * 7. Apply any post-processing (sorting, case transforms, line numbers)
 *
 * @param {string} textA - Raw text from List A textarea
 * @param {string} textB - Raw text from List B textarea
 * @param {object} options - Comparison options (see below)
 * @returns {object} { aOnly, bOnly, intersection, union } — each is a string[]
 *
 * OPTIONS:
 * {
 *   caseSensitive: boolean,        // true = "Apple" ≠ "apple"
 *   ignoreBeginEndSpaces: boolean, // true = "  apple  " → "apple"
 *   ignoreExtraSpaces: boolean,    // true = "hello   world" → "hello world"
 *   ignoreLeadingZeroes: boolean,  // true = "001" → "1"
 *   lineNumbered: boolean,         // true = prefix output with "1. ", "2. ", etc.
 *   sortOption: 'none'|'asc'|'desc',
 *   caseTransform: 'none'|'lower'|'upper'|'title'
 * }
 */
export function compareLists(textA, textB, options = {}) {
  /* Step 1: Parse raw text into arrays */
  const listA = parseInput(textA);
  const listB = parseInput(textB);

  /* Step 2: Build a Map of normalized B items for O(1) lookup.
   *
   * WHY A MAP AND NOT A SET?
   * We need to map normalized_form → original_display_form.
   * When we find a match, we want to show the original text
   * (with original casing/spacing), not the normalized version.
   *
   * For duplicates within B, we keep the first occurrence's display form.
   */
  const normalizedBMap = new Map();
  for (const item of listB) {
    const normalized = normalizeItem(item, options);
    if (!normalizedBMap.has(normalized)) {
      normalizedBMap.set(normalized, item);
    }
  }

  /* Also build a Set of normalized A items (for B-only detection) */
  const normalizedASet = new Set();
  for (const item of listA) {
    normalizedASet.add(normalizeItem(item, options));
  }

  /* Step 3: Walk through A and classify each item */
  const aOnly = [];
  const intersection = [];
  const seenIntersection = new Set(); // Avoid duplicate intersection entries

  for (const item of listA) {
    const normalized = normalizeItem(item, options);

    if (normalizedBMap.has(normalized)) {
      /* Item exists in both A and B → intersection */
      if (!seenIntersection.has(normalized)) {
        intersection.push(item);
        seenIntersection.add(normalized);
      }
    } else {
      /* Item exists only in A */
      aOnly.push(item);
    }
  }

  /* Step 4: Walk through B and find B-only items */
  const bOnly = [];
  const seenBOnly = new Set();

  for (const item of listB) {
    const normalized = normalizeItem(item, options);

    if (!normalizedASet.has(normalized) && !seenBOnly.has(normalized)) {
      bOnly.push(item);
      seenBOnly.add(normalized);
    }
  }

  /* Step 5: Union = all unique items from both lists (by normalized form) */
  const union = [];
  const seenUnion = new Set();

  /* Add all of A first (preserving A's order) */
  for (const item of listA) {
    const normalized = normalizeItem(item, options);
    if (!seenUnion.has(normalized)) {
      union.push(item);
      seenUnion.add(normalized);
    }
  }

  /* Then add items from B that weren't already covered */
  for (const item of listB) {
    const normalized = normalizeItem(item, options);
    if (!seenUnion.has(normalized)) {
      union.push(item);
      seenUnion.add(normalized);
    }
  }

  /* Step 6: Apply post-processing transforms */
  return {
    aOnly: applyTransforms(aOnly, options),
    bOnly: applyTransforms(bOnly, options),
    intersection: applyTransforms(intersection, options),
    union: applyTransforms(union, options),
  };
}

// ============================================================================
// PARSING
// ============================================================================

/**
 * Parses raw textarea text into an array of non-empty lines.
 *
 * HANDLES:
 * - Windows line endings (\r\n)
 * - Mac Classic line endings (\r)
 * - Unix line endings (\n)
 * - Filters out completely empty lines
 *
 * @param {string} text - Raw text from textarea
 * @returns {string[]} Array of non-empty lines
 */
export function parseInput(text) {
  if (!text || typeof text !== 'string') return [];

  return text
    .split(/\r\n|\r|\n/)          // Split by any line ending style
    .filter(line => line !== '');  // Remove completely empty lines (keep whitespace-only)
}

// ============================================================================
// NORMALIZATION
// ============================================================================

/**
 * Normalizes an item for comparison purposes.
 *
 * IMPORTANT: This does NOT change the display form — it creates a
 * "comparison key" used to determine if two items match.
 *
 * NORMALIZATION STEPS (applied based on options):
 * 1. ignoreBeginEndSpaces → trim()
 * 2. ignoreExtraSpaces → collapse multiple spaces to one
 * 3. caseSensitive=false → toLowerCase()
 * 4. ignoreLeadingZeroes → remove leading zeros from numbers
 *
 * @param {string} item - Original item text
 * @param {object} options - Comparison options
 * @returns {string} Normalized string used as comparison key
 */
export function normalizeItem(item, options = {}) {
  let normalized = item;

  /* Remove leading and trailing whitespace */
  if (options.ignoreBeginEndSpaces) {
    normalized = normalized.trim();
  }

  /* Collapse multiple spaces/tabs into a single space */
  if (options.ignoreExtraSpaces) {
    normalized = normalized.replace(/\s+/g, ' ');
  }

  /*
   * Convert to lowercase for case-insensitive comparison.
   * DEFAULT: caseSensitive is true (preserve case) when not explicitly set.
   * We check for `=== false` instead of `!options.caseSensitive` because
   * `undefined` (option not set) should NOT trigger lowercasing.
   */
  if (options.caseSensitive === false) {
    normalized = normalized.toLowerCase();
  }

  /*
   * Remove leading zeros from numeric strings.
   *
   * REGEX EXPLANATION: /^0+(\d+)$/
   * - ^0+     → starts with one or more zeros
   * - (\d+)$  → followed by one or more digits (captured in group 1)
   *
   * Special case: "0" or "00" should remain "0", not empty.
   * That's why we match 0+(\d+) — there must be digits AFTER the leading zeros.
   *
   * Examples: "007" → "7", "0042" → "42", "0" → "0", "abc" → "abc"
   */
  if (options.ignoreLeadingZeroes) {
    normalized = normalized.replace(/^0+(\d+)$/, '$1');
  }

  return normalized;
}

// ============================================================================
// POST-PROCESSING TRANSFORMS
// ============================================================================

/**
 * Applies sorting and case transformation to results.
 *
 * These transforms change the DISPLAY form of the results —
 * they don't affect the comparison logic.
 *
 * @param {string[]} items - Result items to transform
 * @param {object} options - { sortOption, caseTransform, lineNumbered }
 * @returns {string[]} Transformed items
 */
export function applyTransforms(items, options = {}) {
  let result = [...items];

  /* Apply case transformation first (before sorting, so sort sees final form) */
  if (options.caseTransform && options.caseTransform !== 'none') {
    result = result.map(item => {
      switch (options.caseTransform) {
        case 'lower': return item.toLowerCase();
        case 'upper': return item.toUpperCase();
        case 'title': return toTitleCase(item);
        default: return item;
      }
    });
  }

  /* Apply sorting */
  if (options.sortOption && options.sortOption !== 'none') {
    result.sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: 'base' })
    );
    if (options.sortOption === 'desc') {
      result.reverse();
    }
  }

  /* Apply line numbering */
  if (options.lineNumbered) {
    result = result.map((item, index) => `${index + 1}. ${item}`);
  }

  return result;
}
