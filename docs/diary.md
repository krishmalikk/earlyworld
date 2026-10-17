# Diary

A listener's full log of what they rated and saved, newest first, grouped by month. It's earlyworld's take on the Letterboxd diary: a record of what you were listening to and when.

## The experience

### 1. On the profile

A **Diary** section on the profile.

- Shows the most recent entries under the current month's header.
- **View diary** opens the full diary.

### 2. Full diary screen

- **Grouped by month**, newest first, from the current month back to the month the listener joined.
- **Month header:** "October 2026 · 14 ratings · 6 saves".
- **One row per entry:**
  - day of the month
  - cover, title and artist
  - stars for a rating, or "saved" for a save without a rating
  - a review mark when the rating has written text
- Tapping a row opens the track or release.
- A month with no activity doesn't appear.

## Rules

- **What counts:** a rating appears on the day it was **first** made (`createdAt`); editing it later doesn't move it. A save appears on the day it was saved (`savedAt`). Release ratings appear the same way.
- **A track rated and saved** shows once, as the rating, on the earlier of the two dates.
- **Unrating or unsaving** removes the entry.
- **Unavailable tracks** (deleted or hidden) show as "Track unavailable".

## Who can see it

- **Private by default.** A diary only ever shows on its owner's profile.
- **Opt in to share.** A "Show my diary on my profile" setting on the upcoming Settings page makes it visible to other listeners. It starts off.

| Phase | Visibility                                             |
| ----- | ------------------------------------------------------ |
| v1    | Your own diary only. Nobody else can see it.           |
| v2    | Others see your diary only if you turn the setting on. |

## Data

### v1: read in the app

- Own ratings (`ratings` where `uid` = me, by `createdAt`; the index exists), own release ratings, and own saves (`users/{uid}/saves` by `savedAt`).
- Merged by date and grouped by month on the device, loading a few months at a time as the listener scrolls.
- No backend changes and no deploy.

### v2: other people's diaries

- A `diaryPublic` flag on `users/{uid}`, off by default, set from the Settings page (coming soon).
- A `readCommunity` view (`diary`, by `uid`) that returns another listener's ratings and saves by date only when their `diaryPublic` is on, and never across a block. The server enforces this; ratings stay owner-only in `firestore.rules`.
- The profile shows the Diary section on someone else's profile only when their flag is on.

## Build phases

1. **v1 (a few days):** Diary section on the profile and the full diary screen.
2. **v2:** other listeners' diaries, once the Settings page (with the privacy setting) ships.

## Metrics

- Share of weekly active listeners who open their diary
- Ratings per active listener before and after the diary ships

## Open questions

- Does the diary include posts, or only ratings and saves?
