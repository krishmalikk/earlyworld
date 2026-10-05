# Settings

Settings opens from the gear on the owner's profile. The dedicated signed-in stack contains Account, Community access, Blocked listeners, policy details, and Delete account screens. Rows use the shared navy/lavender theme, explicit accessibility labels, and native back navigation. Profile editing remains on the profile.

Account controls reuse Firebase email verification and password-reset emails. Community access retains the existing eligibility callable. The community/report route remains available, including signed-out policy access, and shares policy/account components with Settings. Support email uses server configuration with earlyworldofficial@gmail.com as fallback; opening email fails visibly with the address if no email app is available. Bug-report drafts include only app/build/platform information.

`readCommunity` with `kind: blockedUsers` returns up to 25 `{ id, username }` entries and a document-ID cursor. It reads only the caller's block list, supplies only published usernames, and uses null for missing, suspended, or deleting accounts. No profile content or navigation is exposed. Load more retains prior entries; confirmed unblocks disappear only after backend success. Existing subscription invalidation and account-keyed screens prevent cross-account cached state.

Sign-out preserves local post drafts. Account deletion retains its server-enforced five-minute recent-authentication requirement. A stale session exposes Sign in again; the user must return and confirm deletion themselves. No deletion automatically resumes after authentication. Successful requests retain queued cleanup and clear the current account's local draft before signing out (sign-out still runs if local draft cleanup fails).

No preferences, dependencies, migrations, catalog changes, or social feature-flag changes were introduced. Moderation access is shown only after the existing server status confirms administrator access; server authorization remains authoritative.

## Verification — October 4, 2026

- `npm run check` passed: 32 tests, app/script type checks, UI quality checks, and Functions build. `git diff --check` also passed.
- 40 isolated Firestore backend/rules tests passed, including new block pagination, minimal identity responses, unavailable accounts, ownership, malformed cursors, unblock, and deletion authentication/idempotency tests. Existing tests cover moderation, blocking, account cleanup and accounting.
- The tested readCommunity function was deployed to earlyworld-6831c. The hosting policy's account-navigation wording was updated locally; hosting was not deployed.
- The Settings home layout was visually checked in the iPhone 17 simulator using a temporary signed-out preview; the override was removed. No account was created or deleted for the visual preview.
- Signed-in navigation/actions, large text, actual VoiceOver navigation, and physical-device testing remain to be verified with a signed-in test account. No live destructive action or verification/reset email was sent during validation.
