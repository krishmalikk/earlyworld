# Year in music

A month-by-month history of what a listener was into. Their ratings and saves become a card for each month of the year, with that month's top tracks, artists, producers and releases, starting from the month they joined. It's earlyworld's take on the Letterboxd diary.

## The experience

### 1. Diary (profile)

A **Diary** section on the profile.

- Grouped by month: a month header ("October 2026 · 14 ratings"), then a row per entry: day of the month, cover, title, artist, stars, and a review mark when there's written text.
- Saves without a rating appear as saves.
- The profile shows the last few entries with **View diary**, which opens the full diary.

### 2. Year in music (screen)

Opened from a **This month** card on the profile ("October so far · Top track: Purple Heart Ski · See your year →").

- **Year picker** at the top, listing each year the listener was active.
- **Months, newest first**, from the current month back to January, or back to the month they joined if that's later. Someone who joined in August sees October, September and August only. Earlier years appear in the picker only if they were active then.
- **Each month card:**
  - month name, "14 ratings · 22 saves · avg 3.9★"
  - **Top tracks**: the 3 highest rated, as covers with stars
  - **Top artist** and **top producer**: "LUCKI · 5 tracks · avg 4.3★"
  - **Top release**
  - **Earliest find**: the track they saved when it had the fewest saves ("You were the 3rd person to save it")
  - **Share** → the Recap card for that month (`docs/share-cards.md`)
- A month below the minimum shows as one line ("September · 2 ratings") instead of a card.

### 3. Month detail

Tapping a month card opens the whole month: top 10 tracks, artists, producers and releases, the earliest finds, and every diary entry from that month.

## Rules

- **What counts:** a rating counts in the month it was **first** made (`createdAt`); editing it later doesn't move it. A save counts in the month it was saved (`savedAt`). Release ratings count the same way.
- **Start month:** the user document's `createdAt`. If it's missing, the month of their first rating or save.
- **Minimum for a full month card:** 3 ratings.
- **Ranking:**
  - _Top tracks_: stars, then tracks with a written review, then the earliest rated.
  - _Top artists and producers_: each rated track adds its stars, and each unrated save adds a fixed amount. Shown with the track count and average stars.
  - _Top releases_: stars.
  - _Earliest find_: the lowest `saveCountAtSave` among the month's saves (the Recap card already uses this).
- **Ties:** most recent first.
- **Unavailable tracks** (deleted or hidden) are skipped, and the next one moves up.

## Who can see it

| Phase | Visibility                                                  |
| ----- | ----------------------------------------------------------- |
| v1    | Your own diary and year only                                |
| v2    | Visible on every profile, with a setting to keep it private |

## Data

### v1: computed in the app

- Own ratings (`ratings` where `uid` = me, by `createdAt`; the index exists), own release ratings, and own saves (`users/{uid}/saves` by `savedAt`) for the selected year.
- Grouped by month and ranked on the device. A heavy listener has a few hundred entries a year, small enough to load at once.
- No backend changes and no deploy.

### v2: monthly summaries on the server

- A document per month, `users/{uid}/months/{yyyy-mm}`, with counts, average, top track/artist/producer/release IDs and the earliest find.
- Kept current by triggers on `ratings`, `releaseRatings` and `users/{uid}/saves`.
- Makes other people's months readable (through `readCommunity`, like profiles) and keeps the screen fast for heavy listeners.

## Build phases

1. **v1 (about 1 week):**
   - Diary section and full diary screen
   - Year in music screen with the year picker, month cards and month detail, computed in the app
   - This month card on the profile
   - Share from any month using the existing Recap card
2. **v2:**
   - Server summaries per month
   - Public diary and year with a privacy setting

## Metrics

- Share of weekly active listeners who open Year in music at least once a month
- Month shares, and installs from shared month cards
- Share of new listeners who reach the 3-rating minimum in their first month

## Open questions

- Should unrated saves count toward top artists and producers, and how much is a save worth against a rating?
- Is 3 ratings the right minimum for a month card?
- Does the Diary include posts, or only ratings and saves?
- In v2, public or private by default?
