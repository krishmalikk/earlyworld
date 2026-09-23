# Data ownership and computations

## Listener ownership

`useSubscription` owns the actual effect lifecycle and ignores late callbacks after cleanup. It detaches on unmount, query/account replacement, and the background transition for feed/matches. Actual React lifecycle tests exercise these transitions. The feed's multi-query effect owns an unsubscribe array; username availability owns both its debounce timer and document listener. Auth and AppState subscriptions also return cleanup functions.

Catalog and saved-track data live in React contexts backed by snapshots; Zustand contains only the auth UID/readiness and current playback track ID. A single save listener serves every visible card. Query keys prevent a previous account's data from appearing during account changes. Firestore's native SDK provides persistent offline cache. Client writes use native Firestore where possible; callable operations (name reservation transaction, metadata, track creation, completion, listening) require network access.

## Save accounting

`onSave` does not trust the delivered event's before/after state. Firestore trigger deliveries can be duplicated and reordered. Within a transaction it reads the _current_ save document, track, user, and `_saveState` marker. Only a state transition adjusts counts. All stats, counters, and activity writes share that transaction.

The 200th distinct saver is retained. The 201st sets `saversCapped` permanently; no later append is permitted, even after users unsave. Deletes decrement counts once and remove retained UIDs. Capped tracks never participate in matches. User save count describes current saves; `totalSaveEvents` is monotonic for the every-fifth-save schedule.

`activity/{hash(uid:trackId)}` stores actor UID, track ID, artist ID, and savedAt. The feed listens to followed users in groups of 30, each limited to the current 25-row page size, then deduplicates and merges chronologically. Artist/producer follows separately listen to catalog releases. Expanding the page replaces old listeners and retains live updates. Catalog details, including current save counts and production credits, resolve from the shared catalog listener.

## Engagement

Saves/comments are derived from their real Firestore documents. `recordEngagement` accepts listen events only; accepting arbitrary client `commentCount` / `saveCount` claims would defeat the anti-cheat boundary. `beginPlayback` issues a UID-bound, track-bound session with a server timestamp. A qualifying call must reference this session, pass entity ownership/duration checks, and have enough elapsed server time. A per-user/track lock excludes repeats for a rolling hour. The server derives **both** artist and producer attribution from the track.

Stats keep distinct tracks (max 300), ISO weeks (max 104), counters, and first/last engagement timestamps. Daily comment markers allow at most five comments per entity per UTC day. Onboarding engagement is excluded, including delayed save triggers whose `savedAt` precedes `onboardingCompletedAt`. Initial saves still contribute to matching.

## Rotation and matching

Shared pure code implements the exact multiplicative score, rarity weighting, thresholds, 26-week recency half-life, and 52-week consistency window. Nightly rotation recomputes completed users, including inactive accounts so their badges can decay. Public UI never prints scores. Rows with null tier are omitted from the grid and leaderboard.

Matching reads saves then track documents in groups of 30. It drops capped tracks, accumulates rarity over their capped saver arrays, selects 25 users, and attaches their three rarest shared tracks. It writes a replacement batch of `/matches`; the UI only listens. A per-user lease serializes overlapping computations. Initial onboarding explicitly invokes matching; opening a screen never does. No synthetic matches are created.

## Catalog and credits

Normalized source URL hashes are track IDs, so concurrent add calls deduplicate in one transaction. Names have type-prefixed deterministic hashes; artist and producer identities cannot collide. Only allowed public source hosts are fetched; provider metadata requests have timeouts and Bandcamp redirects are rejected. Client artwork and HTML are not trusted. The app uses generated platform embed markup, never arbitrary oEmbed HTML.

Genius calls are server-only and use a Secret Manager token. Normalized title/primary artist similarities must independently clear 0.80 / 0.85. Ambiguous near-ties are rejected. Enrichment does not overwrite a user-entered producer. Missing matches and temporary API failures leave a working track with no credits section. Manual re-enrichment requires an `admin` custom claim; no automatic read-time calls or lyric scraping exist.

## Extra server-owned collections

- `_saveState`: accounting reconciliation, survives unsaving.
- `_followState`: follower count reconciliation.
- `_engagementEvents`: event deduplication.
- `_commentDays`: daily contribution cap.
- `_playbackSessions`: trusted playback start, UID, track, consumed flag.
- `_listenLocks`: rolling-hour repeat exclusion.
- `_matchLeases`: per-user computation serialization.
- `_rateLimits`: callable request limits.
- `_geniusJobs`: creation-time enrichment claim; admin re-enrichment explicitly bypasses it.
- `activity`: read-only denormalized feed index.

All unspecified paths are denied by Firestore rules. Rotation collection-group reads are allowed only to authenticated users; matches and stats are readable only by their owner. Storage accepts only owner-uploaded JPEG/PNG/WebP avatars below 2 MB.

Concurrent matching requests set a pending flag on the current lease. The worker repeats with fresh saves before releasing ownership; a unique lease token prevents an expired worker from replacing a newer result. A successful write records the save-event watermark, so a trigger retry after a failed matching call can still finish the refresh without recounting the save.
