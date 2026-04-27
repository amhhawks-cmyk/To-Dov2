# My Lists

A clean, customizable to-do list built as a Progressive Web App. Works offline, installs to your phone's home screen, and stores everything locally — no account, no cloud, no tracking.

![JavaScript](https://img.shields.io/badge/JavaScript-74%25-yellow) ![CSS](https://img.shields.io/badge/CSS-23%25-blueviolet) ![PWA](https://img.shields.io/badge/PWA-installable-brightgreen) ![License](https://img.shields.io/badge/license-MIT-blue)

## What it does

- **Categorize tasks** into Work, Finance, Personal, Shopping List, or any custom category you create
- **Time-frame tasks** as Today, This Week, or This Month — items roll over automatically when their window closes
- **Swipe gestures** on mobile: swipe right to complete, swipe left to delete
- **Tap to edit** any task title, category, or timeframe
- **Undo deletes** within 5 seconds via the snackbar
- **Search and filter** within any category
- **Light and dark mode**, plus six accent color presets
- **Local daily reminders** via browser notifications (fires when the app is open)
- **Installs as a PWA** — works fully offline after first load

## Why it exists

I wanted a to-do app that was just *mine* — no signup, no syncing to a server I don't control, no feature creep. And I wanted to see how far you can get building a usable app with vanilla JavaScript and AI assistance, no build tools or framework dependencies.

The whole app is one HTML file, one CSS file, and one JS file. Total source: roughly 35 KB.

## Try it

Live demo: [GitHub Pages deployment](https://amhhawks-cmyk.github.io/To-Dov2/)

To install on your phone:
1. Open the live demo in your mobile browser
2. iPhone: tap Share → Add to Home Screen. Android: tap the install prompt or browser menu → Install app

## Tech stack

- **Vanilla JavaScript** — no React, no Vue, no build step
- **CSS variables** for theming
- **localStorage** for persistence
- **Service Worker** for offline caching
- **Web App Manifest** for installability
- **Notifications API** for local reminders

## Development

There's no build step. Clone the repo and open `index.html` in a browser, or serve the folder with any static server:

```bash
# Python 3
python3 -m http.server 8000

# Node
npx serve .
```

Then visit `http://localhost:8000`.

### File layout

```
├── index.html           # App shell, mounts #app
├── app.js               # All app logic (~700 lines, single file by design)
├── styles.css           # Theme variables, layout, components
├── sw.js                # Service worker for offline caching
├── manifest.webmanifest # PWA manifest
└── icons/               # PWA icons (192, 512, 180 apple-touch)
```

### Keyboard shortcuts (desktop)

- `n` — open new-task composer
- `/` — focus search (when on a category page)
- `Esc` — close any open sheet
- `Enter` — add or save (in any input)

## Built with AI assistance

The first version of this app was generated with AI from a design brief. Subsequent iterations used AI for code review and incremental improvements — fixing bugs, adding features, tightening UX. The AI suggested changes; I reviewed and decided what to ship.

This README itself is part of v3, alongside edit-task, undo, dark mode, and keyboard shortcuts.

## Roadmap

Things I might add next:
- Drag-to-reorder tasks within a category
- Recurring tasks (daily, weekly)
- Export/import as JSON for backups
- A real backend for cross-device sync (optional)

## License

MIT
