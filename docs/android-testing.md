# Testing on a phone

A checklist for trying a test build on a real Android phone, and the web
app on an iPhone. Use made-up entries, or your own on your own phone.
Nothing you log leaves the phone.

When something looks wrong, note:

- what you did
- what you expected
- what happened instead
- the phone model and the time (Eastern)

A screenshot helps. Crop out anything personal.

## 1. Install the Android test build

1. On the phone, open https://github.com/xSOSAxDEXx/Time/releases.
2. Pick the newest **Android test build N**. Under **Assets**, tap
   `clocked-preview-N.apk`.
3. Open the download. If asked, allow installs from your browser or Files
   app.
4. If Play Protect warns about an unknown app, tap **More details → Install
   anyway**. It warns because test builds don't come from the Play Store.

A newer test build installs over an older one and keeps your data. If
Android says the app "conflicts with an existing package", uninstall the old
one first. That deletes its data, so make a backup first (Settings → Backup and export).

## 2. Everyday use

- [ ] The app opens on **Week** with today highlighted. The icon and the
      splash screen show the logo.
- [ ] **Clock in now** sets today's start. Tapping it again asks before
      replacing the time.
- [ ] Min clock out and hours so far show for today. Min clock out turns
      green with ✓ once you clock out after it.
- [ ] Tap a day to open it. Edit each field, then use ‹ and › to move day by
      day. Changes stay after closing and reopening the app.
- [ ] A shift that ends after midnight counts on the day it started.
- [ ] **Summary** and **Charts** match the Week screen. Tap a chart column to
      see its breakdown.
- [ ] With an hourly rate in Settings, **Estimated pay** shows in the week
      footer, the All weeks list and the chart summary.
- [ ] Dark mode: switch the phone to dark mode (or Settings → Theme → Dark).
      Everything stays readable.

## 3. Clock-out reminder

- [ ] With the reminder on, the first **Clock in now** asks for
      notification permission after a short explanation.
- [ ] Set today's start so min clock out is 2–3 minutes away, then close the
      app. The "Time to clock out" notification arrives on time.
- [ ] With **When** set to **5 min early**, it comes 5 minutes earlier.
- [ ] Clocking out, or clearing the day, before the reminder time means no
      notification comes.

## 4. Arrive and leave

Needs location set to **Allow all the time** and notifications on.

**Set up**

- [ ] Settings → Arrive and leave → turn on **Ask when I arrive and leave**.
      Android asks for location, then for "all the time" (sometimes on a
      second screen), then for notifications.
- [ ] If you chose "only while using the app", Settings shows a warning and
      **Open phone settings**.
- [ ] Stand at a place and tap **Set to where I am now** under it. It shows
      "✓ Set · 150 m circle". Try another circle size.

Android can take a few minutes to notice you arriving or leaving, more so
with the screen off or battery saver on. Use the 150 m circle or bigger.
Walk or drive well past the edge of the circle.

**Walk through a day.** Start with nothing logged today.

| Do this                                                                                | Expect                                                                                                                                                                   |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Arrive at a place with a circle                                                        | Notification **At (place)**: "Clock in at (time)?" **Clock in** sets the start to when you arrived, and the location if blank.                                           |
| Leave and come back within 5 minutes                                                   | Nothing.                                                                                                                                                                 |
| Leave for more than 5 minutes                                                          | About 5 minutes after leaving: **Left (place)**: "Clock out at (time)?" with **Clock out** / **On a break**.                                                             |
| Tap **On a break**, then come back                                                     | About 3 minutes after you're back: **Back at (place)**: "Were you on a break?" **Log (n) min break** adds the time away to the break. **I was working** changes nothing. |
| With a usual break set and none logged, take a break                                   | **Back at (place)** also offers **Log (n) min + usual (n) min**, which adds the time away on top of the usual break.                                                     |
| On a break, come back within sight of the circle's edge for a minute, then leave again | No second **Clock out?**. When you're really back, one question covers the whole break from when you first left.                                                         |
| Tap **Clock out**, then come back                                                      | **Back at (place)** offers to undo the clock out and log the time away as a break, or **Stay clocked out**.                                                              |
| Leave while clocked in and arrive at a _different_ place                               | **At (new place)**: "Log the drive as time worked?" **Count as worked** sets Travel to Yes. **Log as break** adds the drive to the break.                                |
| Ignore a notification and open the app                                                 | The same question is a card on the Week screen.                                                                                                                          |

Also check:

- [ ] A time that's already set is never changed by a question.
- [ ] Turning arrive and leave off stops the questions.
- [ ] Questions still come after restarting the phone (open the app once
      after the restart if they don't).

## 5. Backup and restore

- [ ] Settings → Backup and export → **Back up** opens the share sheet with a
      `clocked-backup-….json` file. Save it to Drive or Files.
- [ ] **Export spreadsheet (CSV)** opens in a spreadsheet app with the same columns as
      the time card page.
- [ ] **Restore** from the backup asks first (**Replace**), then brings everything back,
      including the circles.

## 6. Accessibility (Android)

- [ ] **TalkBack** (Settings → Accessibility → TalkBack): every button,
      field and switch reads a clear name. Day rows read the day, times,
      total and min clock out, with "Met" or "Short" said out loud.
- [ ] **Font size** at the largest setting (Settings → Display → Font size):
      text grows and nothing is cut off or overlaps.
- [ ] **Remove animations** on: nothing in the app depends on motion.
- [ ] Every button is easy to hit with a thumb.

## 7. iPhone (web app)

iPhones use the web app. There's no iPhone app.

1. In **Safari**, open https://xsosaxdexx.github.io/Time/.
2. Tap **Share → Add to Home Screen → Add**.
3. Open **Clocked** from the Home Screen.

- [ ] It opens full screen with the logo icon and no Safari toolbar. The tab
      bar sits above the home indicator, and nothing is hidden by the notch.
- [ ] Clock in and edit a day. Close the app, reopen it, and the data is
      still there.
- [ ] Airplane mode: the app still opens from the Home Screen.
- [ ] Settings says clearing the browser's data deletes your time card, and suggests backing up.
- [ ] **Back up** offers to save or share the file. **Restore** can pick it
      from Files.
- [ ] The clock-out reminder shows a banner on the Week screen once the
      time has passed. iPhones only notify while the app is open; Settings
      says so.
- [ ] Arrive and leave says it's only in the Android app.
- [ ] **VoiceOver** reads every control's name.
- [ ] Larger text (Settings → Accessibility → Display & Text Size): web apps
      don't follow this setting. Use pinch-to-zoom instead.

## Last automated check (2 Nov 2026)

These ran in a browser on the web build at phone width (390 px) and computer
width (1280 px), in light and dark:

- Every control has a name.
- Text contrast meets WCAG AA (4.5:1, or 3:1 for large text).
- No sideways scrolling.
- Phone-width controls are at least 48 px (chart columns are as wide as the
  screen allows).

The computer-width table uses 40 px-tall fields, the same as the time card
page, because it's used with a mouse.
