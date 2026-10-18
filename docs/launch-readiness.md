# earlyworld — what would make it feel finished?

## October 18: three approved follow-up fixes

Implemented on `production-implementation`:

1. **Policies and deletion:** current text/photo and immediate-publication behavior now agrees across native and hosted policies. Added an external email deletion-request page and links from settings, community, and website footer. Apple deletion reauthenticates and revokes provider access; cleanup no longer strands accounts with more than 25 orphan uploads. See [deletion operations and verification](account-deletion.md). Real-provider OAuth/revocation testing on physical devices remains required; emulator cleanup tests are not a substitute.
2. **Photo-link recovery:** mounted private photos/avatars register with one account-scoped renewal coordinator. Near expiry, on image failure, and on foreground resume, existing authorized readers renew links. Refreshes are batched with a 30-second retry cooldown; public catalog art is unaffected. An open full-photo view tracks the media ID so renewed URLs replace the expired source without reopening the post.
3. **Feed pagination:** For You uses independent source positions including timestamp precision and document IDs. Following, post lists, reviews and comments use precise timestamp/ID cursors; old cursors remain readable. Group scan boundaries cannot skip unseen rows after filtering. Old installed For You clients retain their numeric-cursor compatibility until updated.

Publishing restrictions, eligibility enforcement, report inbox, and the other proposals below have **not** been implemented by this follow-up. The observations below are the original audit; the completed items above supersede those specific findings.

**Validation and rollout:** `npm run check` passed (48 tests plus type/quality/build checks). The isolated Auth/Firestore/Storage backend and security suite passed all 58 tests. The six affected Functions and Firebase-hosted policy/deletion pages were deployed; both web pages return HTTP 200 with the expected content. The simulator shows the new deletion web link and cancellation returns to the explanation without submitting deletion. The marketing website footer change is local source only: Firebase serves `hosting/`, not `website/`. App changes require an updated app bundle. Physical-provider deletion/revocation and live signed-photo expiry recovery on devices remain to be verified; automated renewal tests cover expiry parsing, batching, retry cooldown, unmount/account reset, and URL replacement.

**Codebase review: October 17, 2026**  
**Baseline:** `main` at `bbc58be`, including the current uncommitted working-tree changes.

## October 18: five immediate fixes implemented

The five-item follow-up is implemented; the findings below remain the original audit and broader roadmap.

1. **Music attachments:** feed/detail cards and the composer preview show linked tracks, releases, artists, and producers with artwork and working detail routes. References use the shared catalog cache. Missing items have an explicit unavailable state.
2. **Onboarding policy navigation:** incomplete signed-in accounts can open `/community` and return to their mounted onboarding screen. Other protected routes remain gated; signed-out policy access stays available.
3. **Loading and publication recovery:** Edit Profile has initial loading/error/retry states, account-scoped inputs, discard protection, reusable uploaded-photo IDs after submission failure, and accurate partial-save feedback. Posts open their detail/status screen after submission. Owners can find processing/failed submissions on their profile, refresh status, edit/retry failed media, or delete via post options. Public counters/comments appear only once publication succeeds. Post navigation warns before losing a changed composition; ordinary tab switches retain it. Multi-photo cards use a compact grid and full-photo views show loading/retry feedback.
4. **Saved library:** profiles preview five saves and link to a virtualized library with 25-result cursor pages and search by saved title, artist, or producer. Server search scans at most 250 saved records per request and continues across empty scans; it does not search only loaded cards. This intentionally uses metadata captured when saving. Existing blocking/suspension authorization applies to every page.
5. **Website:** removed the email form, signup-success script, associated styles, waitlist prompts, and stale setup instructions. The hero links to the app overview; contact links use `earlyworldofficial@gmail.com`. No signup endpoint or placeholder store links were added.

**Validation:** `npm run check` passed (43 tests plus type/quality/build checks). Isolated Firestore backend/security tests passed (44 tests), including all 301 saved records, a search match beyond the first 250-record scan, block enforcement, owner-only processing/failure views, and failed-photo removal followed by idempotent publication retry. `readCommunity` and `listPosts` were deployed to `earlyworld-6831c`; launch flags and security rules were not changed. In the iPhone 17 simulator, checked Edit Profile loading and discard/keep-editing feedback, profile preview, saved-library search against the deployed API, and a preview attachment opening the correct track detail/Studio screen. No test posts or profile changes were published. The website was previewed locally with no signup form. Website hosting was not redeployed: this repository's Firebase hosting target serves `hosting/`, not `website/`.

**Still to verify on devices:** interrupted photo uploads and completion through the live worker, account switching mid-request, offline recovery, VoiceOver/TalkBack, large text, and physical iPhone/Android navigation. The simulator accessibility tree stopped exposing editor controls after dismissing the discard alert even though the editor remained visible; reloading restored automation. Check that dismissal with VoiceOver on a physical device. These fixes do not mark the broader public-launch gates below complete.

## My recommendation

The app needs a completion pass more than another major feature. Its identity is already strong: underground music, taste-led profiles, producer credits, the Studio, navy/lavender styling, and orbit-based artwork. Preserve those things.

The highest-impact work is to make every action have a clear result, every collection have a way to browse it, every failure have a recovery path, and the first session feel rewarding. Add a small amount of motion to reinforce that behavior. More blocking pop-ups would usually make it feel less polished.

My five priorities are:

1. **Close broken or unfinished journeys:** music attachments, saved-library browsing, signup policy navigation, photo processing, and genuine website signup.
2. **Make state changes feel dependable:** loading, saving, success, offline, retry, and unsaved changes.
3. **Make a new account feel populated and personal:** a useful first destination, real community activity, clear next steps, and helpful explanations of taste features.
4. **Add restrained interaction polish:** bookmark/like feedback, clear rating selection, stable artwork, and consistent sheets.
5. **Make public launch supportable:** effective server controls, report handling, truthful policies, account deletion, provider permissions, and release-device testing.

### What this audit establishes

This is a source-code and configuration review, not a claim that the live app or deployed backend was tested today. I inspected navigation, authentication/onboarding, the main tabs, catalog details, ratings, profiles, diary, sharing, settings, social APIs, media responses, website files, and existing QA documentation.

`npm run check` passed: **43 tests**, app/script type checks, UI quality checks, and the Functions build. Backend emulators, physical devices, production flags, cloud logs, current provider approvals, store-console declarations, and real network timings were **not** checked in this audit.

The current app includes **text/photo posts**, not videos. Share cards, a private diary, profile editing, settings, and a For You feed already exist. Older documentation sometimes describes previous behavior; implementation findings below refer to the current source. This document recommends work; it does not implement it.

## 1. Close the unfinished product journeys

These are the changes I would prioritize before decorative improvements.

| Priority              | Finding and evidence                                                                                                                                                                                                    | Recommended change                                                                                                                                                                                                           | Finished when                                                                                                     |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| **Before launch**     | Create accepts a catalog attachment and `postDTO` returns it, but [`PostCard`](../src/components/PostCard.tsx) never renders `post.attachment`. `openAttachment` exists but has no caller in the post card/detail flow. | Show a compact artwork/title/artist attachment card on both feed and detail views. Route tracks, releases, artists, and producers to their existing screens. Give unavailable items a neutral state.                         | An attachment-only post is meaningful, and all four attachment types can be opened from the published post.       |
| **Before launch**     | [`Profile`](../src/components/Profile.tsx) requests 30 saves and renders them without a “View all” entry.                                                                                                               | Keep a short profile preview and add a paginated **Saved tracks** screen with search within the listener's complete saved library. Keep post bookmarks separate.                                                             | Saving a 31st or 300th track does not make older saves inaccessible from the library.                             |
| **Before launch**     | [`startupRedirect`](../shared/startup.ts) redirects incomplete signed-in accounts to onboarding, while [`Onboarding`](../app/onboarding.tsx) links them to `/community` to read the policy.                             | Allow the public policy/report-support route during onboarding, with a reliable return to the same step and intact inputs.                                                                                                   | A new Google/Apple listener can actually read the agreement before accepting it.                                  |
| **Before launch**     | [`Edit profile`](../app/edit-profile.tsx) returns an empty page while initial data is unresolved; its error feedback appears after that early return.                                                                   | Give initial loading, failed profile reads, and retry their own visible states. Warn before leaving changed bio/scenes/photo selection. Report partial saves accurately because scenes and profile text use separate writes. | Network failure never leaves an indefinite blank edit screen or silently loses edits.                             |
| **Before launch**     | [`website/script.js`](../website/script.js) prevents form submission, displays “You're on the list,” and resets the email without making a request.                                                                     | Connect a real consent-aware signup endpoint with duplicate/rate-limit handling, or replace the form with real store/internal-test links.                                                                                    | Success is shown only after the service accepts the signup; failures preserve the address.                        |
| **High-value polish** | [`Feed`](<../app/(tabs)/index.tsx>) can show its no-activity state before its several data sources finish; some other screens use “Empty” components as loading states.                                                 | Separate loading, genuinely empty, unavailable, and failed states. Keep existing content visible during refresh. Add one coordinated pull-to-refresh to Feed, preserving filters and avoiding duplicate requests.            | A slow connection does not look like an empty community, and retry does not reset the user's place unnecessarily. |
| **High-value polish** | [`Discover`](<../app/(tabs)/discover.tsx>) searches catalog entities, not listeners. Following people mostly depends on encountering them through content or matches.                                                   | Add listener search or a small **Find listeners** destination using server-authorized results that respect blocks/suspension. Include safe empty states.                                                                     | Someone can find a friend's exact username without needing a matching track or a shared post first.               |

### Finish the photo-post journey

The composer supports retry/cancel while mounted. Its content is intentionally memory-only ([`post-composer.ts`](../src/data/post-composer.ts)); do not quietly turn this into a persistent drafts feature contrary to that current choice.

- Confirm **Discard changes / Keep editing** when navigation would actually destroy a changed post. Ordinary tab switching that preserves it should not nag.
- Distinguish **Uploading**, **Processing photos**, **Published**, and **Couldn't publish**. Give the owner a compact processing item with retry/remove options when applicable. A one-time alert followed by a profile without the post is not enough.
- After text-only publication, show the new post or a **View post** action. After photo submission, do not say “Published” until processing has succeeded.
- Keep input and file order on failed requests. Explain that force-quitting can discard an unsent composition; backgrounding alone should not unnecessarily discard it.
- Add an obvious **Read more** affordance for the feed's six-line text truncation, a practical multi-photo layout, and a full-photo loading/error state.
- Verify permission denial, limited-library access, HEIC/portrait/landscape images, account switching during upload, cancellation, and retry. These are acceptance cases, not presumed existing failures.

## 2. A consistent feedback system

### Pop-ups: where they help and where they do not

There is no shared toast/snackbar system in the reviewed UI. Several successful actions use `Alert.alert`, while others simply close or change screens. Build one small shared feedback component rather than adding custom pop-ups independently to each feature.

| Interaction                                                | Preferred feedback                                                                                                                |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Save a track / like / bookmark                             | Immediate pressed/pending state, then a filled icon when confirmed. A subtle animation is usually enough; no alert for every tap. |
| Publish a rating or save profile changes                   | Short nonblocking “Rating saved” / “Profile updated” message. Offer **View** when the destination changed.                        |
| Export a share card                                        | Nonblocking “Saved to Photos.” Keep an inline action if permission is denied. Replace the current success alert.                  |
| Photo upload still processing                              | Persistent status near the affected content; optional brief “Photos are processing” message.                                      |
| Failed request                                             | Action-specific inline error with **Retry**. Keep the user's work. Do not hide important failures in a disappearing toast.        |
| Delete a post/account, remove a rating, or discard writing | Clear confirmation naming what will disappear. Keep destructive actions visually separate.                                        |
| First encounter with Rotation or matching                  | A user-invoked explanation sheet, not an automatic tutorial modal.                                                                |
| First completed rating/favorite shelf                      | At most one dismissible contextual prompt to explore the profile or share a card. Never gate navigation.                          |

Use a single queue so messages do not stack, respect the keyboard/tab bar/safe area, provide accessibility announcements, and clear account-specific messages on account changes. Only offer **Undo** for an operation that can genuinely be reversed; account deletion is not one.

[`errorMessage`](../src/lib/firebase.ts) currently removes a prefix from the raw error message. Add a bounded error-code mapping for offline/timeouts, permissions, sign-in expiry, upload limits, and unavailable content. Keep sanitized diagnostics for operators, not raw provider explanations in track rows. Do not show success until the required backend response arrives; any optimistic display needs rollback on failure.

**Acceptance:** repeat a save, rating, follow, upload, and profile edit on a weak network. Each must clearly communicate pending/success/failure, avoid duplicate mutations, and retain recoverable input.

## 3. Motion, layout, and accessibility polish

The welcome orbit and auth decorations already animate; the segmented control also uses Reanimated. The app does not need more continuous animation behind ordinary reading screens.

### Motion worth adding

These timings are proposed design defaults, not measured performance claims.

| Element             | Suggested treatment                                                                                                                  |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Bookmark and heart  | Brief 120–180 ms scale/color response; return to a stable selected state.                                                            |
| Half-star picker    | Crisp selected-star feedback and one restrained selection haptic per change. Preserve explicit half-step controls and labels.        |
| Rating/profile save | Brief confirmation transition with stable layout; no celebration overlay.                                                            |
| Sheets              | Consistent opening, dismissal, keyboard handling, and focus return using native navigation/modal behavior where available.           |
| Loading cards       | A small set of static skeleton shapes matching the real card; optional gentle fade into loaded content. No endless shimmer required. |
| Favorite reordering | Small position transition after the existing accessible move action. Dragging can wait.                                              |

Honor Reduce Motion, keep state changes understandable without animation or sound, and stop decorative work when screens are hidden/backgrounded. Do not replay entrance animations on every feed re-render. Reuse the installed Reanimated dependency. If adding `expo-haptics`, choose the installed Expo SDK's compatible version and rebuild native apps; it is not currently a dependency. See [Reanimated accessibility](https://docs.swmansion.com/react-native-reanimated/docs/guides/accessibility/) and [Expo Haptics](https://docs.expo.dev/versions/latest/sdk/haptics/).

### Layout changes with more value than extra animation

- Preserve producer credits, source attribution, rating counts, artwork, and meaningful introductions. Do not make the feed empty to make it “clean.”
- Keep Panchang for its established display roles. Labels/body copy need comfortable reading sizes; `shared/theme.ts` currently includes 8–12-point metadata sizes that deserve real-device review. Avoid essential information at the smallest sizes.
- Audit every icon-only control for a real spoken label and a generous touch target. Decorative icon glyphs should not become screen-reader text.
- Validate long titles, usernames, 500-character reviews, largest practical accessibility text, keyboard overlap, Android Back, and the bottom home-indicator area.
- Keep rounded card/group styles consistent across posts, library entries, profile sections, and settings. Retain the Studio's distinctive arrangement design.
- Show true missing data honestly. No invented scores, producer facts, release dates, rankings, or synthetic community engagement.

**Acceptance:** complete rating, saving, favoriting, posting, and settings navigation with VoiceOver and TalkBack; complete the same flows with Reduce Motion and large text enabled.

## 4. Make the first session and return visits rewarding

### Onboarding and the first destination

The current path asks for scenes, five artist follows, and five saves, then routes to Matches. That is a lot of investment before someone sees the app, and a new community may have no matches yet.

**Recommendation:** land completed accounts in **Feed**, with a short “Your profile is ready” confirmation and a next-step card. Keep Matches in its tab. Measure drop-off before changing the matching requirements; do not silently weaken save-based matching just to shorten setup.

Provide search during artist/track selection, allow optional photo/bio steps to remain optional, and preserve progress on interrupted signup. Explain why saves help matching in one sentence. Show truthful next steps rather than a multi-step tutorial overlay.

### Profile identity and feature explanations

- Offer a dismissible **Make this profile yours** checklist only to owners missing photo/bio/favorites. Completing one step should visibly improve their profile, not award a fabricated badge.
- Label the diary as **Private** in the owner-facing screen. It currently exists; public diary sharing is not required for launch.
- Add a short Rotation explanation accessible by tapping its heading/info control: how saves/comments contribute and why a new account has none. The matching explanation must continue to describe actual shared saves, not imply ratings drive it.
- Add photo removal to Edit profile so users can return to initials. Username changes can remain out of scope, but explain that the username is fixed.
- Keep “Saved tracks,” “Bookmarked posts,” favorites, and ratings visibly distinct. Add follow-management screens when people can no longer find accounts they followed.

## 5. Reliability and performance that users notice

| Finding / risk                                                                                                                                                                                             | Required completion work                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Private media URLs expire after five minutes in [`mediaDTO`](../functions/src/social-core.ts); current artwork fallback does not renew authorization itself.                                               | Refresh authorized media on expiry/retry through the existing account-scoped data layer. Do not make objects public or lengthen URLs indefinitely to conceal the problem. Test an uncached image after leaving a screen open for more than five minutes. |
| [`useDiary`](../src/data/diary.ts) reads the owner's complete saves and merges all subscribed ratings. Profile posts also render an expanding collection inside the profile scroll view.                   | Measure a heavy account, then bound profile previews and paginate full histories. Do not assume list virtualization also bounds database reads. Preserve the shared own-rating lookup used by track rows.                                                |
| [`readForYou`](../functions/src/for-you.ts) scans up to 120 entries from each of three sources, loads taste data, and performs additional lookups. The client can fetch several pages to populate reviews. | Measure reads and latency per screen open before claiming 50k-catalog readiness. Cache/reuse bounded results where appropriate; avoid concurrent duplicate refreshes.                                                                                    |
| For You pagination uses a timestamp-only cursor and strict `<` queries.                                                                                                                                    | Add deterministic tie handling across post/rating/release sources. Test more than 25 relevant items sharing a timestamp; current ordering needs regression coverage to ensure none are skipped.                                                          |
| Callable-read content is held in React state, while native Firestore collections have a different offline behavior.                                                                                        | Define which screens remain readable offline. Keep already-loaded content, show “You're offline” only when relevant, and make online-only mutations explicit. Do not claim full offline support without cold-start tests.                                |
| Tests cover significant domain/security behavior, but a successful type check does not prove native sign-in, photo permissions, export, or store build behavior.                                           | Test signed release builds on a physical iPhone and Android device, including background/restore, interrupted uploads, and switching accounts.                                                                                                           |

Add targeted operational metrics: signup/onboarding completion, first rating, publish completion, media processing failure/time, failed signed-image refresh, and support/report backlog. Existing rating/share/upload analytics are a starting point. Never add raw review/post text, eligibility answers, signed URLs, or credentials to telemetry. Recheck error scrubbing rather than assuming URL removal covers all sensitive content.

## 6. Public-launch blockers and verification gates

These are not requests to add warning screens everywhere. They are the controls and operational work that let a polished app remain trustworthy after strangers join.

### A. Make server controls match the intended audience and rollout

**Observed:** [`socialContext`](../functions/src/social-core.ts) explicitly permits onboarded users to publish without creation-switch, verified-email, or eligibility enforcement. `getSocialStatus` still returns rollout flags; the status response does not itself enforce publishing restrictions. Google/Apple authentication creates a Firebase session before the onboarding eligibility step.

**Required:** decide and document the launch access policy, enforce accepted policy/eligibility on the server, and make the creation/publication kill switches effective at mutation and publication boundaries. If verified email remains a product requirement, enforce it consistently. Confirm how incomplete/underage social-sign-in accounts are handled rather than treating the form as sufficient protection. Review the intended US teen audience and applicable store/privacy obligations with the responsible owner.

**Acceptance:** automated tests reject publishing without the required eligibility/consent, while suspended/deleting accounts and disabled publication remain blocked even if the client calls APIs directly. Review permitted numerical-rating behavior separately rather than disabling all taste features indiscriminately.

### B. Restore an operational abuse-response path

**Observed:** reporting, blocking, report-resolution, suspension, and some admin deletion APIs remain. There is no current `app/moderation.tsx` route; the visible settings UI no longer supplies a report-handling console. Immediate publication is now intentional.

**Required:** provide an admin-only report inbox with target context, removal/suspension actions, resolution records, and handling for posts, comments, reviews, and profiles. Confirm that every report type has an actual removal/remediation path. Assign a real operator, response procedure, escalation/contact route, and proportionate content filtering/spam controls. Do not assume automatic publication requires restoring manual preapproval for every post; the missing piece is effective protection and response.

Google requires UGC policies and appropriate moderation/reporting/blocking controls; Apple's UGC rules include filtering, reporting with timely responses, blocking, and contact information. These are acceptance gates, not a guarantee of store approval. [Google Play UGC policy](https://support.google.com/googleplay/android-developer/answer/9876937?hl=en), [Apple review guidelines, §1.2](https://developer.apple.com/app-store/review/guidelines/#user-generated-content).

### C. Finish the account-deletion and policy surfaces

**Observed:** in-app deletion and queued cleanup already exist. [`hosting/community.html`](../hosting/community.html) still describes videos, drafts, and moderator approval, while current in-app policy says content publishes immediately. The reviewed hosting files do not contain a dedicated external deletion-request page. Apple sign-in is implemented, but I did not find an Apple authorization-token revocation path in deletion code.

**Required:** publish accurate privacy/community terms, a clearly discoverable web deletion-request route, retention/cleanup expectations, and support contact details. Verify recent reauthentication and end-to-end deletion for password, Google, and Apple accounts, including applicable Apple token revocation. Verify cleanup completes rather than treating a queued request as proof of deletion.

Google's account-deletion policy requires an external web resource for applicable apps as well as the in-app path. Apple's guidance covers account deletion and Sign in with Apple revocation. [Google deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en), [Apple deletion guidance](https://developer.apple.com/support/offering-account-deletion-in-your-app/).

The website contact is currently `hello@earlyworld.app`; in-app support uses `earlyworldofficial@gmail.com`. Verify both work or choose one supported address. Reconcile the privacy text with Firebase Analytics, Crashlytics, cloud media processing, and actual retention. Complete store privacy/Data safety disclosures from the implemented behavior.

### E. Ship one reproducible release

The current checkout has substantial uncommitted changes, including sign-in and the video removal. Use a reviewed, tagged commit for both the native build and its compatible backend. Do not distribute whichever state happened to be on a laptop.

- Verify the resolved Android application ID and iOS bundle ID against Firebase and the actual store records; configuration supports environment overrides.
- Verify Google sign-in with the production/Play signing configuration and Apple sign-in on hardware, including canceled sheets, conflicting credentials, and account switching. Disable competing auth actions while one sign-in is active.
- Produce fresh production native builds with the current modules and without development UI. Test Android Back, photos/sharing permissions, and startup without Metro.
- Check live callable versions, indexes/rules, photo worker, cleanup schedules, and alert recipients against this release. Older deployment notes are historical evidence only.
- Publish functional support/privacy/deletion URLs, store screenshots, age/content declarations, and reviewer access instructions. Do not advertise removed video features.
- Wire actual install links into the site. [`hosting/post.html`](../hosting/post.html) currently offers a custom-scheme opener but no install fallback. Add store fallback and verify supported HTTPS app links/universal links; do not expose private post text in web previews.

## 7. Suggested delivery order

### Pass 1 — close journeys and launch blockers

Fix attachment display, saved-library access, policy navigation, blank initial error states, false website signup success, and publishing controls. Establish report handling, deletion web support, accurate policies, and provider-permission records. Keep broad public launch closed until these gates are satisfied.

### Pass 2 — make the experience coherent

Add the feedback system, processing visibility, discard protection, loading/error/empty states, private-diary labeling, profile completion, and a better first landing. Add listener finding if beta users cannot discover each other through real activity. Validate photo renewal and complete-library pagination.

### Pass 3 — polish and release verification

Add the small bookmark/like/rating motions, optional haptics, accessible sheets, readable typography, and image transitions. Test a release candidate on both mobile platforms, measure costs/performance, verify deployment state, and run an invited beta before the public rollout.

**Defer:** more continuous animation, automatic welcome pop-ups, extra themes, DMs, video reintroduction, advanced lists, public diaries, streaks, badges without meaning, and a large year-end recap project. None repairs a failed save or an inaccessible post attachment. Notifications can follow demonstrated demand.

## 8. Definition of ready

- [ ] A new listener can sign up, read policies, recover interruptions, finish setup, and find useful content without assistance.
- [ ] A listener can find a track, rate/review it, save it, pin favorites, browse the complete saved library, and see the correct profile changes.
- [ ] Posts support all promised attachment types and photo states; retries neither lose input nor duplicate publication.
- [ ] Every screen has intentional loading, empty, error, unavailable, and retry behavior where applicable.
- [ ] Signing out/switching accounts leaves no previous-user content, input, messages, or private image access in the new session.
- [ ] Reports reach an operator who can act; blocking works across feed, detail, profile, search, and recommendations.
- [ ] Deletion works end to end for all sign-in methods and has a functioning external request resource.
- [ ] Policies, website copy, rollout controls, provider permissions, and store declarations match the shipped app.
- [ ] Release builds pass real-device keyboard, safe-area, large-text, screen-reader, Reduced Motion, photo, sharing, weak-network, and lifecycle checks.
- [ ] A heavy-account test and an invited beta show acceptable latency, read costs, memory, crash behavior, and recovery; release owners record the results and unresolved limitations.

**A finished earlyworld should feel like a place where your taste is preserved and understood. The final layer is clarity and dependability, with just enough motion to make those interactions feel alive.**
