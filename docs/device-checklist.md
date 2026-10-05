# Native smoke test

Run against your Firebase development project and installed EAS development build.

For the October 1 social build, the former Add track tab is Create. Catalog creation checks below apply to administrator tooling. Profile text/photos, written reviews and comments now require approval; test their pending and approved states separately. Catalog tracks still have no player; approved user-uploaded videos do.

1. Sign up. Quit after username reservation. Reopen and verify onboarding resumes at photo/bio. Try claiming the same lowercase username from another account; it must fail inline.
2. Skip photo/bio, select two scenes and five artists, and save five tracks. Complete onboarding. Matches is the first destination; Rotation remains empty. With another account sharing a rare save, verify the shared-track explanation appears after the fifth save or nightly refresh.
3. Search for an artist, producer, and scene. Open each entity and a track. Confirm credits stay prominent, no player is present, original release links open outside the app, and saving updates other subscribed screens.
4. Open the feed and matches, background and foreground the app repeatedly, then leave the screens. Use the emulator/Firestore debugger to confirm listener counts do not accumulate.
5. After loading the catalog, kill the app, disable networking, and reopen. Cached catalog/profile/saves should render. Queued native writes should synchronize after reconnecting. Callable operations show network errors instead of fabricated success.
6. Upload an avatar, verify its 512px resize and Storage ownership, edit bio, comment, delete your own comment, follow another user, and observe their save in the live feed.
7. Add the same public URL in short/canonical forms and from two accounts concurrently; only one track ID should exist. Try private/invalid/playlist URLs; they must fail.
8. Add a track with a known user-entered producer. If Genius matches, inspect credits and attribution; the entered producer must stay unchanged. If unmatched, no extra Credits card appears.
9. Run scheduled functions in the emulator or from the authenticated Google Cloud console. Inspect earned tiers and subsequent decay. Never initialize or edit client scores to make the UI look populated.
10. Verify Analytics events and a controlled Crashlytics test in a development build with collection enabled; release debug settings before shipping.

## Ratings beta

1. Publish a ½-star rating, then edit it to 4½ stars with a 500-character review. Verify count stays one, the average changes, and the original publication date stays fixed.
2. Clear only the review, then delete the rating. Check profile counts, community score, track review list, and feed update without changing saves or favorites.
3. Choose four favorites, reorder/replace/remove them, and verify the same order on another account's view of the profile.
4. Rate a track below four stars; it belongs in recent history but not Highest Rated. Test tied scores and more than 25 entries in histories/reviews.
5. Follow two test listeners who rate the same song. Both opinions should appear; editing must not duplicate or bump a card, and deletion removes it.
6. With a draft open, disable networking and attempt to publish. Verify a failure leaves the draft intact, no success is invented, and retry succeeds after reconnecting. Reopen cached ratings offline.
7. Switch accounts and confirm previous-account stars/drafts/favorites do not leak into the new account. Background/foreground rating histories and inspect listener cleanup.
8. On a physical iPhone, test the software keyboard, long titles/reviews, larger text, VoiceOver reading of half stars, and favorite reorder controls.

## Posts and uploaded videos (pending physical-device validation)

1. Rebuild iOS and Android development apps for Expo Video. Confirm exactly five tabs and that `/add` redirects to Create. Keep public feature switches disabled; use explicitly authorized internal accounts.
2. Test post text, ordered photos, each catalog attachment type, scenes and preview. Interrupt/cancel uploads, retry, restart the app, and switch accounts; files/drafts must survive failures without crossing accounts or duplicating submissions.
3. Test silent, rotated, portrait, square and landscape clips, 5/60-second boundaries, oversized and invalid files. Confirm processing, pending and rejection states before any public visibility. Check sources are removed only after processing and ambiguous job dispatches do not duplicate processing charges.
4. Approve/reject posts, complete videos, comments and text revisions. An approved edit retains its publication position and the old approved text remains visible until the revision is approved. Delete during processing and verify eventual object cleanup.
5. Check Feed filters, Explore/Following/scene filters, profile sections and private bookmarks beyond 25 items. Block in both directions; alternate post/profile/review/discussion routes must not reveal blocked content.
6. Rapidly swipe videos on a real iPhone and Android device. Verify one active audio source, at most one next clip prepared, session mute choice, contain framing, seeking, comment/navigation/background pauses, and recovery after private URLs expire.
7. Test weak networks, large text, VoiceOver/TalkBack, keyboard dismissal, account switching and sustained scrolling memory. Confirm failures preserve drafts and never appear as successful publication.
8. Verify recent-authentication account deletion, removal of authored media/content and counter reconciliation in a disposable test environment. Confirm budgets, operational alerts, moderator coverage and policy review before enabling the public audience.
