# Verification — 2026-09-22

Completed locally:

- App TypeScript check and Cloud Functions compilation.
- 9 logic/lifecycle/catalog tests: saver boundary and permanence, multiplicative score/decay, rarity matching, canonical URLs, seek/autoplay/replay rejection, actual React subscription mount/background/unmount, data-ownership guard, Bandcamp metadata, and catalog integrity.
- 10 Firestore emulator security tests: Rotation/stats/matches writes rejected, protected track fields rejected, owner-only saves, denormalized-credit validation, atomic username race, restricted profile fields, account defaults, comments, and collection-group read authorization.
- 8 backend emulator tests: real save-trigger retry/reorder behavior, permanent saver cap, daily comment cap, delayed onboarding exclusion, replacement match writes, rolling-hour listen sessions, earned artist/producer certification, and idempotent full-catalog seeding.
- iOS and Android Metro JavaScript exports.
- Expo dependency-version alignment and formatting checks.

The seed smoke test creates all 200 tracks, 40 artists, and 20 producers, runs the seed a second time, and confirms an existing save count and Genius credit are unchanged.

Native installation and live-service tests are still pending project configuration. See [device-checklist.md](device-checklist.md). No remote Firebase resources were deployed or seeded.

Dependency audit: no high or critical findings after updating Firebase CLI. npm still reports moderate transitive advisories involving `uuid` and `decode-uri-component` in the Expo/Firebase dependency trees (including 8 inherited findings for the Functions tree). These are documented rather than forcing incompatible major overrides or downgrading Expo, as npm's suggested fix would do. Recheck the upstream SDK releases before production deployment.
