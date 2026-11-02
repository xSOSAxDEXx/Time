# Progress and handoff notes

Where the build is, what's been decided, and what's waiting. Read this with
`CLAUDE.md` (the brief) at the start of a new session.

_Last updated: 2 Nov 2026._

## Build order status (CLAUDE.md §6)

| Step                                         | Status                              |
| -------------------------------------------- | ----------------------------------- |
| 1. Scaffold                                  | ⏳ Plan proposed, waiting for owner |
| 2. Data model + calculations + store         | Not started                         |
| 3. Week view + day editor + clock in/out     | Not started                         |
| 4. Summaries, All weeks, Settings            | Not started                         |
| 5. Charts                                    | Not started                         |
| 6. Backup/restore + CSV                      | Not started                         |
| 7. Clock-out reminder                        | Not started                         |
| 8. Pay calculator                            | Not started                         |
| 9. Polish, accessibility, device testing     | Not started                         |

## Owner decisions (don't re-ask)

- **Name:** Clocked.
- **Starting point:** the owner's time card HTML page (Excel formulas
  carried over exactly, see CLAUDE.md §3.2).
- **Platforms and process:** same as Luna Beats: Android APK via GitHub
  Actions, web app on GitHub Pages, iPhone uses the web app.
- **New in v1:** clock-out reminder (§3.8) and pay calculator (§3.9).
- **Not in v1:** importing data from the HTML page (the owner didn't pick
  it). The app starts empty.
- **Times:** give all times to the owner in US Eastern time.

## Defaults I chose (owner can change)

- Light theme by default (match system), blue accent like the HTML page.
- Overtime default: over 40 hours a week at 1.5×; only worked hours count
  toward overtime; Unpaid time off pays nothing.
- Clock-out reminder on by default, at the min clock-out time.
