# Producer profiles and Genius productions

Producer spotlight cards and the track-cover cards follow the supplied reference,
using earlyworld's navy/lavender palette. Spotlight cards show real catalog counts,
avatars, a short Genius biography when available, profile navigation, and an actual
Follow action. There are no invented BPM ranges, genre tags, or affiliations.

## Ownership and identity

`syncProducerCredits({ producerId })` is authenticated and limited to 60 calls per
account per hour. It resolves the producer's Genius artist ID from the producer
credits of up to five existing, matched catalog songs. Exact normalized names or
existing aliases must identify one unique artist ID; ambiguous identities stop for
review instead of silently choosing a search hit. Subsequent calls use that ID.

The official Genius `/artists/{id}/songs` endpoint is paginated in title order with
25 associations per page. Every result is verified against the song detail's
`producer_artists` IDs. Performer-only and writer-only associations are excluded;
co-productions are included. Genius is a community-maintained source, not a guarantee
of every real-world production credit. No audio or lyric pages are downloaded.

Provider metadata is stored in server-owned `producers/{id}/productions/{geniusSongId}`
documents. The producer stores its Genius identity, photo, biography excerpt (maximum
350 characters), verified count, last update time, and pagination checkpoint.
Production documents are readable by signed-in users and deny all client writes.

A shared four-minute lease serializes sync pages. Requests are spaced at least
500 ms apart. HTTP 429 records the provider's cooldown (one hour if no retry time is
provided). Errors do not advance the page or discard cached productions. A page's
metadata, deduplicated credits and counters commit together. Completed producer
scans do not automatically restart; periodic refresh/reconciliation is future work.

## App behavior

Profiles show **Genius credits** and **In earlyworld** tabs. The catalog tab includes
existing name-based co-production credits, even when a different producer owns the
legacy primary `producerId`. This display change does not change Rotation, matching,
engagement attribution, saves, ratings, or catalog track IDs.

Genius credits link to earlyworld track pages when a matching Genius song ID already
exists in that producer's catalog; other songs open on Genius. They are not silently
imported as duplicate rateable tracks. The full available list is loaded progressively
with **Load more productions**; cached rows display in 25-item increments. Profiles
retain follows, the current user's Rotation badge, and certified listeners.

## Operations and verification

The tested callable and production read rules were deployed to `earlyworld-6831c`.
The normal signed-in app flow can populate profiles without a local admin credential.
The optional operator command requires explicitly authorized admin Application Default
Credentials; it does not extract or reuse Firebase CLI credentials:

```sh
DEBUG= GCLOUD_PROJECT=earlyworld-6831c npm run catalog:sync:producers -- --production --top=4
DEBUG= GCLOUD_PROJECT=earlyworld-6831c npm run catalog:sync:producers -- --production --apply --producer=PRODUCER_ID --pages=100
```

Omit `--apply` for a read-only preview. Runs stop on provider errors and resume from
saved checkpoints. The script never prints credentials, lyrics, or user reviews.

Validation includes producer/co-producer verification, identity ambiguity, malformed
pagination, stable repeated imports, concurrency, provider cooldown, authentication,
unchanged track social fields, and client-write denial for production documents.

## Initial live verification

Populated the four spotlight profiles through the normal authenticated app flow:
Whitearmor (25 verified productions), Autumn! (14 across two API pages), fakemink
(15), and Hi-C (9). These are **63 cached credits**, not claims that their complete
discographies have finished syncing. The checkpoint remains open for additional
pages, accessible through Load more productions.

The Whitearmor catalog tab finds 85 existing tracks when co-productions are included,
compared with its 68 legacy primary-producer tracks. Live navigation, provider artwork,
biographies, matching local-track links, and a second production page were checked in
the iPhone 17 simulator. No follows, user ratings, reviews, favorites, or saves were
changed during verification. The optimized JavaScript preview remains in use because
of the previously documented development-mode simulator stall.

`npm run check` passes (19 unit tests plus type/quality/build checks). The isolated
emulator suite passes 15 rules tests, 6 producer-sync tests, and 6 existing Genius
regression tests. Physical-device checks remain outstanding.

## Compact regular track cards

Regular feed, catalog, and saved-track cards use rounded horizontal rows with a small cover, title, artist, producer credit, source/save count, and a trailing community rating/bookmark area. Personal ratings remain visible when present. This takes the compact layout from the reference without adding rankings or a Curator Stacks section. Large artwork cards are reserved for the Discover featured shelf through the explicit `feature` variant.

Verified the compact feed, two-column producer cards, and Whitearmor’s Genius-backed profile in the iPhone 17 simulator. `npm run check` passed after the layout change (19 unit tests, app/script types, UI quality, and Functions build). Studio and bottom navigation remain unchanged.
