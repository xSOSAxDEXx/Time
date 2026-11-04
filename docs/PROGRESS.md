# Progress and handoff notes

Where the build is, what's been decided, and what's waiting. Read this with
`CLAUDE.md` (the brief) at the start of a new session.

_Last updated: 4 Nov 2026 (user guide and architecture doc)._

## Build order status (CLAUDE.md §6)

| Step                                     | Status                                                                             |
| ---------------------------------------- | ---------------------------------------------------------------------------------- |
| 1. Scaffold                              | ✅ Done. Web build checked in Chromium (phone + desktop sizes)                     |
| 2. Data model + calculations + store     | ✅ Done. Checked against the owner's spreadsheet totals (locally, not committed)   |
| 3. Week view + day editor + clock in/out | ✅ Done. Web checked in Chromium (phone list, desktop table, dark mode)            |
| 4. Summaries, All weeks, Settings        | ✅ Done. Holidays and pay settings added; web checked in Chromium                  |
| 5. Charts                                | ✅ Done. Web checked in Chromium (phone, desktop, dark mode)                       |
| 6. Backup/restore + CSV                  | ✅ Done. Web checked in Chromium; owner's HTML data imported locally, totals match |
| 7. Clock-out reminder                    | ✅ Done. Web checked in Chromium; Android reminder needs a phone                   |
| 8. Pay calculator                        | ✅ Done. Web checked in Chromium                                                   |
| 8a. Arrive and leave (geofencing)        | ✅ Done. Test build 2 has it; owner trying it on a phone                           |
| 9. Polish, accessibility, device testing | In progress. Web accessibility audit done; phone testing with the owner            |

## Owner decisions (don't re-ask)

- **Name:** Punch'd (3 Nov 2026; was Clocked). Internal IDs stay "clocked"
  (see CLAUDE.md §4) so the installed app updates in place.
- **Logo:** the owner's artwork, gold brass knuckles smashing an alarm
  clock (2 Nov 2026).
- **Starting point:** the owner's time card HTML page (Excel formulas
  carried over exactly, see CLAUDE.md §3.2).
- **Platforms and process:** same as Luna Beats: Android APK via GitHub
  Actions, web app on GitHub Pages, iPhone uses the web app.
- **GitHub Pages** is set to deploy from GitHub Actions (done by the owner).
- **New in v1:** clock-out reminder (§3.8) and pay calculator (§3.9).
- **The owner's HTML data:** Restore reads the HTML page's data file and
  backup file, so the owner can import their own history on their device.
  It is never bundled or committed; the app starts empty for everyone.
- **Times:** give all times to the owner in US Eastern time.
- **Company holidays** (§3.10): the owner's 2026 list became repeating
  rules and the standard list; counted automatically.
- **Arrive and leave** (§3.11, added before step 9): ask first; ignore
  absences of 5 minutes or less; ask about a break on return after longer;
  a circle per location; ask whether a drive between places counts as time
  worked.
- **Pay rates:** overtime None / 1.5× / custom; each time off type Not
  paid / Regular / 1.5× (§3.9). Estimates show from step 8.

## Defaults I chose (owner can change)

- Light theme by default (match system), blue accent like the HTML page.
- System font (no web fonts to download).
- App ID `com.clocked.app` (Android package and iOS bundle ID). This can't
  change once the app is on the Play Store, so confirm it before launch.
- Overtime default: over 40 hours a week at 1.5×; only worked hours count
  toward overtime; Unpaid time off pays nothing.
- Clock-out reminder on by default, at the min clock-out time.
- Week view switches to the full table at 1180 px wide and up (narrower, it
  would need sideways scrolling).
- **Year to date** covers the calendar year of today; a week belongs to the
  year its Monday is in (the spreadsheet kept one sheet per year).
- A day with a start but no end yet counts no shift time (only remote, time
  off and minus the break), same as the spreadsheet.
- **Overnight shifts** (owner asked for this): an end before the start is
  the next morning; the shift counts on the day it started. Just after
  midnight, "Clock out" closes last night's open shift.
- **Shift in progress:** the break isn't subtracted until there's an end
  time, so a day never shows a negative total (formula review).
- Default locations are generic (Main office, Remote, Client site, Vendor,
  Other); time off types are PTO, Floating, Company Holiday, Unpaid.
- Holidays count from the first day anything was logged, so they never
  add weeks from before you started using the app.
- Clocking in on a holiday keeps its 8 hours of holiday time off (change it
  in the day editor if it doesn't apply).
- **Charts:** the range resets to This week each time the app opens. Ranges
  over 14 days hide weekend days with nothing logged (like the HTML page).
  The week chart always shows whole weeks (Mon–Sun) for every week the
  range touches; the range summary counts only the dates picked.
- **Restore replaces** what's on the device (after asking), like the HTML
  page's restore; it doesn't merge. From the HTML page's files only the
  settings that page had are taken; holidays and pay stay as they are.
- **CSV** includes company holidays counted automatically, so its totals
  match the app; min clock out in the CSV leaves out the usual break.
- **Reminder permission:** asked on the Week screen the first time you clock
  in with the reminder on, with a short explanation. "Not now" turns the
  reminder off (Settings can turn it back on). If a min clock out is
  already past when it's set, no notification is scheduled.
- **Web reminder:** a banner on the Week screen once the reminder time
  passes while still clocked in, plus a browser notification if allowed.
- **Notification icon:** Android needs a plain white silhouette, so it's a
  simple alarm clock rather than the artwork.
- **Pay:** overtime is the hours past the weekly threshold in the order they
  were worked, so it lands on the last days of the week. Time off with no
  type, or a type not in the list, is paid at the regular rate. Amounts are
  in dollars. A shift still in progress counts no pay yet.
- **Arrive and leave:** off by default. Circles default to 150 m. Saying
  yes to "Clock out?" and then coming back offers to undo the clock out.
  "Count as worked" for a drive sets Travel = Yes. Questions older than 18
  hours are dropped. Circles go in backups; the pending questions don't.
- "Long shift" warning above 16 hours; "still clocked in" warning for a
  shift with no end from before yesterday.

## Formula review (2 Nov 2026)

The owner approved suggestions 1–4 and 6 and declined 5 (weekend days
counting as days worked). All are built; see CLAUDE.md §3.2 and §3.4.

## Step 9 so far

- `docs/android-testing.md`: the phone checklist (Android test build and
  iPhone web app), including a walk-through for arrive and leave.
- Automated browser audit (phone and computer widths, light and dark): every
  control has a name, text contrast meets WCAG AA, no sideways scrolling.
- Fixed: switches can be toggled by tapping anywhere on their row (the
  switch alone was 40×20 px); ‹ › buttons are now at least 48 px wide;
  keyboard focus shows a blue ring on the web (it was invisible); the
  computer table's min clock out reads its day and "met" / "short" to
  screen readers.
- Chart columns on a phone are as wide as the screen allows (40 px for a
  week), and the computer table keeps 40 px fields like the HTML page.

## Docs (4 Nov 2026, owner request)

- `docs/user-guide.md`: how to install and use every feature, for the
  owner and anyone they share the app with. Keep it in step with the UI's
  wording when features change.
- `docs/architecture.md`: layers, data, main flows (with Mermaid
  diagrams), build and release, decisions, where to change things.
- README links both.

## Break times (4 Nov 2026, owner request)

- Phone test: a break with the app closed was caught and logged.
- Each day can list its break times (`Entry.breaks`, `src/timecard/breaks.ts`):
  the day editor adds and removes them (adding adds the length to Break),
  the Week list shows "Break 11:30 AM – 11:54 AM", and arrive and leave's
  break answers log the time away as a break time.
- Settings → Usual break starts at (default 12:00 PM), shown once a usual
  break is set. New break times start filled in with it, and "Log + usual
  break" logs the usual break at that time. In backups; the CSV keeps the
  HTML page's columns (break minutes only).

## Code review follow-ups (4 Nov 2026)

- Daily commute now counts on each day with a start time instead of 5 days
  a week (owner approved), so vacation and remote days don't add gas.
- Money's Months table shows miles including the commute, and its screen
  reader label says "left over with {name}" when a partner is included.
- Pay schedule choices live in `settings.ts` (`PAY_SCHEDULES`), shared by
  Finance and Partner; Settings footer reads "Punch'd · Revision N · …".

## Revision number (4 Nov 2026, owner request)

- The Week screen shows "Revision N" under the name; the bottom of Settings
  shows the details (Android test build, build date, commit).
- N is the number of commits on main (`git rev-list --count HEAD`), set by
  both GitHub workflows as `EXPO_PUBLIC_*` variables (`src/revision.ts`).
  The Android app and web app built from the same code show the same N.
  Builds made elsewhere show "Revision dev".

## Arrive and leave with the app closed (4 Nov 2026, owner report)

- The owner left work twice with the app closed (location "all the time",
  battery unrestricted) and got no "Clock out?" or break question.
- Cause: the background task was defined from the root layout. When
  Android wakes a closed app for a geofence, no screen loads, so the task
  wasn't found and the event was dropped. It only worked while the app was
  still in memory.
- Fix: a new entry file, `index.ts` (package.json `main`), defines the task
  first, then starts Expo Router. A test checks the entry defines it.
- Phone test, 4 Nov 2026 (revision 24, test build 12): with the app
  closed, arriving at work brought "Clock in?" at the right time and
  answering it logged the clock in. Break and leaving checks still to come.

## Punch'd, partner and commute (3 Nov 2026, owner request)

- **Renamed Punch'd** everywhere people see it: app and home screen name,
  web title and manifest, screen text, backup and CSV file names
  (`punchd-backup-….json`, `punchd-….csv`), APK name (`punchd-preview-N`).
  Kept "clocked" inside (package `com.clocked.app`, storage keys, task and
  notification IDs, backup format), so the new build installs over the old
  one with data kept, and old backups still restore.
- **Settings → Spouse or partner**: take-home per paycheck, pay schedule and
  bills, with an "Include in Money" switch. Money adds their take-home and
  bills to "left over" (label "Left over with {name}"), shows their
  take-home as its own card and in each month's breakdown.
- **Daily commute** in Settings → Driving: miles to work and back, counted
  5 days a week for gas (not reimbursement). Money's miles card shows it.
- Bills editing moved to `BillsEditor`, shared by yours and the partner's.

## Managing places (3 Nov 2026, owner request)

- The owner couldn't find how to add or remove locations (Settings → Lists
  only removes by tapping a name, with no hint). Arrive and leave → Your
  places now has **Add a place** at the bottom and **Delete place** (with
  a confirm) on each card; both change the Locations list too. Lists now
  says "Tap a name to remove it".
- The owner's own place names stay on their phone; the app's starting list
  is unchanged.

## Dollar taxes and place outlines (3 Nov 2026, owner request)

- Each tax can be % of pay, $ per paycheck or $ per month, like the
  deductions. Switching between a % and dollars resets that tax to 0.
  Dollar taxes are spread by month the same way as fixed deductions.
- Arrive and leave didn't notice the owner arriving at work: the site is
  bigger than the circle. A place can now have an **outline** of corners
  pasted from Google Maps (or added by standing at each one); Android
  watches the smallest circle covering it plus 30 m. **Check where I am**
  shows whether the phone is inside each place.
- Also fixed: the circles weren't registered again after a phone restart
  (Android forgets them). They're now registered each time the app starts.
- Not done (needs the owner's OK): a map inside the app to draw on. It
  would need a Google Cloud account with billing and a Maps API key.
  Checking the exact outline (not just its circle) would need location
  tracking while near the site, which costs battery.

## Finance, bills and driving (3 Nov 2026, owner request)

Owner's choices: taxes as percentages; three levels (gross → take-home →
left over after bills); miles entered once per route; miles, gas and
reimbursement. See CLAUDE.md §3.12–3.13.

- New Money tab (5th tab), Settings → Finance and bills, Settings →
  Driving, and Drives in the day editor.
- Arrive and leave records a drive when its question is answered "Count as
  worked" or "Log as break".
- Decisions made along the way (change any if they're wrong):
  - Social Security + Medicare starts at 7.65%; the Social Security wage
    cap isn't applied.
  - Fixed deductions and bills are spread evenly by month; the current and
    first month count only their share of days.
  - Gas comes off "left over"; reimbursement is shown but not added to pay.
  - Money headline numbers are whole dollars; the per-month breakdown keeps
    cents.
  - The CSV export is unchanged (the time card page's columns). A separate
    mileage log export could be added if wanted.

## UI clean-up (2 Nov 2026)

Same treatment as the owner's Rep & Ration site:

- Week: ‹ › arrows either side of the dates; "Back to this week" only when
  away from it. A shift in progress shows its hours so far on the right
  (and in the computer table) with time left and min clock out on one line,
  not a 0.00 total beside a separate "so far" line.
- Day editor: "Hours so far" card while clocked in; break, remote and time
  off share one row.
- Settings: "Jump to" links at the top, a blue accent beside each section
  title, and the reminder and arrive-and-leave sections moved up next to
  Work day.
- Empty states: a card with an icon and a "Go to Week" button on Summary,
  and a note on Charts when a range has nothing logged.
- Web: date, time and list fields use the app's font (they were serif);
  hover outlines on day and week rows and buttons; a compact reminder
  banner. The computer table's columns share the width so nothing is cut
  off, and it now starts at 1180 px (narrower windows get the list).
- Sentence case for the computer table headers.

## First phone test (2 Nov 2026, test build 2)

The owner tried a break with arrive and leave. Break times were right.
Found and fixed:

- "Clock out?" kept coming back after answering "On a break". Likely cause:
  near a circle's edge the phone briefly thought they were back, then
  "left" again, starting a new trip. Now a return counts only after 3
  minutes back; leaving sooner carries on the same trip with its answers.
  Also: an answer tapped while the app was still loading its data could be
  undone by that load (fixed), and answering an out-of-date notification
  now clears it.
- Owner request: "Were you on a break?" can add the time away on top of the
  usual break ("Log + usual break"), shown when a usual break is set and no
  break is logged yet. "Log break" still replaces the usual break.
- Not tried yet: driving to another place, and a trip of 5 minutes or less.
- Test build 3: the owner went through `docs/android-testing.md` sections 2,
  3 and 5 (everyday use, reminder, backup) with no problems reported. The
  arrive-and-leave walk-through (section 4) is next, over a normal day.

## Waiting on the owner

- Try test build 3: a break again (no repeat "Clock out?"), the "Log +
  usual break" answer, a drive to another place, and a trip under 5
  minutes. And the web app on an iPhone. See `docs/android-testing.md`.
- Confirm the app ID `com.clocked.app` before any Play Store release (kept
  after the rename to Punch'd so updates install over the old app).
