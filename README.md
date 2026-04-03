# ListDiff

> A clean, fast tool to compare two lists and find differences, intersections, and unions.

**Live**: [jadia.dev/listdiff](https://jadia.dev/listdiff)

---

## Features

- 🔍 **Compare two lists** — Find what's unique, shared, or combined
- ⚡ **Instant results** — All processing happens client-side
- 🎨 **Light & Dark themes** — Animated toggle with persistent preference
- 📋 **Toolbar actions** — Split, trim, sort, reverse, copy, clear per list
- 🔧 **Comparison options** — Case sensitivity, space handling, leading zeroes, sorting, case transforms
- 📊 **Analytics** — Anonymous usage logging to Firebase Firestore
- 📱 **Responsive** — Desktop-first with mobile support
- ♿ **Accessible** — Semantic HTML, ARIA labels, keyboard shortcuts

---

## Quick Start

### View the Site

Open `index.html` in any modern browser. That's it — no build step needed.

For a proper local server (required for ES modules and fetch):

```bash
# Using Node.js
npx serve .

# Or Python
python3 -m http.server 8000
```

### Run Tests

```bash
npm install      # Install vitest (one-time)
npm test         # Run all 115 tests
npm run test:watch  # Watch mode
```

---

## Project Structure

```
listdiff/
├── index.html           # Main page (single-page app)
├── config.json          # Master configuration file
├── css/
│   └── styles.css       # Complete design system + styles
├── js/
│   ├── app.js           # Entry point — wires everything together
│   ├── comparator.js    # Core comparison engine (pure functions)
│   ├── ui.js            # All DOM manipulation
│   ├── theme.js         # Light/dark theme toggle
│   ├── analytics.js     # Firebase Firestore logging
│   ├── rate-limiter.js  # Client-side rate limiting
│   ├── config.js        # Configuration loader
│   └── utils.js         # Shared utility functions
├── assets/
│   └── favicon.svg      # Browser tab icon
├── tests/
│   ├── comparator.test.js
│   ├── utils.test.js
│   ├── rate-limiter.test.js
│   └── analytics.test.js
├── specifications/
│   └── spec.md          # Full project specification
├── .github/workflows/
│   └── deploy.yml       # GitHub Pages deployment
├── package.json         # Dev dependencies (vitest)
└── vitest.config.js     # Test configuration
```

---

## Configuration

All settings live in `config.json`. Key sections:

| Section | Purpose |
|---|---|
| `site` | Brand name, tagline, version, footer text |
| `firebase` | Firestore connection settings |
| `analytics` | Logging toggle, data limits, rate limits |
| `defaults` | Default checkbox/dropdown values |
| `features` | Feature flags (theme toggle, shortcuts, etc.) |

See [specifications/spec.md](specifications/spec.md) for full documentation of every config key.

---

## Firebase Setup

1. Create a Firebase project at [console.firebase.google.com](https://console.firebase.google.com/)
2. Enable **Firestore Database** in production mode
3. Set security rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /audit_logs/{logId} {
      allow create: if true;
      allow read, update, delete: if false;
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

4. Copy your Firebase config into `config.json` under the `firebase` key

---

## Deployment

Push to `main` → GitHub Actions runs tests → deploys to GitHub Pages.

### Prerequisites

1. Go to repo **Settings → Pages → Source** → select **"GitHub Actions"**
2. Ensure custom domain (`jadia.dev`) is configured in DNS

---

## Architecture

```
app.js (entry point)
├── config.js      → loads config.json via fetch()
├── theme.js       → light/dark mode toggle
├── analytics.js   → Firebase Firestore audit logging
│   └── utils.js   → data sanitization, client info
├── rate-limiter.js → throttles analytics writes
└── ui.js          → all DOM interaction
    ├── comparator.js → pure comparison logic
    └── utils.js      → trim, sort, reverse, copy, split
```

**Design principles:**
- No module touches the DOM except `ui.js` and `theme.js`
- `comparator.js` is pure functions — fully testable without a browser
- Analytics failures never break the comparison tool
- Config is loaded once and frozen — no module can accidentally modify it

---

## License

MIT
