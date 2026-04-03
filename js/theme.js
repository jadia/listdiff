/**
 * theme.js — Theme Toggle with Animation
 * ==========================================
 * Handles switching between light and dark themes with a pretty
 * animated toggle button.
 *
 * HOW THEMING WORKS:
 * 1. We set a `data-theme` attribute on the <html> element
 * 2. CSS uses `[data-theme="dark"]` selectors to swap color variables
 * 3. All colors in the app use CSS custom properties (variables)
 * 4. Changing one attribute instantly reskins the entire page
 *
 * PERSISTENCE:
 * The user's theme choice is saved to localStorage so it survives
 * page reloads and browser restarts.
 *
 * ANIMATION:
 * The toggle button is a pill-shaped control with sun/moon icons.
 * On click:
 * - The knob slides left/right with a spring bounce
 * - The active icon rotates 360° with a scale effect
 * - The pill background color transitions smoothly
 */

/**
 * Initializes the theme system.
 *
 * @param {string} defaultTheme - 'light' or 'dark' (from config)
 * @param {Function} onToggle - Callback when theme changes (for analytics)
 */
export function initTheme(defaultTheme = 'light', onToggle = null) {
  /*
   * Check localStorage for a saved preference.
   * If the user previously chose a theme, respect that.
   * Otherwise, use the config default.
   */
  const saved = localStorage.getItem('listdiff-theme');
  const initialTheme = saved || defaultTheme;

  /* Apply the theme immediately (before any paint) */
  applyTheme(initialTheme);

  /* Set up the toggle button */
  const toggle = document.getElementById('theme-toggle');
  if (!toggle) return;

  /* Update the toggle's visual state to match the current theme */
  updateToggleState(toggle, initialTheme);

  /* Listen for clicks on the toggle */
  toggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const next = current === 'light' ? 'dark' : 'light';

    /* Apply the new theme */
    applyTheme(next);
    updateToggleState(toggle, next);

    /* Save to localStorage */
    localStorage.setItem('listdiff-theme', next);

    /* Trigger the bounce animation on the knob */
    const knob = toggle.querySelector('.theme-toggle__knob');
    if (knob) {
      knob.classList.remove('animate');
      /* Force a reflow so the browser sees the class removal before re-adding it.
       * Without this, the browser would batch both operations and skip the animation. */
      void knob.offsetWidth;
      knob.classList.add('animate');
    }

    /* Notify analytics if provided */
    if (onToggle) {
      onToggle(next);
    }
  });
}

/**
 * Sets the data-theme attribute on <html>.
 * This is the single line that makes the entire page change colors.
 *
 * @param {string} theme - 'light' or 'dark'
 */
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

/**
 * Updates the toggle button's visual state (which icon is active).
 *
 * @param {HTMLElement} toggle - The toggle button element
 * @param {string} theme - Current theme
 */
function updateToggleState(toggle, theme) {
  toggle.setAttribute('aria-label', `Switch to ${theme === 'light' ? 'dark' : 'light'} mode`);
  toggle.classList.toggle('theme-toggle--dark', theme === 'dark');
}
