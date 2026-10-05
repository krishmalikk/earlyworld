# Data ownership and computations

## Listener ownership

`useSubscription` owns the actual effect lifecycle and ignores late callbacks after cleanup. It detaches on unmount, query/account replacement, and the background transition for feed/matches. Actual React lifecycle tests exercise these transitions. The feed's multi-query effect owns an unsubscribe array; username availability owns both its debounce timer and document listener. Auth and AppState subscriptions also return cleanup functions.

Catalog and saved-track data live in React contexts backed by snapshots; Zustand contains only the auth UID/readiness. A single save listener serves every visible card. Query keys prevent a previous account's data from appearing during account changes. Firestore's native SDK provides persistent offline cache. Client writes use native Firestore where possible; callable operations (name reservation transaction, metadata, track creation, completion, ratings, favorites) require network access.

## Save accounting

Client saves use an idempotent transaction: an already-satisfied intent performs no write, and new saves copy current track metadata within the transaction. This prevents create-only rules from rejecting repeated saves or stale metadata. Save mutations require connectivity; cached content stays readable. The account-scoped save subscription includes metadata changes and exposes a confirmed count, so pending writes cannot unlock onboarding. Onboarding uses that same subscription, stable track-ID ordering, and an early completion action after five confirmed saves.

`onSave` does not trust the delivered event's before/after state. Firestore trigger deliveries can be duplicated and reordered. Within a transaction it reads the _current_ save document, track, user, and `_saveState` marker. Only a state transition adjusts counts. All stats, counters, and activity writes share that transaction.

The 200th distinct saver is retained. The 201st sets `saversCapped` permanently; no later append is permitted, even after users unsave. Deletes decrement counts once and remove retained UIDs. Capped tracks never participate in matches. User save count describes current saves; `totalSaveEvents` is monotonic for the every-fifth-save schedule.

`activity/{hash(uid:trackId)}` stores actor UID, track ID, artist ID, and savedAt. The feed listens to followed users in groups of 30, each limited to the current 25-row page size, then deduplicates and merges chronologically. Artist/producer follows separately listen to catalog releases. Expanding the page replaces old listeners and retains live updates. Catalog details, including current save counts and production credits, resolve through a shared account-scoped reference cache with batched listeners.

## Engagement

Saves/comments are derived from their real Firestore documents. The server derives **both** artist and producer attribution from the track. There are no playback sessions or client-submitted listening events. Legacy engagement history is retained; Rotation calculations and save-based matching are unchanged.

Stats keep distinct tracks (max 300), ISO weeks (max 104), counters, and first/last engagement timestamps. Daily comment markers allow at most five comments per entity per UTC day. Onboarding engagement is excluded, including delayed save triggers whose `savedAt` precedes `onboardingCompletedAt`. Initial saves still contribute to matching.

## Rotation and matching

Shared pure code implements the exact multiplicative score, rarity weighting, thresholds, 26-week recency half-life, and 52-week consistency window. Nightly rotation recomputes completed users, including inactive accounts so their badges can decay. Public UI never prints scores. Rows with null tier are omitted from the grid and leaderboard.

Matching reads saves then track documents in groups of 30. It drops capped tracks, accumulates rarity over their capped saver arrays, selects 25 users, and attaches their three rarest shared tracks. It writes a replacement batch of `/matches`; the UI only listens. A per-user lease serializes overlapping computations. Initial onboarding explicitly invokes matching; opening a screen never does. No synthetic matches are created.

## Catalog and credits

Normalized source URL hashes initialize track IDs. SoundCloud additionally reserves its stable URN in `_soundcloudTracks`, so renamed URLs still resolve to the existing track and its ratings. Concurrent add calls deduplicate in one transaction. Names have type-prefixed deterministic hashes; artist and producer identities cannot collide. Only allowed public source hosts are fetched; provider metadata requests have timeouts and Bandcamp redirects are rejected. Client artwork and HTML are not trusted. The app uses metadata only and opens original release links outside the app. No embed HTML is rendered.

Genius calls are server-only and use a Secret Manager token. Normalized title/primary artist similarities must independently clear 0.80 / 0.85. Ambiguous near-ties are rejected. Enrichment does not overwrite a user-entered producer. Missing matches and temporary API failures leave a working track with no credits section. Manual re-enrichment requires an `admin` custom claim; no automatic read-time calls or lyric scraping exist.

The reviewed SoundCloud bulk importer uses official upload pagination and transactional identity/counter writes. Bulk entries defer Genius enrichment to avoid an unbounded request burst. Discover and artist discographies render virtualized rows, with a shared track-ID map for feed/profile references. Catalog reads now use 25-item cursor pages, complete-catalog server search, and batched reference hydration. See [soundcloud.md](soundcloud.md) for limits, checkpoints, and operator commands.

## Extra server-owned collections

- `_saveState`: accounting reconciliation, survives unsaving.
- `_followState`: follower count reconciliation.
- `_engagementEvents`: event deduplication.
- `_commentDays`: daily contribution cap.
- `_matchLeases`: per-user computation serialization.
- `_rateLimits`: callable request limits.
- `_integrations/soundcloudOAuth`: private token cache and refresh lease.
- `_integrations/soundcloudCatalogImport`: private bulk-import lease.
- `_soundcloudTracks`: server-owned provider identity mappings.
- `_geniusJobs`: creation-time enrichment claim; admin re-enrichment explicitly bypasses it.
- `activity`: read-only denormalized feed index.

All unspecified paths are denied by Firestore rules. Rotation collection-group reads are allowed only to authenticated users; matches and stats are readable only by their owner. Storage accepts only owner-uploaded JPEG/PNG/WebP avatars below 2 MB.

## October 1 social implementation

The posts/video implementation supersedes the earlier community-read and avatar-write descriptions above. Cross-account profiles, reviews, discussions, activity and Rotation leaderboards now use authenticated server-authorized pages, invalidated through small subscription-backed state documents. This enforces blocking and suspension across alternate detail routes. Direct profile text/avatar publication is denied; username reservations and profile revisions use server APIs and moderation. Owner saves, ratings and follows retain their account-scoped subscriptions.

Catalog tracks remain metadata-only. Playback is limited to user-uploaded, approved short videos through Expo Video. Original uploads and processed media remain private in Storage, with authorized processed URLs expiring after five minutes. See [posts and videos](posts-and-videos.md) for ownership, rollout flags, deployment blockers and validation status.

Concurrent matching requests set a pending flag on the current lease. The worker repeats with fresh saves before releasing ownership; a unique lease token prevents an expired worker from replacing a newer result. A successful write records the save-event watermark, so a trigger retry after a failed matching call can still finish the refresh without recounting the save.

## Releases

Release metadata, independent ratings/reviews, and favorites use separate server-owned collections and profile fields while sharing the existing rating transaction/editor conventions. The SoundCloud importer only visits existing verified artist accounts and preserves track identity and engagement. See [releases](releases.md) for source validation, checkpoints, UI behavior, and rollout.

## Catalog scaling update

See [catalog-scaling.md](catalog-scaling.md) for the cursor/cache architecture, asynchronous search index, private provider snapshots, controlled Genius jobs, deployment stages and retention prerequisites. The historical full-catalog limitations described in older audit documents no longer describe the current client.

## Messages

Direct messages and groups are described in [messages.md](messages.md). Chat is the one place where a client reads another account's content directly from Firestore: members of `conversations/{id}` may listen to it and its `messages`, so chat is realtime. All writes still go through callables, and each account's inbox comes from one server-maintained `users/{uid}/conversations` listener in `InboxProvider`.
