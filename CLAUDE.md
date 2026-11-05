# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Punch'd — project brief

Standing context for the `Time` repo (https://github.com/xSOSAxDEXx/Time).
Read this with `docs/PROGRESS.md` at the start of every session.
`docs/architecture.md` has the full code map and diagrams;
`docs/user-guide.md` uses the app's exact UI wording, so keep it in step.

## 0. Working in this repo

### Commands

```bash
npm run check          # typecheck + lint + prettier --check + jest; must pass before every commit
npx jest src/backup/__tests__/places.test.ts   # one test file
npx jest -t 'imports places'                   # tests by name
npm run format         # prettier --write .
npm run web            # dev server (web); npm run android for a device
npm run build:web      # expo export + scripts/postexport-web.mjs → dist/
npm run icons          # regenerate every icon from assets/brand/logo-source.jpg
```

- CI sets `EXPO_PUBLIC_REVISION` before the tests, so a test must not
  expect "Revision dev". Run `EXPO_PUBLIC_REVISION=1 npm run check` to test
  as CI does.
- Both workflows (`android-preview.yml` → an APK pre-release
  `android-preview-N`, `web-pages.yml` → GitHub Pages under `/Time`) run
  only when started by hand: `gh api -X POST
  repos/xSOSAxDEXx/Time/actions/workflows/<file>.yml/dispatches -f
  ref=main`. Starting one again cancels the run already going.
- After a change: check, commit, push to `main`, update
  `docs/PROGRESS.md`, start both builds, and summarise for the owner.

### Things that span several files

- **Startup order:** `index.ts` (package.json `main`) imports
  `src/geofence/task` **before** `expo-router/entry`. Android starts the
  app headless for arrive and leave, with no screen, so the background
  task must be defined there and not in a layout. Don't move it.
- **Pure logic vs UI:** formulas live in pure, tested modules, mainly
  `src/timecard/*` (calc, pay, money, breaks, holidays, csv),
  `src/geofence/engine.ts` (the arrive-and-leave state machine),
  `src/geofence/outline.ts`, and `src/backup/format.ts` / `places.ts`.
  Screens and components call them; side effects live in `handle.ts`,
  `native.ts` and `backup.ts`.
- **Web twins:** `*.web.ts(x)` replace native modules on the web
  (`fileIO`, `geofence/native` and `task`, `notifications/scheduler`, the
  date, time and select fields, service worker registration).
  Arrive and leave is Android only.
- **Adding a setting or day field:** add the type and default
  (`store/settings.ts` or `timecard/types.ts` plus `isEmptyEntry`), a
  reader in `backup/format.ts` (nothing in a file is trusted; bad values
  are skipped), and the UI. Persisted stores merge in defaults for keys
  added later, so no migration is needed.
- **Internal "clocked" names** (storage keys `clocked-*`, task
  `clocked-geofence`, backup format `clocked-backup`, package
  `com.clocked.app`) must not be renamed. Installed copies depend on them
  (see §4).
- **Revision label:** `src/revision.ts` reads the `EXPO_PUBLIC_*`
  variables the workflows set. They're inlined when the app is bundled.
- **Tests:** `jest.setup.ts` mocks the native modules (location, task
  manager, notifications, file system with `__setNextPick`, sharing).
  Screen tests render routes with `expo-router/testing-library`. Use
  made-up data only.

---

## 1. What we're building

**Punch'd** (named Clocked until 3 Nov 2026) is a simple personal time card
for hourly and salaried workers who track their own hours. You log when you
start and stop, breaks, remote work and time off, and the app tells you how
many hours you've worked, the earliest time you can leave and still meet your
daily hours, and how your week is going.

It started as a single HTML page built from the owner's Excel time card.
Punch'd turns that page into a real app: **Android app + installable
website (PWA)** from one codebase, the same way the owner's other app,
**Luna Beats** (https://github.com/xSOSAxDEXx/Luna), was built.

Core promise: **clock in, clock out, know where you stand.** Logging a
normal day should take two taps.

## 2. Tech stack (match Luna Beats)

Mirror Luna's stack, config and conventions wherever they apply:

- **React Native + Expo SDK 58 + TypeScript**, **Expo Router** (`src/app/`)
- **Web version** from the same codebase (Expo web, single-page export),
  installable as a **PWA** with a service worker that opens offline
- **Local-first data**: no account, no server, no analytics. Everything is
  stored on the device. **Backup/restore** via one JSON file (share sheet on
  the phone, download on the web), like Luna.
- **State:** Zustand, persisted with AsyncStorage
- **Charts:** drawn with `react-native-svg` (already used by Luna). No chart
  library.
- **Notifications:** `expo-notifications` for the clock-out reminder (new
  dependency, only on native; see 3.8)
- **Location:** `expo-location` + `expo-task-manager` for arrive and leave
  (Android only; see 3.11)
- **Lint/format/test:** ESLint (Expo config) + Prettier, Jest (`jest-expo`) +
  React Native Testing Library, `npm run check` before every commit
- **CI:** the same two GitHub Actions workflows as Luna:
  - Android preview build → installable APK published as a pre-release
  - Web app → GitHub Pages at https://xsosaxdexx.github.io/Time/
- **iPhone:** no Apple Developer account. iPhone users use the web app
  (Add to Home Screen). Don't add native iOS work without asking.

## 3. Features (v1)

v1 must do everything the HTML page does (3.1–3.7), plus two new features
(3.8–3.9).

### 3.1 Logging a day

Fields for each date:

| Field                | Unit / type                                    |
| -------------------- | ---------------------------------------------- |
| Start shift          | time                                           |
| End shift            | time                                           |
| Break                | minutes in the UI (stored as hours)            |
| Remote / outside     | hours                                          |
| Time off             | hours                                          |
| Time off type        | from the settings list (PTO, Floating, ...)    |
| Travel               | Yes / No / blank                               |
| Location             | from the settings list                         |
| Comment              | free text, any length                          |

- Big **Clock in now** / **Clock out now** buttons for today. If a time is
  already set, ask before replacing it.
- Every field can also be edited by hand for any date.
- **Break times** (owner request, 4 Nov 2026): a day can list when each
  break was (11:30 AM – 11:54 AM). Adding one adds its length to Break;
  removing it takes it off. Arrive and leave logs the time away this way.
  A new break starts filled in with the usual break's time.

### 3.2 Calculations (must match the spreadsheet exactly)

These came from the owner's Excel formulas. Keep them in pure functions
(`src/timecard/calc.ts`) with unit tests:

- **Total worked** = (End − Start) + Remote + Time off − Break.
  With no start/end, total = Remote + Time off.
- **Overnight shifts** (owner-approved change): an end time earlier than
  the start is the next morning. The shift counts on the day it started,
  and min clock out can fall on the next day.
- **Shift in progress** (start, no end yet): the break isn't subtracted
  until the shift ends, so a day never shows a negative total.
- **Min clock out** = Start + Required hours − Time off − Remote + Break.
  Shown only when Start is set. Green once End ≥ Min clock out.
- **Days worked (week)** = Monday–Friday days with total > 0.01.
- **Week hours** = sum of all positive day totals, Monday–Sunday.
- **Avg hours worked WTD** = week hours ÷ days worked.
- **Full week** = more than 4 days worked.
- **Avg hours per week YTD** = average week hours over full weeks only.
- **Avg hours per day YTD** = avg hours per week YTD ÷ 5.
- Weeks run **Monday to Sunday**.
- Required hours per day comes from Settings (default 8).

Owner-approved additions (formula review, 2 Nov 2026):

- **Usual break** (Settings, minutes, default off): while clocked in with
  no break logged yet, min clock out adds the usual break. It **starts at**
  a set time (default 12:00 PM, owner request 4 Nov 2026), so it runs from
  then for its length, e.g. 12:00 – 12:30 PM; "Log + usual break" logs it
  at that time.
- **Hours so far** and **time left** to min clock out while clocked in.
- **Odd-day checks**: a time off type with no hours, hours with no type,
  still clocked in from before yesterday, a shift over 16 hours, a break
  as long as the shift. Shown as a ⚠ line, never blocking.
- **Worked-only average**: avg hours/week also shown without paid time off.
- **Short weeks**: the Summary says how many weeks this year have fewer
  than 5 days (and so are left out of the averages).
- Weekend days still don't count as days worked (owner declined changing
  it).

### 3.3 Week view (home screen)

- One week at a time: Previous / This week / Next / pick a date.
- **Phone:** a list of seven day rows (Mon–Sun) showing in/out, total and
  min clock out; tap a day to edit it. Today is highlighted.
- **Wide screens (web on a computer):** a full table like the HTML page,
  editable in place, with no sideways scrolling.
- Week footer: total hours, days worked, avg hours worked WTD.
- Long comments: show the full text on tap (phone) or hover (web).

### 3.4 Summaries

- Stat cards: avg hours/week YTD (with number of full weeks), avg
  hours/day YTD, avg hours worked/week (no paid time off), this week's
  hours vs. the weekly target, today's min clock out (with hours so far),
  total hours logged this year.
- **All weeks** list: week of, days worked, hours, avg/day, time off,
  status (current / full week / partial). Tap a week to open it.

### 3.5 Charts

- **Hours per day:** stacked columns (on site / remote-outside / time off)
  with a dashed line at the required daily hours.
- **Hours per week:** one column per week with a dashed line at the weekly
  target (required hours × 5).
- Date range: This week (default), Last week, Last 4 weeks, This month,
  Last month, All time, Custom from/to.
- Range summary: total hours, days worked, avg/day, time off.
- Tap (phone) or hover (web) a column for its breakdown.
- Follow the chart rules the HTML used: thin columns (max 24 px), 4 px
  rounded tops, 2 px gap between stacked parts, legend always shown,
  colours that work in light and dark mode.

### 3.6 Settings

- Name, badge number, primary location (all optional, blank by default)
- Required working hours per day (default 8), usual break (default off)
- Locations list and time off types list (editable)
- Company holidays (3.10)
- Theme: match system (default) / light / dark
- Clock-out reminder settings (3.8) and pay settings (3.9)

### 3.7 Data, backup and export

- All data stays on the device. The web version must say that clearing
  browser data deletes it, and suggest backups.
- **Backup:** one JSON file with settings and all entries.
- **Restore:** load a backup; ask before replacing what's on the device.
  Unreadable parts of a file are skipped, not trusted.
- **Export CSV:** opens in Excel; same columns as the HTML export.
- **The app starts empty.** No sample or personal data ships with it.
- **Restore also reads the time card HTML page's files**: its data file
  (`timecard-data.json`) and its Backup file. This is how the owner moves
  their own history into the app, on their own device. Their data is never
  bundled, committed or loaded for anyone else.

### 3.8 Clock-out reminder (new)

- When you clock in, schedule a local notification for your **min clock
  out** time: "You've hit your 8 hours. You can clock out."
- Reschedule when start, break, remote or time off changes; cancel on
  clock out or when the day is cleared.
- Settings: on/off (default on), and optionally remind a few minutes early
  (off / 5 / 10 / 15 min).
- Ask for notification permission only the first time it's needed, with a
  short explanation.
- **Native (Android):** `expo-notifications` local notifications; works
  with the app closed.
- **Web:** browsers can't reliably notify when the page is closed. Show the
  reminder only while the app is open (and an in-app banner), and say so
  plainly in Settings. Document the real limits in the README.

### 3.9 Pay calculator (new)

- Settings: hourly rate (blank = pay hidden everywhere), overtime rule.
- Overtime rule options: **None**, **Over 40 hours a week at 1.5×**
  (default when a rate is set), custom threshold and multiplier.
- **Time off pay per type** (owner request): **Not paid**, **Regular pay**
  or **1.5× pay**. Defaults: PTO, Floating and Company Holiday at regular
  pay; Unpaid not paid.
- Only **hours worked** (on site + remote) count toward the overtime
  threshold.
- Show estimated pay in the week footer, the All weeks list, and the chart
  range summary.
- Always labelled **"Estimated pay"**, with a note that it's before taxes
  and not an official pay stub.

### 3.10 Company holidays (owner request)

- Holidays are saved as **rules that repeat every year** (a fixed date, or
  e.g. "4th Thursday of November", "the day after"), so they're never
  re-entered. Fixed dates on a weekend move to the Friday before / Monday
  after.
- The standard list is the owner's company holidays: New Year's Day,
  Memorial Day, Independence Day, Labor Day, Thanksgiving and the day
  after, Christmas Day. Settings → Company holidays can add, remove or
  reset them.
- **Counted automatically** (on by default): a holiday with nothing logged
  counts as a full day (required hours) of Company Holiday time off, from
  the first day the person logged anything. Changing anything on that day
  keeps the holiday time off; the day editor can leave a holiday out for
  one year ("Don't count it this time").

### 3.11 Arrive and leave (owner request, 2 Nov 2026)

Geofencing, **Android only** (browsers can't watch location with the page
closed; iPhone uses the web app). Off by default.

- Each place in the Locations list can have a **circle** (set to where the
  phone is now; 100 / 150 / 250 / 500 m), or for a big site an **outline**
  (owner request, 3 Nov 2026): corners pasted from Google Maps (dropped
  pins' coordinates, a link, or a My Maps KML) or added while standing at
  each corner. Android only watches circles, so Punch'd registers the
  smallest circle covering the outline plus 30 m. No map in the app (that
  would need a Google Cloud account and API key).
- The circles are registered again every time the app starts (Android
  forgets them when the phone restarts).
- **Ask first, never log on its own.** Questions come as notifications with
  answer buttons, and as cards on the Week screen.
- Arrive with nothing started today: **"Clock in?"** (logs the arrival
  time, and the place as Location if none is set).
- Leave while clocked in: after 5 minutes away, **"Clock out?"** (logs the
  time you left), or "On a break".
- Away **5 minutes or less**: ignored.
- Back at the **same place** after more than 5 minutes: **"Were you on a
  break?"** (logs the time away as break, or "I was working"). With a usual
  break set and no break logged, a third answer adds the time away **on top
  of** the usual break (owner request, after the first phone test).
- A return counts once you've been back 3 minutes; leaving again sooner is
  a GPS blip at the circle's edge and the same trip carries on (no second
  "Clock out?").
- Arrive at a **different place**: **"Log the drive as time worked?"**
  (marks Travel = Yes and counts it, or logs it as break).
- If you said yes to "Clock out?" and come back, it offers to undo the
  clock out.
- A time that's already set is never overwritten. Location stays on the
  phone; only the circles are saved (and included in backups). No location
  history.
- **Share places** (owner request, 4 Nov 2026): a file with just the
  places (names, circles, outlines), so coworkers can use the same fences.
  **Import places** adds a file's places without touching logged days or
  other settings; places already set differently are kept unless the
  person chooses to replace them.
- Needs location access "all the time" and notifications. Uses
  `expo-location` and `expo-task-manager`.

### 3.12 Finance and bills (owner request, 3 Nov 2026)

Settings → Finance and bills, and a **Money** tab. Needs an hourly rate.

- How often you're paid (weekly / every 2 weeks / twice a month / monthly).
- **Taxes** from a pay stub: federal, state, local, and Social Security +
  Medicare (7.65% filled in). Each is a % of pay, $ per paycheck or $ per
  month (owner request, 3 Nov 2026); no tax brackets.
- **Paycheck deductions** (401(k), Roth 401(k), health, dental, vision, HSA,
  other): % of pay, $ per paycheck or $ per month, before or after tax.
  Before-tax lowers income tax; before-tax health ones also lower Social
  Security + Medicare, retirement ones don't.
- **Bills** (rent, car, phone, ...): weekly, monthly or yearly.
- **Spouse or partner** (owner request, 3 Nov 2026): their take-home pay
  per paycheck (and how often they're paid) and their bills. A switch
  includes them in the Money tab: their take-home is added and their bills
  taken off "left over". Turning it off keeps what was entered.
- Three levels per month and year: **gross → take-home → left over**
  (after bills and gas). Chart of each month's gross pay split into taxes,
  deductions, bills and gas, and left over; plus figures for this month
  and this year.
- Fixed amounts are spread evenly over the year; a month only partly
  counted (before the first logged day, or the current month) gets that
  share. Always labelled as estimates, not a pay stub or tax advice.

### 3.13 Driving (owner request, 3 Nov 2026)

- A day can have **drives** (from place → to place). Arrive and leave adds
  one when the drive question is answered "Count as worked" or "Log as
  break"; the day editor can add them by hand (web and iPhone too).
- **Routes**: the miles between two places, entered once (either way
  round). Typing miles for a drive with no route saves the route; a
  different number on a known route counts for that drive only.
- Settings → Driving: MPG, gas price, and a reimbursement rate per mile.
  Gas comes off "left over"; reimbursement is shown on its own (not every
  employer pays it).
- **Daily commute** (owner request, 3 Nov 2026): miles to work and back,
  counted for gas on each day with a start time (owner-approved change, 4
  Nov 2026: was 5 days a week); remote days, time off and holidays don't
  count. Not reimbursed.
- Money tab: miles, drives, gas and reimbursement for the month and year.
  Drives and routes are in backups; the CSV keeps the HTML page's columns.

## 4. Design

A clean, calm work tool. It should feel quick and trustworthy, like the
HTML page.

- **Light theme by default, dark theme too** (match system). Carry over the
  HTML page's look: soft grey background, white cards, one blue accent,
  green for "target met", amber for "not yet".
- Big tap targets (min 48 px), thumb-reachable clock in/out buttons on the
  phone.
- System font is fine; numbers use tabular figures so columns line up.
- Times shown in 12-hour format (8:05 AM); hours shown to 2 decimals.
- Accessibility: screen-reader labels on every control, respects dynamic
  type and reduced motion; never colour alone (green/amber also get a word
  or icon).

### Logo & name

- Name: **Punch'd** (owner request, 3 Nov 2026; was Clocked). The app's
  internal IDs keep "clocked" so installed copies update in place and keep
  their data: Android package `com.clocked.app`, URL scheme, storage keys,
  background task and notification IDs, and the backup format
  (`clocked-backup`). Only what people see says Punch'd.
- **Revision number** (owner request, 4 Nov 2026): the Week screen shows
  "Revision N" (commits on main, set by the GitHub workflows), and Settings
  shows the Android test build, build date and commit.
- Logo: **gold brass knuckles smashing a cracked alarm clock** on a blue
  starburst (the owner's artwork, `assets/brand/logo-source.jpg`). Every
  icon size comes from it, like Luna (`npm run icons`).

## 5. Suggested structure (mirror Luna)

```
src/app/            # Expo Router screens: (tabs)/index (week), summary, charts, money, settings; day/[date]
src/components/     # DayRow, DayEditor, WeekTable, StatCard, ColumnChart, RangePicker, ...
src/timecard/       # calc.ts (formulas), dates.ts (week helpers), pay.ts, money.ts, csv.ts
src/store/          # entries + settings (Zustand + AsyncStorage)
src/backup/         # backup format, export, restore
src/notifications/  # clock-out reminder (native + web)
src/geofence/       # arrive and leave: prompts, background task (Android)
src/theme/          # colours, typography, spacing
src/pwa/            # service worker registration
assets/brand/       # logo artwork + generated icons
public/             # manifest, service worker, index.html
docs/               # PROGRESS.md, android-testing.md, ...
```

## 6. Build order

1. **Scaffold**: Expo + TS + Router + web/PWA, theme tokens, logo and icons,
   lint/test, both GitHub workflows. Push to `main`.
2. **Data model + calculations** (pure functions, tested) and the persisted
   store.
3. **Week view + day editor + clock in/out.**
4. **Summaries, All weeks and Settings.**
5. **Charts.**
6. **Backup/restore and CSV export** (restore also reads the HTML page's
   data and backup files).
7. **Clock-out reminder.**
8. **Pay calculator**, then **arrive and leave** (geofencing, Android;
   §3.11, owner request).
9. **Polish, accessibility pass, device testing** (Android APK + iPhone
   web).

After each step: run `npm run check`, commit with a clear message, push,
and give the owner a short summary of what changed and anything that needs
their decision. Keep `docs/PROGRESS.md` up to date.

## 7. Ground rules

- **No personal data in the repo**: not in code, tests, fixtures, docs or
  screenshots. Tests use made-up entries.
- Ask before adding paid services, analytics, ads or accounts. v1 collects
  no personal data.
- Keep dependencies minimal; explain any new one in the README.
- Don't invent features beyond this doc without asking. Suggest them
  instead.
- When structure or conventions are unclear, mirror Luna Beats; if Luna
  doesn't answer it, ask.
- Give all times to the owner in US Eastern time (`America/New_York`).
