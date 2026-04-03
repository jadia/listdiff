# ListDiff — Project Specification

> **Version**: 1.0.0  
> **Last Updated**: 2026-04-04  
> **Status**: Active Development

## 1. Project Overview

**ListDiff** is a client-side web application that compares two lists of text items and shows their differences, intersection, and union. It is a clean, modern reimagining of [listdiff.com](https://www.listdiff.com/) — focused exclusively on the **Compare Lists** feature.

### Goals
- Provide a fast, privacy-focused list comparison tool
- All processing happens client-side (no data leaves the browser)
- Log anonymous usage analytics to Firebase Firestore for understanding usage patterns
- Deploy as a static site to GitHub Pages at `jadia.dev/listdiff`
- Serve as a learning resource with educational code comments

### Non-Goals
- Compare Text (character-level diff)
- Text Fixer, CSV Splitter, Text Columnizer, VLookup
- User authentication or accounts
- Server-side processing

---

## 2. Feature Inventory

### 2.1 Input

| Feature | Description |
|---|---|
| **Two input textareas** | List A and List B, one item per line |
| **Live line count** | Shows number of non-empty lines in real-time |
| **Live duplicate count** | Shows number of items that appear more than once |
| **Placeholder text** | Guides users on expected input format |
| **Spellcheck disabled** | Prevents distracting red underlines on data |

### 2.2 Input Toolbar (per list)

| Button | Action |
|---|---|
| **A → B / B → A** | Moves content from one list to the other (source is cleared) |
| **✂ Split** | Opens a dialog to split delimited text into individual lines |
| **⊣⊢ Trim** | Removes leading/trailing spaces and empty lines |
| **⊜ Dedupe** | Removes identical items from the list |
| **↕ Sort** | Sorts items alphabetically (A-Z) |
| **⇅ Reverse** | Reverses the order of items |
| **⎘ Copy** | Copies the textarea content to clipboard |
| **✕ Clear** | Clears the textarea (with destructive red-hover alert) |

### 3.4 Advanced Interactive Features (New)

| Feature | Description |
|---|---|
| **Drag & Drop** | Dropping `.txt` or `.csv` files into a textarea appends the file content to existing text. |
| **Live Highlighting** | Transparent textarea with a backdrop layer that highlights lines identical to the other list in real-time. |
| **Quick Copy** | Small floating copy icons in result panels with glare animations and localized "Copied!" flash feedback. |
| **History Sidebar** | Right-side sliding panel containing past comparison snapshots with timestamps and deletion controls. |

### 2.3 Split Dialog

A modal dialog that lets users choose how to split delimited text:
- **Auto**: Splits by comma, semicolon, colon, or tab
- **Comma**, **Semicolon**, **Pipe**, **Tab**: Specific delimiters
- **Custom**: User enters a custom delimiter string
- Handles quoted sections (CSV-aware parsing)

### 2.4 Comparison Options

| Option | Default | Description |
|---|---|---|
| **Case Sensitive** | ✅ On | `"Apple"` and `"apple"` are treated as different items |
| **Ignore Begin/End Spaces** | ✅ On | Trims leading/trailing whitespace before comparing |
| **Ignore Extra Spaces** | ✅ On | Collapses multiple spaces to one before comparing |
| **Ignore Leading Zeroes** | ❌ Off | Treats `"001"` and `"1"` as the same item |
| **Line Numbered** | ❌ Off | Prefixes results with `1. `, `2. `, etc. |
| **Sort** | No Sort | Sorts results: None / Ascending / Descending |
| **Case Transform** | No Change | Transforms result display: None / Lowercase / Uppercase / Title Case |

### 2.5 Output Sections

| Section | Set Operation | Color Code |
|---|---|---|
| **A Only** | A \ B (set difference) | Blue |
| **B Only** | B \ A (set difference) | Amber/Orange |
| **A ∩ B** | Intersection | Green |
| **A ∪ B** | Union | Purple |

Each section shows:
- Section name with mathematical set notation
- Count badge (animated pop-in)
- Read-only textarea with results
- Toolbar: Trim, Deduplicate, Sort, Reverse, Copy

### 2.6 Other Features

| Feature | Description |
|---|---|
| **Theme Toggle** | Light/Dark mode with animated pill toggle (sun/moon icons) |
| **Keyboard Shortcut** | Ctrl+Enter (or Cmd+Enter) triggers comparison |
| **Toast Notifications** | Brief feedback messages (e.g., "Copied to clipboard!") |
| **Responsive Design** | Desktop-first, stacks to single column on mobile |
| **Smooth Scroll** | Auto-scrolls to results after comparison |

---

## 3. Architecture

### 3.1 Module Dependency Graph

```
app.js (entry point)
├── config.js      → loads config.json
├── theme.js       → light/dark mode
├── analytics.js   → Firebase Firestore logging
│   └── utils.js   → sanitizeForStorage, getClientInfo
├── rate-limiter.js → throttles analytics
└── ui.js          → all DOM interaction
    ├── comparator.js → comparison logic
    └── utils.js      → trimItems, sortItems, copyToClipboard, etc.
```

### 3.2 Data Flow

```
User pastes text → textarea (input-a, input-b)
       ↓
User clicks [Compare Lists] (or Ctrl+Enter)
       ↓
ui.js reads textareas + option checkboxes/dropdowns
       ↓
ui.js calls compareLists(textA, textB, options)
       ↓
comparator.js:
  1. parseInput() → arrays of lines
  2. normalizeItem() → comparison keys
  3. Map/Set operations → aOnly, bOnly, intersection, union
  4. applyTransforms() → sort, case, line numbers
       ↓
ui.js renders results into 4 output panels
       ↓
analytics.js builds log entry (with data truncation)
       ↓
rate-limiter checks if logging is allowed
       ↓
If allowed → write to Firestore collection "audit_logs"
```

### 3.3 Technology Choices

| Choice | Rationale |
|---|---|
| **Vanilla JS (ES Modules)** | No build step needed, works directly on GitHub Pages |
| **CSS Custom Properties** | Theme switching without JS color manipulation |
| **Firebase Firestore** | Free tier, schemaless, real-time, easy setup |
| **Import Maps** | Load Firebase SDK from CDN without bundler |
| **Vitest** | Fast, ES-module-native test runner |

## 6. Storage & Session Management
-   **LocalStorage (Browser-only)**: History snapshots are stored locally.
-   **Session IDs**: Unique IDs generated per tab session (persists until refresh).
-   **Snapshot structure**: Stores List A, List B, Options, and a Timestamp. Limits to top 20 recent entries.

## 7. Performance Considerations

---

## 4. Configuration Reference

The master configuration lives in `config.json`. Every configurable value is documented below.

### 4.1 `site` — Site Metadata

| Key | Type | Description |
|---|---|---|
| `name` | string | Brand name displayed in header |
| `tagline` | string | Subtitle displayed next to brand |
| `description` | string | SEO meta description |
| `basePath` | string | URL path prefix (e.g., `/listdiff`) |
| `version` | string | Semantic version, shown in footer |
| `footerText` | string | Footer message (e.g., `"Made with <span class=\"footer_heart\">❤</span>"`) |

### 4.2 `firebase` — Firebase Configuration

| Key | Type | Description |
|---|---|---|
| `apiKey` | string | Firebase Web API key (public, not secret) |
| `authDomain` | string | Firebase Auth domain |
| `projectId` | string | Firestore project ID |
| `storageBucket` | string | Firebase Storage bucket |
| `messagingSenderId` | string | FCM sender ID |
| `appId` | string | Firebase app ID |
| `measurementId` | string | Google Analytics measurement ID |

### 4.3 `analytics` — Audit Logging Settings

| Key | Type | Default | Description |
|---|---|---|---|
| `enabled` | boolean | `true` | Enable/disable all analytics logging |
| `collectionName` | string | `"audit_logs"` | Firestore collection name |
| `maxItemsPerList` | number | `100` | Max items stored per list in a log entry |
| `maxItemLength` | number | `200` | Max characters per item before truncation |
| `rateLimits.compare` | number | `3000` | Cooldown (ms) between compare logs |
| `rateLimits.copy` | number | `2000` | Cooldown (ms) between copy logs |
| `rateLimits.theme_toggle` | number | `2000` | Cooldown (ms) between theme logs |
| `rateLimits.page_load` | string | `"once"` | Log only once per session |

### 4.4 `defaults` — Default UI State

| Key | Type | Default | Description |
|---|---|---|---|
| `caseSensitive` | boolean | `true` | Case Sensitive checkbox default |
| `ignoreBeginEndSpaces` | boolean | `true` | Ignore spaces checkbox default |
| `ignoreExtraSpaces` | boolean | `true` | Ignore extra spaces default |
| `ignoreLeadingZeroes` | boolean | `false` | Ignore zeroes default |
| `lineNumbered` | boolean | `false` | Line numbered default |
| `sortOption` | string | `"none"` | Sort dropdown default |
| `caseTransform` | string | `"none"` | Case transform default |
| `theme` | string | `"light"` | Default theme |

### 4.5 `features` — Feature Flags

| Key | Type | Default | Description |
|---|---|---|---|
| `themeToggle` | boolean | `true` | Show the theme toggle button |
| `splitDialog` | boolean | `true` | Enable the split dialog modal |
| `toastNotifications` | boolean | `true` | Show toast messages |
| `keyboardShortcuts` | boolean | `true` | Enable Ctrl+Enter shortcut |
| `liveCounts` | boolean | `true` | Show live line/dupe counts |

---

## 5. Firebase / Firestore

### 5.1 Project Details

| Setting | Value |
|---|---|
| Project ID | `listdiff-171b5` |
| Firestore Collection | `audit_logs` |
| Region | (configured during setup) |

### 5.2 Security Rules

These rules should be set in the Firebase Console under **Firestore → Rules**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Audit logs: anyone can create, only admin can read/update/delete
    match /audit_logs/{logId} {
      allow create: if true;
      allow read, update, delete: if false;
    }
    // Deny everything else
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### 5.3 Audit Log Document Schema

Each document in `audit_logs` has this structure:

```json
{
  "action": "compare",
  "timestamp": "2026-04-04T12:00:00.000Z",
  "serverTimestamp": "<Firestore server timestamp>",
  "inputSizeA": 150,
  "inputSizeB": 200,
  "options": {
    "caseSensitive": true,
    "ignoreBeginEndSpaces": true,
    "ignoreExtraSpaces": true,
    "ignoreLeadingZeroes": false,
    "lineNumbered": false,
    "sortOption": "none",
    "caseTransform": "none"
  },
  "resultCounts": {
    "aOnly": 42,
    "bOnly": 18,
    "intersection": 108,
    "union": 168
  },
  "inputSampleA": ["item1", "item2", "...up to 100 items"],
  "inputSampleB": ["item1", "item2", "...up to 100 items"],
  "dataTruncated": true,
  "truncationDetails": {
    "listATruncated": true,
    "listBTruncated": false,
    "originalSizeA": 5000,
    "originalSizeB": 200,
    "storedSizeA": 100,
    "storedSizeB": 200,
    "itemsLengthCappedA": 3,
    "itemsLengthCappedB": 0
  },
  "clientInfo": {
    "userAgent": "Mozilla/5.0...",
    "screenWidth": 1920,
    "screenHeight": 1080,
    "viewportWidth": 1400,
    "viewportHeight": 900,
    "language": "en-US",
    "platform": "Linux x86_64",
    "timezone": "Asia/Kolkata",
    "referrer": "https://google.com",
    "colorScheme": "dark",
    "connectionType": "4g",
    "deviceMemory": 8,
    "hardwareConcurrency": 8
  }
}
```

---

## 6. Design System

### 6.1 Colors

| Token | Light | Dark |
|---|---|---|
| Background | `#F8FAFC` | `#0F172A` |
| Surface | `#FFFFFF` | `#1E293B` |
| Text Primary | `#0F172A` | `#F1F5F9` |
| Text Secondary | `#475569` | `#CBD5E1` |
| Accent | `#3B82F6` | `#38BDF8` |
| A Only | Blue tint | Blue tint (dark) |
| B Only | Amber tint | Amber tint (dark) |
| Intersection | Green tint | Green tint (dark) |
| Union | Purple tint | Purple tint (dark) |

### 6.2 Typography

- **Font**: Inter (Google Fonts), system-ui fallback
- **Monospace** (textareas): SFMono-Regular, Consolas, Liberation Mono

### 6.3 Spacing

4px base scale: 4, 8, 12, 16, 20, 24, 32, 40, 48

### 6.4 Animations

| Animation | Where | Duration |
|---|---|---|
| Pop-in | Count badges on results | 400ms |
| Fade + slide up | Results section appearing | 400ms |
| Knob bounce | Theme toggle on click | 500ms |
| Icon spin | Theme toggle sun/moon | 500ms |
| Slide in/out | Toast notifications | 200ms |
| Scale down | Button active state | 150ms |

---

## 7. Security Measures

| Measure | Implementation |
|---|---|
| **Input Sanitization** | `escapeHtml()` function prevents XSS |
| **No eval()** | Never used anywhere in the codebase |
| **No innerHTML** | DOM manipulation uses `textContent` and `value` |
| **Firebase Rules** | Firestore allows only `create`, denies `read/update/delete` |
| **Client-side rate limiting** | Throttles analytics writes to prevent flooding |
| **Subresource Integrity** | Firebase SDK loaded from official Google CDN |

---

## 8. Test Coverage

### 8.1 Test Files

| File | Tests | Coverage Target |
|---|---|---|
| `comparator.test.js` | ~47 | 100% |
| `utils.test.js` | ~49 | 100% |
| `rate-limiter.test.js` | ~8 | 95%+ |
| `analytics.test.js` | ~11 | 90%+ |

### 8.2 Running Tests

```bash
npm test          # Run all tests once
npm run test:watch  # Watch mode (re-run on changes)
```

---

## 9. Deployment

### 9.1 GitHub Actions Pipeline

```
Push to main → Run tests → Upload artifact → Deploy to GitHub Pages
```

### 9.2 Steps

1. Push code to the `main` branch of `github.com/<user>/listdiff`
2. GitHub Actions automatically:
   - Checks out code
   - Installs dependencies (vitest)
   - Runs test suite
   - If tests pass, deploys to GitHub Pages
3. Site is live at `jadia.dev/listdiff`

### 9.3 GitHub Repository Settings

- **Settings → Pages → Source**: Set to "GitHub Actions"
- **Custom Domain**: `jadia.dev` (configured at DNS level)

---

## 10. Known Limitations

| Limitation | Workaround |
|---|---|
| **No file upload** | Users can paste file contents manually |
| **Client-side rate limiting is bypassable** | Use Firestore rules for additional protection if needed |
| **Import maps not supported in older browsers** | Targets modern browsers (Chrome 89+, Firefox 108+, Safari 16.4+) |
| **No server-side processing** | Large lists may be slow on low-powered devices |
| **Shallow config freeze** | Nested config objects are technically mutable (not an issue in practice) |

---

## 11. Prompt for AI Assistants

If another AI/LLM continues work on this project, here is the context:

> This is a **vanilla HTML/CSS/JS** static website deployed to **GitHub Pages** at `jadia.dev/listdiff`. It compares two lists of text and shows their differences. All business logic is in `js/comparator.js` (pure functions, fully tested). UI is in `js/ui.js`. Analytics are logged to **Firebase Firestore** (`listdiff-171b5` project). Config is in `config.json`. Tests use **vitest** (`npm test`). The code has extensive educational comments.
> 
> Key files to read first: `config.json`, `js/comparator.js`, `js/ui.js`, `js/app.js`.
