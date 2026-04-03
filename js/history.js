/**
 * history.js
 * handles localStorage based session history for ListDiff
 */

import { generateId } from './utils.js';

const STORAGE_KEY = 'listdiff_history';

/**
 * Generate a unique session ID for the current browser session.
 * This ID persists until the page is reloaded.
 */
export function createSessionId() {
  return `session-${generateId(6)}`;
}

/**
 * Save a comparison snapshot to history.
 * If the session already exists, it updates the existing entry and moves it to the top.
 */
export function saveSnapshot(sessionId, data) {
  const history = getHistory();
  const timestamp = new Date().toISOString();

  const existingIndex = history.findIndex(item => item.sessionId === sessionId);
  
  const newEntry = {
    sessionId,
    timestamp,
    data: {
      listA: data.listA,
      listB: data.listB,
      options: data.options
    }
  };

  if (existingIndex > -1) {
    // Update existing and move to top
    history.splice(existingIndex, 1);
  }
  
  history.unshift(newEntry);
  
  // Limit history to last 20 comparisons to avoid localStorage bloat
  const limitedHistory = history.slice(0, 20);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(limitedHistory));
  
  return limitedHistory;
}

/**
 * Retrieve all history entries.
 */
export function getHistory() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error('Failed to parse history from localStorage', e);
    return [];
  }
}

/**
 * Delete a specific history entry.
 */
export function deleteEntry(sessionId) {
  const history = getHistory();
  const filtered = history.filter(item => item.sessionId !== sessionId);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
  return filtered;
}

/**
 * Clear all history.
 */
export function clearAllHistory() {
  localStorage.removeItem(STORAGE_KEY);
}
