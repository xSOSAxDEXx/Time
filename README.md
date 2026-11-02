# Clocked

Your personal time card. Clock in, clock out, know where you stand.

One codebase ships the Android app and an installable website (PWA) that
iPhone users add to their home screen. Everything stays on the device: no
account, no analytics, no personal data. The full product brief and build
order live in [`CLAUDE.md`](./CLAUDE.md); progress and decisions are in
[`docs/PROGRESS.md`](./docs/PROGRESS.md).

## Getting started

```bash
npm install
npm run web        # in the browser
npm run android    # Expo Go or a development build
```

## Scripts

| Command                           | What it does                                                                   |
| --------------------------------- | ------------------------------------------------------------------------------ |
| `npm run check`                   | Typecheck, lint, format check and tests (run before every commit)              |
| `npm test`                        | Jest + React Native Testing Library                                            |
| `npm run lint` / `npm run format` | ESLint (Expo config) / Prettier                                                |
| `npm run build:web`               | Export the website/PWA to `dist/`                                              |
| `npm run icons`                   | Render every app icon, splash and PWA icon from `assets/brand/logo-source.jpg` |

Generated icons are committed, so normal builds never run `npm run icons`.

## Stack

Same as Luna Beats:

- **Expo SDK 58**, React Native, TypeScript, Expo Router (`src/app/`)
- **Web/PWA:** single-page export, `public/manifest.webmanifest`, and a
  service worker (`public/sw.js`) that makes the installed app open offline
- **Theme:** `src/theme/` holds the light and dark palettes (carried over
  from the time card HTML page), type and spacing. Tests check text
  contrast in both.
- **State:** Zustand, persisted on-device with AsyncStorage:
  `src/store/entries.ts` (every logged day) and `src/store/settings.ts`
- **Calculations:** `src/timecard/calc.ts` holds the spreadsheet formulas
  as pure functions (total worked, min clock out, week and year-to-date
  figures), tested in `src/timecard/__tests__/`
- **Tests:** Jest (`jest-expo`) and React Native Testing Library

### Dependencies added (step 3)

- `@react-native-community/datetimepicker`: the phone's own time and date
  pickers on Android (the version Expo SDK 58 lists). On the web the
  browser's built-in time and date inputs are used instead
  (`TimeField.web.tsx`, `DateField.web.tsx`).

## Android test build

`.github/workflows/android-preview.yml` builds an installable test APK on
GitHub Actions (Actions tab → **Android preview build** → Run workflow) and
publishes it as a pre-release. Open the release on your phone, tap the
`.apk` under Assets, and install it (allow installs from your browser if
asked).

## Web app on GitHub Pages

`.github/workflows/web-pages.yml` publishes the installable web app to
**https://xsosaxdexx.github.io/Time/** (Actions tab → **Web app (GitHub
Pages)** → Run workflow). Pages is set to deploy from GitHub Actions.

The web build supports a sub-path: `EXPO_BASE_URL=/Time npm run build:web`.
The manifest and service worker use relative paths, and `404.html` lets
Pages serve the app for deep links.

On iPhone, open the site in Safari, tap Share → **Add to Home Screen**.

## Project layout

```
src/app/          Screens (Expo Router)
src/components/   Shared UI
src/timecard/     Entry type, date helpers, spreadsheet formulas, holiday rules
src/store/        Persisted entries and settings
src/hooks/        Small shared hooks
src/theme/        Colours, type, spacing
src/pwa/          Service worker registration (web only)
assets/brand/     Logo artwork and generated icons
public/           Web manifest, service worker, index.html, PWA icons
scripts/          Icon generator, web post-export step
docs/             Progress notes
```
