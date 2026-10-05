# Verification — 2026-09-22

Latest social implementation and October 1 deployment evidence: [posts and videos](posts-and-videos.md#validation-record). The older checkpoints below remain historical; they do not establish public social-launch readiness.

Completed locally:

- App TypeScript check and Cloud Functions compilation.
- 9 logic/lifecycle/catalog tests: saver boundary and permanence, multiplicative score/decay, rarity matching, canonical URLs, seek/autoplay/replay rejection, actual React subscription mount/background/unmount, data-ownership guard, Bandcamp metadata, and catalog integrity.
- 10 Firestore emulator security tests: Rotation/stats/matches writes rejected, protected track fields rejected, owner-only saves, denormalized-credit validation, atomic username race, restricted profile fields, account defaults, comments, and collection-group read authorization.
- 8 backend emulator tests: real save-trigger retry/reorder behavior, permanent saver cap, daily comment cap, delayed onboarding exclusion, replacement match writes, rolling-hour listen sessions, earned artist/producer certification, and idempotent full-catalog seeding.
- iOS and Android Metro JavaScript exports.
- Expo dependency-version alignment and formatting checks.

The seed smoke test creates all 200 tracks, 40 artists, and 20 producers, runs the seed a second time, and confirms an existing save count and Genius credit are unchanged.

At this checkpoint, native installation and live-service tests were pending project configuration. Subsequent work is recorded in [ratings.md](ratings.md) and [live-firebase.md](live-firebase.md). See [device-checklist.md](device-checklist.md) for remaining device checks.

Dependency audit: no high or critical findings after updating Firebase CLI. npm still reports moderate transitive advisories involving `uuid` and `decode-uri-component` in the Expo/Firebase dependency trees (including 8 inherited findings for the Functions tree). These are documented rather than forcing incompatible major overrides or downgrading Expo, as npm's suggested fix would do. Recheck the upstream SDK releases before production deployment.

## Onboarding save regression — September 26, 2026

Live inspection confirmed six persisted saves with matching source metadata. Fixed the repeated-setDoc permission path with idempotent save transactions, disabled saves while the account subscription loads, and kept onboarding rows stable as save counts change. Save errors wrap beneath the row and clear on retry. The completion button appears beside the confirmed count.

App, script, Functions, and quality checks pass; 18 unit tests and 37 isolated emulator tests pass. The regression reproduces the old overwrite rejection and checks retries, concurrent repeated intents, timestamp preservation, nullable credits, more than five saves, repeated deletion, and missing tracks. The simulator visibly shows six confirmed saves and an enabled Find my people action. No user saves were added or removed during verification.

## Find my people completion check

Tapped the actual onboarding button in the iPhone simulator. Both live callable requests passed authentication; backend instance startup took several seconds. The account completed onboarding and navigated to Matches, then the user opened Discover. No backend failure was reproduced on this attempt.

Added a visible completion label and accessibility busy state. Matches now distinguishes loading, initial matching not completed (with an explicit retry action), query errors, and a successful empty result. An empty result no longer incorrectly tells an already-onboarded user to save five more tracks. App/script/Functions types, quality checks, and 18 unit tests pass.
