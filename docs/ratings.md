# Ratings, reviews, and favorite tracks

## Behavior

- Ratings use ½–5 stars (ten half-star steps). One current rating per account and track, with an optional 500-character review. No playback requirement.
- Saves, favorite tracks, ratings, rare-save matches, and earned Rotation remain independent.
- Community scores show the average to one decimal place from the first rating, with the count; unrated tracks say “No ratings yet.”
- Profiles show four ordered favorites, up to 12 highest-rated songs (4+ stars), five recent ratings/reviews, saved tracks, then Rotation. Full rating histories and track ratings load in increments of 25.
- Rating feed entries use their own document identity, preserving different listeners' opinions on the same song. Editing retains the original publication date; deleting removes the entry.
- Review text is optional, editable, and removable independently of the star rating. Existing discussions and Studio credits are preserved.

## Backend contract

`ratings/{sha256(uid + ':' + trackId)}` stores `uid`, `trackId`, integer `halfStars` (1–10), trimmed `review`, `createdAt`, and `updatedAt`.

Authenticated callable Functions:

| Function            | Input                            | Result                 |
| ------------------- | -------------------------------- | ---------------------- |
| `setTrackRating`    | `{ trackId, halfStars, review }` | `{ changed: boolean }` |
| `deleteTrackRating` | `{ trackId }`                    | `{ changed: boolean }` |
| `setFavoriteTracks` | `{ trackIds: string[] }`         | `{ changed: boolean }` |

Ownership always comes from authentication. All ratings, aggregates, and favorites are server-owned; Firestore rules deny direct client writes. Signed-in listeners can read ratings. Track existence, integer score range, review length, and at most four distinct favorite IDs are validated server-side.

A single transaction writes each rating and updates `tracks.ratingCount`, `tracks.ratingHalfStarSum`, `users.ratingCount`, and `users.reviewCount`. Average stars are `ratingHalfStarSum / (2 * ratingCount)`. Retries with identical values do not change timestamps or counts. Deletion is idempotent and also supports cleaning up a rating whose track was removed. Favorite order is stored in `users.favoriteTrackIds`.

The existing `_rateLimits` mechanism permits 60 rating mutations per hour and 30 favorite updates per hour per account. Valid no-op requests still consume request budget. Existing TTL guidance for `_rateLimits.expiresAt` applies.

The app shares one own-ratings listener across track rows. Other reads use indexed profile, track, and followed-user queries. Failed submissions retain editor drafts; publishing requires connectivity. Native Firestore keeps previously loaded content cached. Analytics logs rating/review publication, favorite updates, and mutation failures without review text.

## Compatibility and deployment

Missing counts default to zero and missing favorite IDs to an empty array. There is no data migration, fabricated rating, save conversion, or comment conversion. Existing save-feed entries still work.

After the Firebase project has a default Firestore database and Functions prerequisites configured, deploy before distributing the beta client:

```sh
npx firebase deploy --project earlyworld-6831c --only firestore,functions
```

The project must retain the existing Genius secret for its existing enrichment Functions. Point a newly rebuilt native app at the real project with the matching bundle ID, and remove the local emulator override only when the cloud backend is ready. Local simulator users and ratings do not migrate automatically.

Cloud deployment completed on September 26, 2026, after the default Firestore database was enabled. Firestore and Storage rules, all nine composite indexes, and all 16 Functions were deployed to `earlyworld-6831c`. The initial Eventarc permission propagation and artifact repository provisioning errors were resolved by retrying the affected Functions. See [live-firebase.md](live-firebase.md) for the live configuration and rollout checks.

## Verification — September 26, 2026

- TypeScript and Functions compilation pass. iOS and Android JavaScript bundles export successfully; neither bundle contains the configured Genius secrets.
- 11 unit/catalog/lifecycle tests pass, including half-star boundaries, average formatting, account-switch listener clearing, and feed identity/order/pagination.
- 12 Firestore rules tests pass, including signed-in rating reads, denied owner/other-user rating writes, and protected aggregates/favorites.
- 16 backend emulator tests pass: the eight existing regressions plus eight ratings tests covering lifecycle, validation, ownership, concurrent edits, favorites, missing data, request budgets, and query pagination/ties.
- Backend/security tests ran against a separate Firestore emulator on port 8480. The live simulator catalog and account were preserved.
- iOS simulator: published a temporary 4½-star review; verified the community average, own rating, profile counters, highest-rated shelf/history, and review clearing. Searched for favorites, added two, reordered, saved, and verified the profile shelf. Removed temporary test entries afterward; the account's original five saves remain.
- Accessibility labels and half-star increment/decrement controls inspected. Real-device VoiceOver gestures, software keyboard behavior, and forced network failure tests remain on the device checklist; no physical iPhone was connected.

Before inviting testers, complete real-device/offline validation. Public launch still needs separate reporting, blocking, moderation, and account-deletion work.
