# Progress and handoff notes

Where the build is, what's been decided, and what's waiting. Read this with
`CLAUDE.md` (the brief) at the start of a new session.

_Last updated: 2 Nov 2026 (step 5)._

## Build order status (CLAUDE.md §6)

| Step                                     | Status                                                                           |
| ---------------------------------------- | -------------------------------------------------------------------------------- |
| 1. Scaffold                              | ✅ Done. Web build checked in Chromium (phone + desktop sizes)                   |
| 2. Data model + calculations + store     | ✅ Done. Checked against the owner's spreadsheet totals (locally, not committed) |
| 3. Week view + day editor + clock in/out | ✅ Done. Web checked in Chromium (phone list, desktop table, dark mode)          |
| 4. Summaries, All weeks, Settings        | ✅ Done. Holidays and pay settings added; web checked in Chromium                |
| 5. Charts                                | ✅ Done. Web checked in Chromium (phone, desktop, dark mode)                     |
| 6. Backup/restore + CSV                  | Not started                                                                      |
| 7. Clock-out reminder                    | Not started                                                                      |
| 8. Pay calculator                        | Not started                                                                      |
| 9. Polish, accessibility, device testing | Not started                                                                      |

## Owner decisions (don't re-ask)

- **Name:** Clocked.
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
- Holidays count from the first day anything was logged, so they never
  add weeks from before you started using the app.
- Clocking in on a holiday keeps its 8 hours of holiday time off (change it
  in the day editor if it doesn't apply).
- **Charts:** the range resets to This week each time the app opens. Ranges
  over 14 days hide weekend days with nothing logged (like the HTML page).
  The week chart always shows whole weeks (Mon–Sun) for every week the
  range touches; the range summary counts only the dates picked.
- "Long shift" warning above 16 hours; "still clocked in" warning for a
  shift with no end from before yesterday.

## Formula review (2 Nov 2026)

The owner approved suggestions 1–4 and 6 and declined 5 (weekend days
counting as days worked). All are built; see CLAUDE.md §3.2 and §3.4.

## Waiting on the owner

- Nothing right now.
