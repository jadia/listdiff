/**
 * ui.js — User Interface Module
 * ================================
 * This module handles ALL DOM manipulation — reading from inputs,
 * rendering results, binding event listeners, and showing feedback.
 *
 * DESIGN RULE: No other module should touch the DOM directly.
 * comparator.js, utils.js, analytics.js — they all work with pure data.
 * ui.js is the bridge between data and what the user sees.
 *
 * WHY SEPARATE UI:
 * 1. Testability — core logic can be tested without a browser
 * 2. Maintainability — UI changes don't affect comparison logic
 * 3. Readability — clear separation of concerns
 */

import { compareLists, parseInput } from './comparator.js';
import {
  trimItems,
  deduplicateItems,
  sortItems,
  reverseItems,
  splitByDelimiter,
  copyToClipboard,
  countDuplicates,
  debounce,
  getClientInfo,
  generateId,
} from './utils.js';
import {
  createSessionId,
  saveSnapshot,
  getHistory,
  deleteEntry
} from './history.js';

// ============================================================================
// MODULE STATE
// ============================================================================

/** Reference to the analytics logAction function (set during init) */
let logAction = async () => {};

/** Reference to the config object */
let config = {};

/** Current session ID */
let sessionId = '';

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initializes the entire UI — binds all event listeners and sets defaults.
 *
 * @param {object} appConfig - The loaded configuration
 * @param {Function} analyticsLogAction - Function to log analytics events
 */
export function initUI(appConfig, analyticsLogAction) {
  config = appConfig;
  logAction = analyticsLogAction || (async () => {});
  sessionId = createSessionId();

  /* Set defaults from config for checkboxes and dropdowns */
  setDefaults(config.defaults);

  /* Bind all event listeners */
  bindInputListeners();
  bindToolbarListeners();
  bindCompareButton();
  bindKeyboardShortcuts();
  bindDragDropListeners();
  bindHistoryListeners();
  bindQuickCopyListeners();

  /* Set site metadata from config */
  setSiteMetadata();

  /* Update initial history state */
  refreshHistoryUI();

  /* Update initial counts */
  updateCounts('A');
  updateCounts('B');
}

// ============================================================================
// SITE METADATA
// ============================================================================

/**
 * Sets page title, tagline, footer text from config.
 */
function setSiteMetadata() {
  const siteConfig = config.site || {};

  const titleEl = document.getElementById('site-title');
  if (titleEl) titleEl.textContent = siteConfig.name || 'ListDiff';

  const taglineEl = document.getElementById('site-tagline');
  if (taglineEl) taglineEl.textContent = siteConfig.tagline || '';

  const footerEl = document.getElementById('footer-text');
  /* Use innerHTML for footer text to allow styling hearts or small links in config.json */
  if (footerEl) footerEl.innerHTML = siteConfig.footerText || '';

  const versionEl = document.getElementById('footer-version');
  if (versionEl) versionEl.textContent = `v${siteConfig.version || '1.0.0'}`;
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

/**
 * Sets checkbox and dropdown values from config defaults.
 * This ensures the UI matches what config.json specifies on first load.
 */
function setDefaults(defaults = {}) {
  setChecked('opt-case-sensitive', defaults.caseSensitive);
  setChecked('opt-ignore-begin-end', defaults.ignoreBeginEndSpaces);
  setChecked('opt-ignore-extra', defaults.ignoreExtraSpaces);
  setChecked('opt-ignore-zeroes', defaults.ignoreLeadingZeroes);
  setChecked('opt-line-numbered', defaults.lineNumbered);

  setValue('opt-sort', defaults.sortOption || 'none');
  setValue('opt-case-transform', defaults.caseTransform || 'none');
}

/** Safely sets a checkbox's checked state */
function setChecked(id, value) {
  const el = document.getElementById(id);
  if (el) el.checked = Boolean(value);
}

/** Safely sets a select/input element's value */
function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}

// ============================================================================
// INPUT LISTENERS (live line & duplicate counts)
// ============================================================================

/**
 * Binds input events to textareas for live line/dupe counting.
 *
 * WHY DEBOUNCE:
 * Counting lines and duplicates on every keystroke is wasteful,
 * especially for large lists. Debouncing waits until the user pauses
 * typing (150ms) before recalculating.
 */
function bindInputListeners() {
  const textA = document.getElementById('input-a');
  const textB = document.getElementById('input-b');
  const backdropA = document.getElementById('backdrop-a');
  const backdropB = document.getElementById('backdrop-b');

  const updateAll = () => {
    updateCounts('A');
    updateCounts('B');
    updateHighlighting();
  };

  const debouncedUpdate = debounce(updateAll, 150);

  if (textA) {
    textA.addEventListener('input', debouncedUpdate);
    textA.addEventListener('scroll', () => {
      if (backdropA) backdropA.scrollTop = textA.scrollTop;
    });
  }

  if (textB) {
    textB.addEventListener('input', debouncedUpdate);
    textB.addEventListener('scroll', () => {
      if (backdropB) backdropB.scrollTop = textB.scrollTop;
    });
  }
}

/**
 * Live Highlighting Comparison.
 * Synchronizes matching lines between List A and List B in the backdrops.
 */
function updateHighlighting() {
  const textA = document.getElementById('input-a')?.value || '';
  const textB = document.getElementById('input-b')?.value || '';
  const backdropA = document.getElementById('backdrop-a');
  const backdropB = document.getElementById('backdrop-b');

  if (!backdropA || !backdropB) return;

  const linesA = textA.split(/\r?\n/);
  const linesB = textB.split(/\r?\n/);

  /* Build normalized sets for O(1) matching */
  const options = readOptions();
  const setA = new Set(linesA.map(l => normalizeForHighlight(l, options)));
  const setB = new Set(linesB.map(l => normalizeForHighlight(l, options)));

  renderBackdrop(backdropA, linesA, setB, options);
  renderBackdrop(backdropB, linesB, setA, options);
}

/**
 * Normalizes a line for the purpose of matching highlights.
 */
function normalizeForHighlight(line, options) {
  let val = line;
  if (options.ignoreBeginEndSpaces) val = val.trim();
  if (options.ignoreExtraSpaces) val = val.replace(/\s+/g, ' ');
  if (!options.caseSensitive) val = val.toLowerCase();
  return val;
}

/**
 * Renders the backdrop HTML with matches wrapped in <mark>.
 */
function renderBackdrop(el, lines, matchSet, options) {
  const html = lines.map(line => {
    const normalized = normalizeForHighlight(line, options);
    const isMatch = line.trim() !== '' && matchSet.has(normalized);
    const escaped = escapeHtml(line);
    return isMatch ? `<mark>${escaped}</mark>` : escaped;
  }).join('\n') + '\n'; // Add trailing newline to match textarea behavior

  el.innerHTML = html;
}

/**
 * Escapes HTML to prevent XSS in backdrops.
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Updates the line count and duplicate count badges for a list.
 *
 * @param {'A' | 'B'} list - Which list to update
 */
function updateCounts(list) {
  const textarea = document.getElementById(`input-${list.toLowerCase()}`);
  const linesEl = document.getElementById(`lines-${list.toLowerCase()}`);
  const dupesEl = document.getElementById(`dupes-${list.toLowerCase()}`);

  if (!textarea) return;

  const text = textarea.value;
  const items = parseInput(text)
    .map(item => item.trim())
    .filter(item => item !== '');

  if (linesEl) linesEl.textContent = items.length;
  if (dupesEl) dupesEl.textContent = countDuplicates(items);
}

// ============================================================================
// TOOLBAR LISTENERS
// ============================================================================

/**
 * Binds click handlers for all toolbar buttons on both input lists.
 *
 * PATTERN: Instead of binding each button individually (like the original
 * listdiff.com code), we use data attributes to identify the action and target.
 * This makes the HTML declarative and the JS much cleaner.
 *
 * HTML: <button data-action="sort" data-target="A">Sort</button>
 * JS:   Read data-action and data-target, call the right function.
 */
function bindToolbarListeners() {
  /* Input toolbars */
  document.querySelectorAll('.input-toolbar [data-action]').forEach(btn => {
    btn.addEventListener('click', () => handleToolbarAction(btn, 'input'));
  });

  /* Result toolbars */
  document.querySelectorAll('.result-toolbar [data-action]').forEach(btn => {
    btn.addEventListener('click', () => handleToolbarAction(btn, 'result'));
  });
}

/**
 * Binds Quick Copy buttons in result panels.
 */
function bindQuickCopyListeners() {
  document.querySelectorAll('.quick-copy').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.target;
      const textarea = document.getElementById(`result-${target}`);
      if (!textarea) return;

      copyToClipboard(textarea.value).then(success => {
        if (success) {
          triggerQuickCopyAnimation(btn);
        }
      });
    });
  });
}

/**
 * Triggers the pop animation and flash text for the quick copy button.
 */
function triggerQuickCopyAnimation(btn) {
  btn.classList.add('flashing');
  setTimeout(() => {
    btn.classList.remove('flashing');
  }, 1500);
}

/**
 * Handles a toolbar button click.
 *
 * @param {HTMLElement} btn - The clicked button
 * @param {'input' | 'result'} area - Whether it's an input or result toolbar
 */
function handleToolbarAction(btn, area) {
  const action = btn.dataset.action;
  const target = btn.dataset.target;

  /* Determine which textarea to operate on */
  let textareaId;
  if (area === 'input') {
    textareaId = `input-${target.toLowerCase()}`;
  } else {
    textareaId = `result-${target}`;
  }

  const textarea = document.getElementById(textareaId);
  if (!textarea) return;

  const text = textarea.value;
  let items = parseInput(text);

  switch (action) {
    case 'move': {
      /* Move content from one list to another */
      const from = target;
      const to = btn.dataset.to;
      const fromTextarea = document.getElementById(`input-${from.toLowerCase()}`);
      const toTextarea = document.getElementById(`input-${to.toLowerCase()}`);
      if (fromTextarea && toTextarea) {
        toTextarea.value = fromTextarea.value;
        fromTextarea.value = '';
        updateCounts(from.toUpperCase());
        updateCounts(to.toUpperCase());
        showToast(`Moved to List ${to.toUpperCase()}`);
      }
      return;
    }

    case 'split': {
      /* Open split dialog to choose delimiter */
      openSplitDialog(textarea, target);
      return;
    }

    case 'trim': {
      /* Trim leading/trailing whitespace and remove empty lines */
      const cleaned = trimItems(items);
      textarea.value = cleaned.join('\n');
      showToast('Whitespace trimmed');
      break;
    }

    case 'dedupe': {
      /* Remove duplicate items, keeping first occurrences */
      const cleaned = deduplicateItems(items);
      textarea.value = cleaned.join('\n');
      showToast('Duplicates removed');
      break;
    }

    case 'sort': {
      /* Sort A-Z */
      items = items.map(i => i.trim()).filter(i => i !== '');
      const sorted = sortItems(items, 'asc');
      textarea.value = sorted.join('\n');
      break;
    }

    case 'reverse': {
      /* Reverse order */
      textarea.value = reverseItems(items).join('\n');
      break;
    }

    case 'copy': {
      /* Copy to clipboard */
      copyToClipboard(textarea.value).then(success => {
        showToast(success ? 'Copied to clipboard!' : 'Copy failed');
      });
      logAction({
        action: 'copy',
        listA: [],
        listB: [],
        options: {},
        resultCounts: {},
      });
      return;
    }

    case 'clear': {
      /* Clear the textarea */
      textarea.value = '';
      showToast('Cleared');
      updateHighlighting();
      break;
    }
  }

  /* Update counts after any modification to an input textarea */
  if (area === 'input') {
    updateCounts(target.toUpperCase());
    updateHighlighting();
  }
}

// ============================================================================
// SPLIT DIALOG
// ============================================================================

/**
 * Opens a modal dialog to choose a delimiter for splitting.
 */
function openSplitDialog(textarea, target) {
  const dialog = document.getElementById('split-dialog');
  if (!dialog) return;

  /* Store references for the confirm handler */
  dialog.dataset.textareaId = textarea.id;
  dialog.dataset.target = target;

  dialog.classList.add('visible');

  /* Bind confirm button */
  const confirmBtn = document.getElementById('split-confirm');
  const cancelBtn = document.getElementById('split-cancel');

  const handleConfirm = () => {
    const delimiterSelect = document.getElementById('split-delimiter');
    const customInput = document.getElementById('split-custom');
    let delimiter = delimiterSelect.value;

    if (delimiter === 'custom' && customInput.value) {
      delimiter = customInput.value;
    }

    const text = textarea.value;
    const items = splitByDelimiter(text, delimiter);
    textarea.value = items.join('\n');

    /* Also trim and dedupe after splitting */
    const cleaned = deduplicateItems(trimItems(parseInput(textarea.value)));
    textarea.value = cleaned.join('\n');

    updateCounts(target.toUpperCase());
    closeSplitDialog();
    showToast('Split complete');

    /* Clean up listeners */
    confirmBtn.removeEventListener('click', handleConfirm);
    cancelBtn.removeEventListener('click', handleCancel);
  };

  const handleCancel = () => {
    closeSplitDialog();
    confirmBtn.removeEventListener('click', handleConfirm);
    cancelBtn.removeEventListener('click', handleCancel);
  };

  confirmBtn.addEventListener('click', handleConfirm);
  cancelBtn.addEventListener('click', handleCancel);

  /* Show/hide custom input field based on delimiter selection */
  const delimiterSelect = document.getElementById('split-delimiter');
  const customInput = document.getElementById('split-custom-wrapper');
  delimiterSelect.addEventListener('change', () => {
    if (customInput) {
      customInput.style.display = delimiterSelect.value === 'custom' ? 'block' : 'none';
    }
  });
}

function closeSplitDialog() {
  const dialog = document.getElementById('split-dialog');
  if (dialog) dialog.classList.remove('visible');
}

// ============================================================================
// COMPARE BUTTON
// ============================================================================

/**
 * Binds the main "Compare Lists" button.
 * This is where the magic happens — it reads both inputs, runs the
 * comparison, and renders the results.
 */
function bindCompareButton() {
  const btn = document.getElementById('btn-compare');
  if (!btn) return;

  btn.addEventListener('click', runComparison);
}

/**
 * Reads options from the UI, runs the comparison, and renders results.
 */
function runComparison() {
  /* Read inputs */
  const textA = document.getElementById('input-a')?.value || '';
  const textB = document.getElementById('input-b')?.value || '';

  /* Read options from checkboxes and dropdowns */
  const options = readOptions();

  /* Run the comparison */
  const results = compareLists(textA, textB, options);

  /* Render results into the output panels */
  renderResults(results);

  /* Show the results section (it may be hidden on first load) */
  const resultsSection = document.getElementById('results-section');
  if (resultsSection) {
    resultsSection.classList.add('visible');
    /* Smooth scroll to results */
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  /* Log the comparison to analytics */
  const listA = parseInput(textA);
  const listB = parseInput(textB);

  logAction({
    action: 'compare',
    listA,
    listB,
    options,
    resultCounts: {
      aOnly: results.aOnly.length,
      bOnly: results.bOnly.length,
      intersection: results.intersection.length,
      union: results.union.length,
    },
    clientInfo: getClientInfo(),
  });

  /* Save to history */
  saveSnapshot(sessionId, { listA, listB, options });
  refreshHistoryUI();
}

/**
 * Reads the current state of all option checkboxes and dropdowns.
 *
 * @returns {object} Options object matching what compareLists expects
 */
function readOptions() {
  return {
    caseSensitive: document.getElementById('opt-case-sensitive')?.checked ?? true,
    ignoreBeginEndSpaces: document.getElementById('opt-ignore-begin-end')?.checked ?? true,
    ignoreExtraSpaces: document.getElementById('opt-ignore-extra')?.checked ?? true,
    ignoreLeadingZeroes: document.getElementById('opt-ignore-zeroes')?.checked ?? false,
    lineNumbered: document.getElementById('opt-line-numbered')?.checked ?? false,
    sortOption: document.getElementById('opt-sort')?.value || 'none',
    caseTransform: document.getElementById('opt-case-transform')?.value || 'none',
  };
}

// ============================================================================
// RESULTS RENDERING
// ============================================================================

/**
 * Renders comparison results into the four output panels.
 *
 * Each panel has:
 * - A count badge showing how many items
 * - A textarea with the items (read-only for display, but selectable)
 * - A toolbar row with Trim, Sort, Reverse, Copy buttons
 *
 * @param {object} results - { aOnly, bOnly, intersection, union }
 */
function renderResults(results) {
  renderResultPanel('a-only', results.aOnly);
  renderResultPanel('b-only', results.bOnly);
  renderResultPanel('intersection', results.intersection);
  renderResultPanel('union', results.union);
}

/**
 * Renders a single result panel.
 *
 * @param {string} id - Panel identifier (e.g., 'a-only')
 * @param {string[]} items - The items to display
 */
function renderResultPanel(id, items) {
  const textarea = document.getElementById(`result-${id}`);
  const countEl = document.getElementById(`count-${id}`);

  if (textarea) {
    textarea.value = items.join('\n');
  }

  if (countEl) {
    countEl.textContent = items.length;
    /* Trigger the count badge animation */
    countEl.classList.remove('pop');
    void countEl.offsetWidth; // Force reflow to restart animation
    countEl.classList.add('pop');
  }
}

// ============================================================================
// DRAG & DROP
// ============================================================================

/**
 * Binds drag and drop events to the input panels.
 */
function bindDragDropListeners() {
  const panels = document.querySelectorAll('.input-panel');

  panels.forEach(panel => {
    const textarea = panel.querySelector('textarea');
    if (!textarea) return;

    panel.addEventListener('dragenter', (e) => {
      e.preventDefault();
      panel.classList.add('drag-over');
    });

    panel.addEventListener('dragover', (e) => {
      e.preventDefault();
      panel.classList.add('drag-over');
    });

    panel.addEventListener('dragleave', (e) => {
      /* Prevent flickering when dragging over children elements */
      if (!panel.contains(e.relatedTarget)) {
        panel.classList.remove('drag-over');
      }
    });

    panel.addEventListener('drop', (e) => {
      e.preventDefault();
      panel.classList.remove('drag-over');

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleFileDrop(files[0], textarea);
      }
    });
  });
}

/**
 * Reads a dropped file and appends its content to the textarea.
 */
function handleFileDrop(file, textarea) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const content = e.target.result;
    const currentVal = textarea.value.trim();
    textarea.value = currentVal ? `${currentVal}\n${content}` : content;
    
    /* Trigger updates */
    const list = textarea.id.endsWith('-a') ? 'A' : 'B';
    updateCounts(list);
    updateHighlighting();
    showToast(`Appended: ${file.name}`);
  };
  reader.readAsText(file);
}

// ============================================================================
// HISTORY SIDEBAR
// ============================================================================

/**
 * Binds history sidebar toggle and delete logic.
 */
function bindHistoryListeners() {
  const toggleBtn = document.getElementById('history-toggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  const closeBtn = document.getElementById('sidebar-close');

  const openSidebar = () => {
    sidebar.classList.add('sidebar--open');
    overlay.classList.add('sidebar-overlay--visible');
  };

  const closeSidebar = () => {
    sidebar.classList.remove('sidebar--open');
    overlay.classList.remove('sidebar-overlay--visible');
  };

  toggleBtn?.addEventListener('click', openSidebar);
  closeBtn?.addEventListener('click', closeSidebar);
  overlay?.addEventListener('click', closeSidebar);
}

/**
 * Refreshes the History Sidebar content and visibility based on local state.
 */
function refreshHistoryUI() {
  const history = getHistory();
  const toggleBtn = document.getElementById('history-toggle');
  const listEl = document.getElementById('history-list');

  /* Visibility: Hide if no records */
  if (history.length === 0) {
    toggleBtn.style.display = 'none';
    return;
  }
  toggleBtn.style.display = 'flex';

  if (!listEl) return;

  listEl.innerHTML = '';
  history.forEach(item => {
    const card = document.createElement('div');
    card.className = 'history-item';
    
    // Check if this card represents the current session
    if (item.sessionId === sessionId) {
      card.classList.add('history-item--current');
    }

    const dateStr = new Date(item.timestamp).toLocaleString();

    card.innerHTML = `
      <span class="history-item__id">${item.sessionId}</span>
      <span class="history-item__time">${dateStr}</span>
      <button class="history-item__delete" title="Delete history entry">✕</button>
    `;

    // Restore on click
    card.addEventListener('click', (e) => {
      if (e.target.classList.contains('history-item__delete')) {
        e.stopPropagation();
        deleteEntry(item.sessionId);
        refreshHistoryUI();
        return;
      }
      restoreSession(item);
    });

    listEl.appendChild(card);
  });
}

/**
 * Restores a past session into the UI.
 */
function restoreSession(item) {
  sessionId = item.sessionId;
  const { listA, listB, options } = item.data;

  const inputA = document.getElementById('input-a');
  const inputB = document.getElementById('input-b');

  if (inputA) inputA.value = listA.join('\n');
  if (inputB) inputB.value = listB.join('\n');

  setDefaults(options);
  updateCounts('A');
  updateCounts('B');
  updateHighlighting();
  
  // Close sidebar on restore
  document.getElementById('sidebar-close')?.click();
  
  showToast('Session restored');
}


// ============================================================================
// KEYBOARD SHORTCUTS
// ============================================================================

/**
 * Binds keyboard shortcuts.
 * Ctrl+Enter (or Cmd+Enter on Mac) triggers comparison.
 */
function bindKeyboardShortcuts() {
  if (!config.features?.keyboardShortcuts) return;

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      runComparison();
    }
  });
}

// ============================================================================
// TOAST NOTIFICATIONS
// ============================================================================

/**
 * Shows a brief toast notification at the bottom-right of the screen.
 *
 * HOW IT WORKS:
 * 1. Creates a div element with the "toast" class
 * 2. Adds it to the toast container
 * 3. CSS animations handle the slide-in and fade-out
 * 4. After the animation completes, the element is removed from the DOM
 *
 * @param {string} message - Text to display
 * @param {number} duration - How long to show (ms), default 2000
 */
export function showToast(message, duration = 2000) {
  if (!config.features?.toastNotifications) return;

  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);

  /* Trigger the slide-in animation (CSS handles this via the .toast class) */
  requestAnimationFrame(() => {
    toast.classList.add('visible');
  });

  /* Remove after duration */
  setTimeout(() => {
    toast.classList.remove('visible');
    toast.addEventListener('transitionend', () => toast.remove(), { once: true });
    /* Fallback removal in case transitionend doesn't fire */
    setTimeout(() => toast.remove(), 500);
  }, duration);
}
