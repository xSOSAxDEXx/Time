# Progress and handoff notes

Where the build is, what's been decided, and what's waiting. Read this with
`CLAUDE.md` (the brief) at the start of a new session.

_Last updated: 2 Nov 2026._

## Build order status (CLAUDE.md §6)

| Step                                     | Status                                                                           |
| ---------------------------------------- | -------------------------------------------------------------------------------- |
| 1. Scaffold                              | ✅ Done. Web build checked in Chromium (phone + desktop sizes)                   |
| 2. Data model + calculations + store     | ✅ Done. Checked against the owner's spreadsheet totals (locally, not committed) |
| 3. Week view + day editor + clock in/out | ✅ Done. Web checked in Chromium (phone list, desktop table, dark mode)          |
| 4. Summaries, All weeks, Settings        | Not started                                                                      |
| 5. Charts                                | Not started                                                                      |
| 6. Backup/restore + CSV                  | Not started                                                                      |
| 7. Clock-out reminder                    | Not started                                                                      |
| 8. Pay calculator                        | Not started                                                                      |
| 9. Polish, accessibility, device testing | Not started                                                                      |

## Owner decisions (don't re-ask)

- **Name:** Clocked.
- **Logo:** a fist crushing a clock.
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

## Defaults I chose (owner can change)

- Light theme by default (match system), blue accent like the HTML page.
- System font (no web fonts to download).
- App ID `com.clocked.app` (Android package and iOS bundle ID). This can't
  change once the app is on the Play Store, so confirm it before launch.
- Overtime default: over 40 hours a week at 1.5×; only worked hours count
  toward overtime; Unpaid time off pays nothing.
- Clock-out reminder on by default, at the min clock-out time.
- Week view switches to the full table at 1024 px wide and up.
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

## Formula review: suggestions waiting for the owner

Not built; each would need the owner's OK (CLAUDE.md §7):

1. **Usual break**: a setting (e.g. 20 min) added to min clock out until
   the real break is logged, so min clock out isn't too early in the
   morning.
2. **Hours so far** while clocked in, and the time left to min clock out.
3. **Check odd days**: flag a time off type with no hours (or hours with no
   type), and very long shifts (likely a missed clock out).
4. **Averages include paid time off.** Avg hours/week counts PTO hours, so
   it's "hours paid" more than "hours worked". Option: also show a
   worked-only average.
5. **Weekends:** weekend hours count toward the week, but weekend days
   don't count as days worked, which pushes avg hours/day up. Option to
   count weekend days worked.
6. **Short weeks:** a week with an unlogged holiday has 4 days, isn't
   "full", and drops out of the year-to-date average. Logging holidays as
   Company Holiday time off avoids it; the app could remind about it.

## Waiting on the owner

- **New logo** (brass knuckles smashing an alarm clock): the image came
  through chat only, so it needs uploading as a file (see the step 2
  summary) before it can replace `assets/brand/logo-mark.svg`.
