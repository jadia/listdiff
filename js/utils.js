/**
 * utils.js — Shared Utility Functions
 * ====================================
 * This module contains pure helper functions used across the application.
 * None of these functions touch the DOM — they operate on data only.
 * This makes them easy to test and reuse.
 *
 * KEY CONCEPTS:
 * - Pure functions: same input always produces same output, no side effects
 * - ES Modules: we use `export` so other files can `import` specific functions
 */

// ============================================================================
// LIST MANIPULATION
// ============================================================================

/**
 * Trims whitespace from each item and removes empty strings.
 *
 * WHY: Users often paste data with trailing spaces or blank lines.
 * This cleans it up before comparison or display.
 *
 * @param {string[]} items - Array of strings to clean
 * @returns {string[]} Cleaned array with no empty items
 *
 * @example
 *   trimItems(['  hello ', '', '  world  ']) → ['hello', 'world']
 */
export function trimItems(items) {
  return items
    .map(item => item.trim())       // Remove leading/trailing whitespace
    .filter(item => item !== '');    // Remove empty strings
}

/**
 * Removes duplicate items, keeping only the first occurrence.
 *
 * HOW IT WORKS:
 * - A Set automatically ignores duplicate values
 * - By spreading the Set back into an array, we get unique items
 * - Order is preserved because Set maintains insertion order (ES2015+)
 *
 * @param {string[]} items - Array that may contain duplicates
 * @returns {string[]} Array with duplicates removed
 *
 * @example
 *   deduplicateItems(['a', 'b', 'a', 'c', 'b']) → ['a', 'b', 'c']
 */
export function deduplicateItems(items) {
  return [...new Set(items)];
}

/**
 * Sorts an array of strings alphabetically.
 *
 * ABOUT localeCompare:
 * - It handles international characters correctly (e.g., é, ñ, ü)
 * - It's case-insensitive by default with the 'sensitivity' option
 * - We use 'base' sensitivity so 'a' and 'A' are treated equally for sorting
 *
 * @param {string[]} items - Array to sort
 * @param {'asc' | 'desc'} direction - Sort direction
 * @returns {string[]} New sorted array (original is not modified)
 */
export function sortItems(items, direction = 'asc') {
  /* Create a copy so we don't mutate the original array */
  const sorted = [...items].sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );
  /* If descending, just reverse the ascending result */
  return direction === 'desc' ? sorted.reverse() : sorted;
}

/**
 * Reverses the order of items.
 *
 * @param {string[]} items - Array to reverse
 * @returns {string[]} New reversed array (original is not modified)
 */
export function reverseItems(items) {
  return [...items].reverse();
}

/**
 * Splits a text string by a delimiter, handling quoted sections.
 *
 * WHY QUOTE HANDLING:
 * CSV data often has commas inside quoted strings:
 *   "New York, NY",Chicago,"Los Angeles, CA"
 * A naive split(',') would break "New York, NY" into two pieces.
 * This function respects quotes so that doesn't happen.
 *
 * PORTED FROM: The original listdiff.com `splitRow` function.
 * The algorithm walks character by character, tracking whether we're
 * inside a quoted section. Delimiters inside quotes are treated as
 * regular characters, not split points.
 *
 * @param {string} text - The text to split
 * @param {RegExp} delimiterRegex - Regex matching delimiter characters (e.g., /[,;\t]/)
 * @returns {string[]} Array of split values
 */
export function splitCSVRow(text, delimiterRegex) {
  const result = [];
  let current = '';       // The current field being built
  let inQuotes = false;   // Are we inside a quoted section?
  let quoteChar = null;   // Which quote character started the section (' or ")
  let escaped = false;    // Was the previous character a backslash?

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (escaped) {
      /*
       * Previous char was a backslash — this char is literal.
       * Inside quotes, we add the backslash too (e.g., "hello\"world").
       * Outside quotes, we just add the escaped character.
       */
      current += (inQuotes && char !== '"' && char !== "'") ? '\\' + char : char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      /* Backslash: next character is escaped (literal) */
      if (inQuotes) {
        current += char;
      }
      escaped = true;
      continue;
    }

    if (char === '"' || char === "'") {
      if (inQuotes && char === quoteChar) {
        /* Closing quote — end the quoted section */
        inQuotes = false;
        quoteChar = null;
      } else if (!inQuotes) {
        /* Opening quote — start a quoted section */
        inQuotes = true;
        quoteChar = char;
      }
      current += char;
      continue;
    }

    if (!inQuotes && delimiterRegex.test(char)) {
      /* Delimiter found outside quotes — split here */
      result.push(current);
      current = '';
      continue;
    }

    /* Regular character — add to current field */
    current += char;
  }

  /* Don't forget the last field (no delimiter after it) */
  result.push(current);
  return result;
}

/**
 * Splits text into individual items using CSV-aware parsing.
 *
 * PORTED FROM: Original listdiff.com `splitCSV` function.
 * First splits by newlines, then splits each line by common delimiters
 * (comma, semicolon, colon, tab), trims each result, and deduplicates.
 *
 * @param {string} text - Raw text that may contain delimited values
 * @returns {string[]} Array of individual, unique, trimmed items
 */
export function splitByDelimiter(text, delimiter = 'auto') {
  const lines = text.split(/\r?\n/);
  const items = new Set();

  /* Build a regex for the delimiter */
  let delimRegex;
  if (delimiter === 'auto') {
    delimRegex = /[,;:\t]/;  // Split by any common delimiter
  } else if (delimiter === 'comma') {
    delimRegex = /,/;
  } else if (delimiter === 'semicolon') {
    delimRegex = /;/;
  } else if (delimiter === 'pipe') {
    delimRegex = /\|/;
  } else if (delimiter === 'tab') {
    delimRegex = /\t/;
  } else {
    /* Custom delimiter — escape regex special characters */
    delimRegex = new RegExp(delimiter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  }

  for (const line of lines) {
    if (line.trim() === '') continue;

    const parts = splitCSVRow(line, delimRegex);
    for (const part of parts) {
      const trimmed = part.trim();
      if (trimmed !== '') {
        items.add(trimmed);
      }
    }
  }

  return Array.from(items);
}

// ============================================================================
// CLIPBOARD
// ============================================================================

/**
 * Copies text to the clipboard.
 *
 * STRATEGY:
 * 1. Try the modern Async Clipboard API (navigator.clipboard.writeText)
 * 2. Fall back to the older execCommand('copy') for compatibility
 *
 * WHY FALLBACK:
 * The Clipboard API requires HTTPS and a secure context.
 * Some browsers or older environments don't support it.
 * The execCommand fallback works by creating a temporary textarea,
 * selecting its content, and executing the copy command.
 *
 * @param {string} text - Text to copy to clipboard
 * @returns {Promise<boolean>} True if copy succeeded
 */
export async function copyToClipboard(text) {
  try {
    /* Modern approach — works in secure contexts (HTTPS) */
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    /* Fallback for older browsers or non-secure contexts */
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';    // Don't scroll the page
      textarea.style.opacity = '0';          // Invisible
      document.body.appendChild(textarea);
      textarea.select();
      const success = document.execCommand('copy');
      document.body.removeChild(textarea);
      return success;
    } catch {
      return false;
    }
  }
}

// ============================================================================
// DATA SANITIZATION FOR STORAGE
// ============================================================================

/**
 * Counts how many items in a list appear more than once.
 *
 * HOW IT WORKS:
 * - Uses Array.reduce to build a frequency map (item → count)
 * - Then counts how many items have count > 1
 *
 * PORTED FROM: Original listdiff.com `countDupes` function.
 *
 * @param {string[]} items - Array of strings
 * @returns {number} Number of items that have duplicates
 *
 * @example
 *   countDuplicates(['a', 'b', 'a', 'c', 'b', 'b']) → 2  // 'a' and 'b' are duplicated
 */
export function countDuplicates(items) {
  /* Build a map of item → how many times it appears */
  const frequency = items.reduce((map, item) => {
    map[item] = (map[item] || 0) + 1;
    return map;
  }, {});

  /* Count how many items appear more than once */
  let dupeCount = 0;
  for (const key in frequency) {
    if (frequency[key] > 1) {
      dupeCount++;
    }
  }
  return dupeCount;
}

/**
 * Truncates and sanitizes data for Firestore storage.
 *
 * WHY: We want to log comparison data for analytics, but we can't store
 * unlimited data. A user might paste 50,000 lines — we only keep a sample.
 *
 * GUARDRAILS:
 * - Max N items per list (configurable, default 100)
 * - Max M characters per item (configurable, default 200)
 * - Always reports whether truncation happened and the details
 *
 * @param {string[]} items - The full list of items
 * @param {object} limits - { maxItems: number, maxItemLength: number }
 * @returns {object} { data: string[], truncated: boolean, details: object }
 */
export function sanitizeForStorage(items, limits = {}) {
  const maxItems = limits.maxItems || 100;
  const maxItemLength = limits.maxItemLength || 200;

  const originalSize = items.length;
  let itemsLengthCapped = 0;

  /* Step 1: Take only the first maxItems items */
  const truncatedList = items.slice(0, maxItems);

  /* Step 2: Cap each item's text length */
  const sanitized = truncatedList.map(item => {
    if (item.length > maxItemLength) {
      itemsLengthCapped++;
      /* Truncate and add '…' to indicate the text was cut */
      return item.substring(0, maxItemLength - 1) + '…';
    }
    return item;
  });

  /* Step 3: Determine if any truncation occurred */
  const listTruncated = originalSize > maxItems;
  const truncated = listTruncated || itemsLengthCapped > 0;

  return {
    data: sanitized,
    truncated,
    details: {
      listTruncated,
      originalSize,
      storedSize: sanitized.length,
      itemsLengthCapped,
    },
  };
}

// ============================================================================
// CLIENT INFORMATION COLLECTION
// ============================================================================

/**
 * Collects available browser/device information for analytics.
 *
 * PRIVACY NOTE:
 * All of this is standard browser metadata — no fingerprinting techniques.
 * We collect what the browser freely provides via standard APIs.
 *
 * WHAT WE COLLECT:
 * - User agent (browser name/version)
 * - Screen and viewport dimensions
 * - Language preference
 * - Platform (OS)
 * - Timezone
 * - Referrer (how they got here)
 * - Color scheme preference (light/dark)
 * - Network connection type (if available)
 * - Device memory and CPU cores (if available — Chrome only)
 *
 * @returns {object} Client information object
 */
export function getClientInfo() {
  /* navigator.connection is only available in Chromium browsers */
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;

  return {
    userAgent: navigator.userAgent || 'unknown',
    screenWidth: screen.width || 0,
    screenHeight: screen.height || 0,
    viewportWidth: window.innerWidth || 0,
    viewportHeight: window.innerHeight || 0,
    language: navigator.language || 'unknown',
    platform: navigator.platform || 'unknown',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'unknown',
    referrer: document.referrer || 'direct',
    colorScheme: window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
    connectionType: connection ? connection.effectiveType || 'unknown' : 'unknown',
    deviceMemory: navigator.deviceMemory || null,
    hardwareConcurrency: navigator.hardwareConcurrency || null,
  };
}

// ============================================================================
// GENERAL UTILITIES
// ============================================================================

/**
 * Creates a debounced version of a function.
 *
 * WHAT IS DEBOUNCING:
 * When a user types quickly, we don't want to run expensive work on every
 * keystroke. Debouncing waits until the user stops typing for `ms` milliseconds,
 * then runs the function once with the most recent arguments.
 *
 * HOW IT WORKS:
 * 1. Every call clears the previous timer
 * 2. Sets a new timer for `ms` milliseconds
 * 3. When the timer fires, the original function runs
 * Result: Only the last call in a rapid sequence actually executes.
 *
 * @param {Function} fn - Function to debounce
 * @param {number} ms - Delay in milliseconds
 * @returns {Function} Debounced version of fn
 */
export function debounce(fn, ms) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

/**
 * Escapes HTML special characters to prevent XSS attacks.
 *
 * WHY: If we ever insert user data into the DOM using innerHTML,
 * malicious input like `<script>alert('xss')</script>` could execute.
 * Escaping converts dangerous characters to their HTML entity equivalents.
 *
 * CHARACTERS ESCAPED:
 * - & → &amp;   (must be first to avoid double-escaping)
 * - < → &lt;
 * - > → &gt;
 * - " → &quot;
 * - ' → &#039;
 *
 * @param {string} str - Raw string that might contain HTML
 * @returns {string} Safe string with HTML entities escaped
 */
export function escapeHtml(str) {
  const escapeMap = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return str.replace(/[&<>"']/g, char => escapeMap[char]);
}

/**
 * Converts a string to title case.
 *
 * Title case means the first letter of each word is capitalized,
 * and the rest are lowercase.
 *
 * @param {string} str - String to convert
 * @returns {string} Title-cased string
 *
 * @example
 *   toTitleCase('hello world') → 'Hello World'
 *   toTitleCase('HELLO WORLD') → 'Hello World'
 */
export function toTitleCase(str) {
  return str
    .toLowerCase()
    .replace(/(?:^|\s)\S/g, match => match.toUpperCase());
}

/**
 * Generates a random alphanumeric ID.
 *
 * @param {number} length - Desired length of the ID
 * @returns {string} Random ID string
 */
export function generateId(length = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
