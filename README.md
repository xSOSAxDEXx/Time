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

### Dependencies added (step 6)

- `expo-file-system`: writes the backup and CSV files and opens the file
  picker for restore (it has one built in, so no separate document-picker
  package is needed).
- `expo-sharing`: opens the phone's share sheet to save or send those
  files.

Both are free Expo modules with no accounts or network use (the same ones
Luna Beats uses). On the web neither is used: files download, and restore
uses the browser's file picker (`src/backup/fileIO.web.ts`).

## Backup, restore and export

Settings → Backup and export.

- **Back up** saves one JSON file (`clocked-backup-YYYY-MM-DD.json`) with
  every logged day and every setting, including company holidays and pay.
  On the phone it opens the share sheet; on the web it downloads.
- **Restore** opens a file, says what's in it, and asks before replacing
  the days on the device. It reads Clocked backups and the time card HTML
  page's data file (`timecard-data.json`) and Backup file. From the HTML
  page's files it takes the days, name, badge, primary location, required
  hours, lists and theme; holidays and pay settings stay as they are.
  Nothing in a file is trusted: days that can't be read are skipped and
  unreadable fields are left blank (`src/backup/format.ts`).
- **Export spreadsheet (CSV)** has the same columns as the HTML page's
  export, one row per day for every logged week, and opens in Excel.
  Company holidays counted automatically are included. Text that starts
  with `=`, `+`, `-` or `@` gets a leading apostrophe so spreadsheet
  programs don't run it as a formula.

## Clock-out reminder

Settings → Clock-out reminder (on by default). When you clock in, Clocked
works out your min clock-out time and reminds you then (or 5, 10 or 15
minutes early). It moves when start, break, remote or time off change, and
is cancelled when you clock out or clear the day. Clocked asks for
notification permission the first time you clock in with the reminder on,
after explaining why; "Not now" turns the reminder off.

- **Android app:** a local notification scheduled on the phone with
  `expo-notifications`. It arrives with the app closed and survives a
  restart of the phone. Android may deliver it a minute or two late to
  save battery. Nothing goes through a server; push notifications are not
  set up.
- **Web (and iPhone):** browsers can't reliably notify you once the page is
  closed, and the web app has no server to send one. So on the web the
  reminder only works **while Clocked is open in a tab**: a browser
  notification (if you allow it) at the reminder time, and a banner on the
  Week screen. On iPhone, Safari only allows notifications for web apps
  added to the Home Screen (iOS 16.4 and later); without that you get the
  banner only. Settings says this plainly.

### Dependency added (step 7)

- `expo-notifications` (the version Expo SDK 58 lists): schedules the
  clock-out reminder on the phone. Its config plugin sets the notification
  icon (`assets/brand/notification-icon.png`, made by `npm run icons`) and
  has remote (push) notifications turned off. It adds Android's
  notification and "run after restart" permissions. Free, no account, no
  network use. On the web it isn't used (`src/notifications/scheduler.web.ts`).

## Estimated pay

Set an hourly rate in Settings → Pay (blank hides pay everywhere). Clocked
then shows **Estimated pay** in the week footer, on each week in All weeks,
and in the chart range summary, always noted as before taxes and not an
official pay stub (`src/timecard/pay.ts`).

- Hours worked (on site + remote) are paid at the rate. Breaks aren't paid;
  a shift still in progress counts nothing until you clock out.
- Overtime is weekly (Monday–Sunday): None, over 40 hours at 1.5×, or a
  custom threshold and multiple. Only hours worked count toward it, and
  hours past the threshold are overtime in the order they were worked, so
  a month or custom range gives each day the same pay as its whole week.
- Time off is paid per type: Not paid, Regular or 1.5×. A type not listed
  (or none) is paid at the regular rate. Holidays counted automatically are
  Company Holiday time off.

## Money: take-home pay and bills

Settings → **Finance and bills** (needs an hourly rate in Pay). Enter your
taxes from a pay stub (federal, state, local, and Social Security +
Medicare, 7.65% filled in), each as a % of pay, $ per paycheck or $ per
month, paycheck deductions (401(k), health, dental,
HSA and so on: % of pay, $ per paycheck or $ per month, before or after
tax) and bills (weekly, monthly or yearly). The **Money** tab shows each
month's and the year's gross pay, take-home pay and what's left after bills
and gas, with a chart of every month.

How it's worked out (`src/timecard/money.ts`):

- Before-tax deductions lower the pay income tax is figured on; before-tax
  health ones also lower Social Security + Medicare. Retirement ones don't.
- Amounts per paycheck, week or year are spread evenly over the months. The
  current month (and the first month you logged anything) only gets its
  share of them, so bills aren't charged in full against a few days' pay.
- It's an estimate from flat percentages, not tax brackets or a pay stub.
  Copying the rates from a recent pay stub (tax ÷ gross) gets it closest.

## Driving: miles and gas

Settings → **Driving**: your car's MPG, the gas price, and a mileage
reimbursement rate (your employer's, or the IRS business rate). Add the
miles between two places once as a **route**. Each day can have drives:
arrive and leave adds one when you answer its "Log the drive?" question,
and the day editor (**Drives**) adds them by hand. Typing the miles for a
drive with no route saves the route for next time. The Money tab totals
miles, gas and reimbursement by month and year; gas comes off "left over".
Drives and routes are in backups. The CSV export keeps the time card page's
columns.

## Arrive and leave (Android)

Settings → Arrive and leave (off by default). Give each place in your
Locations list a circle ("Set to where I am now", 100–500 m). Android then
wakes Clocked when you arrive at or leave one, even with the app closed,
and Clocked **asks**: it never logs anything on its own.

For a big site, use **Outline** instead: in Google Maps, press and hold on
each corner to drop a pin, tap its coordinates to copy them, and paste them
into Clocked (several at once is fine; a Google Maps link or the
`<coordinates>` of a Google My Maps KML file work too), or stand at each
corner and tap **Add a corner where I am**. Android can only watch circles,
so Clocked registers the smallest circle covering the outline plus 30 m and
draws both so a wrong corner stands out. **Check where I am** says whether
you're inside each place right now. There's no map inside the app: that
would need a Google Cloud account with billing and an API key. The maths is
in `src/geofence/outline.ts`.

| What happened                           | Question                                                                  |
| --------------------------------------- | ------------------------------------------------------------------------- |
| Arrived, nothing started today          | Clock in? (at the arrival time)                                           |
| Left while clocked in, gone over 5 min  | Clock out? (at the time you left) / On a break                            |
| Back at the same place after over 5 min | Were you on a break? (logs the time away, or adds it to your usual break) |
| Arrived at a different place            | Log the drive as time worked? (Travel = Yes) / Log as break               |
| Away 5 minutes or less                  | Nothing                                                                   |

Questions come as notifications with answer buttons and as cards on the
Week screen; answering one clears both. A return is asked about once you've
been back 3 minutes: near the edge of a circle the phone can briefly think
you're inside, and leaving again that soon carries on the same trip, with
the answers you already gave.

When you have a usual break set (Settings → Work day) and no break is
logged yet, "Were you on a break?" has a third answer that logs the time
away **on top of** the usual break, for an extra break. "Log break" alone
replaces the usual break with the time away. The pure rules are in
`src/geofence/engine.ts`; the background task is `src/geofence/task.ts`.

Limits, honestly:

- Android only. Browsers can't watch your location with the page closed,
  so the web app (and iPhone) don't have it.
- Needs location access **"Allow all the time"** and notifications.
- Android can take a few minutes to notice arriving or leaving, and some
  phones delay it further to save battery (turn off battery optimization
  for Clocked if questions don't come). Circles under about 150 m can be
  missed.
- Breaks taken without leaving the circle can't be detected.
- Android forgets the circles when the phone restarts. Clocked registers
  them again whenever it opens, so open it once after a restart.
- Your location stays on the phone. Only the circles are saved, and they're
  in backups; no location history is kept.
- If Clocked is ever published on the Play Store, background location needs
  Google's extra review. Sharing the APK from GitHub doesn't.

### Dependencies added (arrive and leave)

- `expo-location`: location permission, "where am I now" and the
  geofences. Its config plugin adds Android's background location
  permission (no foreground service, nothing for iOS).
- `expo-task-manager`: runs Clocked's code when Android reports arriving or
  leaving with the app closed.

Both are free Expo modules (the versions Expo SDK 58 lists), with no
account and no network use.

## Android test build

`.github/workflows/android-preview.yml` builds an installable test APK on
GitHub Actions (Actions tab → **Android preview build** → Run workflow) and
publishes it as a pre-release. Open the release on your phone, tap the
`.apk` under Assets, and install it (allow installs from your browser if
asked). [docs/android-testing.md](docs/android-testing.md) lists what to
try on the phone, and on an iPhone with the web app.

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
src/timecard/     Entry type, date helpers, spreadsheet formulas, holiday rules, charts, CSV
src/store/        Persisted entries and settings
src/backup/       Backup file format, restore, file save/pick (phone and web)
src/notifications/ Clock-out reminder: when it fires, phone and web schedulers
src/geofence/     Arrive and leave: prompts, Android geofences, background task
src/hooks/        Small shared hooks
src/theme/        Colours, type, spacing
src/pwa/          Service worker registration (web only)
assets/brand/     Logo artwork and generated icons
public/           Web manifest, service worker, index.html, PWA icons
scripts/          Icon generator, web post-export step
docs/             Progress notes
```
