# Punch'd user guide

Punch'd is a personal time card. You log when you start and stop, your
breaks, remote work and time off. It tells you how many hours you've worked,
the earliest time you can leave and still make your hours (**min clock
out**), and how your week is going. It can also estimate your pay and what's
left after bills.

Everything stays on your phone or in your browser. There's no account and
nothing is sent anywhere.

**Contents**

1. [Get the app](#1-get-the-app)
2. [Set it up (10 minutes, once)](#2-set-it-up-10-minutes-once)
3. [Every day](#3-every-day)
4. [Breaks](#4-breaks)
5. [Arrive and leave (Android)](#5-arrive-and-leave-android)
6. [Summary and Charts](#6-summary-and-charts)
7. [Money](#7-money)
8. [Backups and spreadsheets](#8-backups-and-spreadsheets)
9. [When something isn't right](#9-when-something-isnt-right)

---

## 1. Get the app

### Android phone

1. On the phone, open https://github.com/xSOSAxDEXx/Time/releases.
2. Pick the newest **Android test build**. Under **Assets**, tap
   `punchd-preview-N.apk`.
3. Open the download. If asked, allow installs from your browser or Files
   app. If Play Protect warns about an unknown app, tap **More details →
   Install anyway** (test builds don't come from the Play Store).
4. **Open Punch'd once** after every install, so it can set up arrive and
   leave again.

A newer build installs over the old one and keeps everything you've logged.

### iPhone, or a computer

Use the web app: https://xsosaxdexx.github.io/Time/

- **iPhone:** open it in **Safari**, tap **Share → Add to Home Screen →
  Add**, then open Punch'd from the Home Screen. It works offline.
- **Computer:** open it in any browser. On a wide screen the week shows as
  a full table you can edit in place.

The web app saves your time card **in that browser only**. Clearing the
browser's data deletes it, so back up regularly (see
[section 8](#8-backups-and-spreadsheets)). Arrive and leave isn't available
on the web.

### Which version am I on?

The Week screen shows **Revision N** under the Punch'd name. The number goes
up with every change, and the Android app and the web app built from the
same code show the same number. The bottom of Settings has the details,
e.g. "Punch'd · Revision 26 · Android test build 13 · built 2026-11-04".

If the web app shows an older revision than you expect, close it and open
it again: the first visit after an update can still show the old copy.

---

## 2. Set it up (10 minutes, once)

Open **Settings**. Everything is optional except what you want to use.

| Section                | What to set                                                                                                                               |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **About you**          | Name, badge number and primary location (shown on the Week screen).                                                                       |
| **Work day**           | **Required hours per day** (8 unless yours differs). **Usual break** in minutes, and **Usual break starts at** (12:00 PM unless changed). |
| **Lists**              | Your **Locations** and **time off types** (PTO, Floating, ...). Tap a name to remove it; type a new one to add it.                        |
| **Company holidays**   | Your company's holidays. They repeat every year, so you set them once.                                                                    |
| **Pay**                | Your **hourly rate**, overtime rule, and how each time off type is paid. Leave the rate blank to hide pay everywhere.                     |
| **Clock-out reminder** | On by default: a notification when you reach min clock out, optionally a few minutes early.                                               |
| **Arrive and leave**   | Android only. See [section 5](#5-arrive-and-leave-android).                                                                               |
| **Finance and bills**  | Taxes, paycheck deductions and bills, for the Money tab. See [section 7](#7-money).                                                       |
| **Spouse or partner**  | Their take-home pay and bills, if you want "left over" for the two of you.                                                                |
| **Driving**            | MPG, gas price, mileage reimbursement rate, daily commute, and miles between places.                                                      |
| **Backup and export**  | Back up, restore, and export a spreadsheet.                                                                                               |

---

## 3. Every day

### The Week screen

- **Clock in now** sets today's start time; **Clock out now** sets the end.
  If a time is already set, it asks before replacing it.
- Each day shows its times, its total hours, and **min clock out**: green
  with ✓ once you've met it, amber ("Short") if you left before it.
- While you're clocked in, today shows **hours so far** and **time left**.
- Any break times show under the day, e.g. "Break 11:30 AM – 11:54 AM".
- Use **‹** and **›** for other weeks, or pick a date. The footer shows the
  week's hours, days worked and average (and estimated pay, with a rate set).

### Editing a day

Tap a day to open it. You can change everything: start and end, break,
remote hours, time off and its type, travel, location, drives and a comment.
Use **‹** and **›** at the top to move day by day.

- **Overnight shifts:** an end time earlier than the start counts as the
  next morning. The shift counts on the day it started.
- **Company holidays** count as a full day of time off by themselves. If you
  worked that day, log it normally; to leave a holiday out this one time,
  tap **Don't count it this time**.
- A **⚠** line points out something odd (like time off hours with no type).
  It never stops you saving.

### How the numbers work

These match the original spreadsheet exactly:

- **Total** = (end − start) + remote + time off − break.
- **Min clock out** = start + required hours − time off − remote + break.
  While you're clocked in with no break logged yet, your usual break is
  added; the day says "Includes your usual 30 min break (12:00 PM –
  12:30 PM)".
- **Days worked** counts Monday–Friday days with any hours. A **full week**
  is 5 days; the yearly averages use full weeks only.

### Clock-out reminder

When you clock in, Punch'd schedules a notification for your min clock out
("You've hit your 8 hours"). It moves if you change your start, break,
remote or time off, and it's cancelled when you clock out. On Android it
works with the app closed. On the web it only works while the page is
open, and also shows as a banner on the Week screen.

---

## 4. Breaks

A day has a **Break (min)** total, used in every calculation, and can also
list **Break times**: when each break actually was.

- In a day, under **Break times**, set **Break start** and **Break end**,
  then tap **Add break**. Its minutes are added to the Break total.
  **Remove** takes them off again.
- A new break starts filled in with your usual break (e.g. 12:00 –
  12:30 PM), so for a normal lunch you only adjust what's different.
- Arrive and leave logs breaks with their times automatically when you say
  yes to "Were you on a break?".
- You can still type a Break total in minutes without times, e.g. for older
  days.

---

## 5. Arrive and leave (Android)

Punch'd can notice when you arrive at or leave work and **ask** whether to
clock in, clock out or log a break. It never logs anything without your
answer.

### Turn it on

1. Settings → **Arrive and leave** → turn on **Ask when I arrive and
   leave**.
2. Allow location **"Allow all the time"** and allow notifications. If
   Punch'd shows a ⚠ about "while using the app", tap **Open phone
   settings** and change it.
3. In the phone's settings, set Punch'd's **battery use to Unrestricted**
   (Settings → Apps → Punch'd → Battery). Samsung and some other phones
   otherwise hold the alerts back.

### Add your places

Under **Your places**, each location has a card. Add more with **Add a
place** at the bottom (type the name, tap **Add**); remove one with **Delete place** (days already logged
keep its name).

Give each place a fence, one of two ways:

- **A circle:** stand at the place and tap **Set to where I am now**, then
  pick a size (100–500 m; 150 m or more is more reliable).
- **An outline, for a big site:** tap **Outline**. In Google Maps, press and
  hold each corner of the site to drop a pin, tap the numbers at the top
  (like `40.71234, -74.00123`) to copy them, and paste them in. Go round the
  edge in order. Several corners can be pasted at once, and a Google Maps
  link works too. Or stand at each corner and tap **Add a corner where I
  am**.

Android can only watch circles, so for an outline Punch'd watches the
smallest circle that covers it, plus 30 m. The preview shows your outline
and that dashed circle, so a mistyped corner stands out.

**Check where I am** tells you, right now, whether you're inside each place.

### What it asks

| What happened                                    | Question                                                                                           |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| Arrived, nothing logged today                    | **Clock in?** at the time you arrived                                                              |
| Left while clocked in, gone over 5 minutes       | **Clock out?** at the time you left, or **On a break**                                             |
| Back at the same place after more than 5 minutes | **Were you on a break?** Logs the time away (with its times), or "I was working"                   |
| Arrived at a different place                     | **Log the drive as time worked?** or log it as a break; the drive is recorded for miles either way |
| Away 5 minutes or less                           | Nothing                                                                                            |

With a usual break set and no break logged yet, "Were you on a break?" has
a third answer, e.g. **Log 20 min + usual 30 min**, which logs the time away
_and_ your usual break at its usual time.

Questions come as notifications with answer buttons and as cards on the
Week screen; answering either one clears both. If you said yes to "Clock
out?" and come back, it offers to undo the clock out.

### Good to know

- **After installing an update or restarting the phone, open Punch'd once.**
  That registers your places with Android again.
- Android can take a few minutes to notice you arriving or leaving.
- A break that doesn't take you outside the dashed circle can't be noticed
  (a walk around the parking lot, for example). Add it in the day instead.
- Your location stays on the phone. Only your places' fences are saved
  (and included in backups); no location history is kept.

---

## 6. Summary and Charts

- **Summary:** your average hours per week and per day this year (full
  weeks only), the average without paid time off, this week against your
  target, today's min clock out, and hours logged this year. **All weeks**
  lists every week; tap one to open it.
- **Charts:** hours per day (on site, remote and time off) and hours per
  week, each with a dashed line at your target. Pick a range (this week,
  last 4 weeks, this month, custom, ...). Tap or hover a column for its
  breakdown.

---

## 7. Money

Needs an hourly rate (Settings → Pay). Every figure is an **estimate** from
your hours and the rates you enter: not a pay stub and not tax advice.

### What to enter (Settings)

- **Finance and bills**
  - **How often you're paid.**
  - **Taxes** from a recent pay stub: federal, state, local, and Social
    Security + Medicare (7.65% filled in). Each can be a **% of pay**, **$
    per paycheck** or **$ per month**.
  - **Paycheck deductions** (401(k), health, dental, HSA, ...): % or
    dollars, before or after tax.
  - **Bills** (rent, car, phone, ...): weekly, monthly or yearly.
- **Spouse or partner:** their take-home pay per paycheck, how often
  they're paid, and their bills. Turn on **Include in Money** to add them;
  turn it off to see just yours (what you entered is kept). Add a shared
  bill in only one of the two lists, or it's counted twice.
- **Driving:** MPG and gas price; a reimbursement rate if your employer
  pays mileage; your **daily commute** (miles to work and back); and the
  miles between places you drive between for work (**routes**).

### What the Money tab shows

For this month and this year: **gross pay → take-home → left over**.

- **Take-home** = gross − taxes − deductions.
- **Left over** = take-home (+ your partner's) − bills (+ theirs) − gas.
- **Gas** covers your logged drives plus your daily commute on each day you
  clocked in (not remote days, time off or holidays). Reimbursement covers
  logged drives only, never the commute, and is shown on its own.
- Fixed amounts (bills, dollar taxes and deductions) are spread evenly over
  the year. The current month counts only the days so far.

The chart shows each month's pay split into taxes, deductions, bills and
gas, and what's left. Tap a month for the exact figures.

---

## 8. Backups and spreadsheets

Settings → **Backup and export**.

- **Back up** saves one file, `punchd-backup-YYYY-MM-DD.json`, with every
  day and every setting (places, money settings and break times included).
  On the phone it opens the share sheet: save it to Drive, email it to
  yourself, or similar. On the web it downloads.
- **Restore** opens a backup, tells you what's in it, and asks before
  replacing what's on the device. It also reads older `clocked-backup`
  files and the original time card page's files.
- **Export spreadsheet (CSV)** opens in Excel, with the same columns as the
  original time card page (breaks as minutes).

Back up before uninstalling, before switching phones, and every so often on
the web.

---

## 9. When something isn't right

| Problem                                                      | Try this                                                                                                                                                                                             |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No "Clock in?" or "Clock out?" with the app closed           | Check location is **Allow all the time** and battery use is **Unrestricted**. Open Punch'd once after any update or restart. Use **Check where I am** to see whether the phone thinks you're inside. |
| It didn't notice a short break                               | You probably didn't leave the dashed circle. Add the break in the day.                                                                                                                               |
| A notification answer didn't change anything                 | The question may have been out of date (already answered, or the day changed). Check the day and edit it by hand.                                                                                    |
| Pay or Money is hidden                                       | Set an hourly rate in Settings → Pay.                                                                                                                                                                |
| Money's gas is missing                                       | Set both MPG and gas price in Settings → Driving.                                                                                                                                                    |
| A drive shows "without miles"                                | Add the route's miles in Settings → Driving, or type the miles in the day.                                                                                                                           |
| The web app shows an old revision                            | Close it and open it again.                                                                                                                                                                          |
| Android says the update "conflicts with an existing package" | Back up, uninstall the old app, install the new one, then restore.                                                                                                                                   |
