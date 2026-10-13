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

| Phase | Visibility                                                  |
| ----- | ----------------------------------------------------------- |
| v1    | Your own diary only                                         |
| v2    | Visible on every profile, with a setting to keep it private |

## Data

### v1: read in the app

- Own ratings (`ratings` where `uid` = me, by `createdAt`; the index exists), own release ratings, and own saves (`users/{uid}/saves` by `savedAt`).
- Merged by date and grouped by month on the device, loading a few months at a time as the listener scrolls.
- No backend changes and no deploy.

### v2: other people's diaries

- A `readCommunity` view (`diary`, by `uid`) that returns another listener's ratings and saves by date, respecting blocks and the privacy setting, the same way profiles are read today.

## Build phases

1. **v1 (a few days):** Diary section on the profile and the full diary screen.
2. **v2:** other listeners' diaries and the privacy setting.

## Metrics

- Share of weekly active listeners who open their diary
- Ratings per active listener before and after the diary ships

## Open questions

- Does the diary include posts, or only ratings and saves?
- In v2, public or private by default?
