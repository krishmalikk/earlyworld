# Native smoke test

Run against your Firebase development project and installed EAS development build.

1. Sign up. Quit after username reservation. Reopen and verify onboarding resumes at photo/bio. Try claiming the same lowercase username from another account; it must fail inline.
2. Skip photo/bio, select two scenes and five artists, and save five tracks. Complete onboarding. Matches is the first destination; Rotation remains empty. With another account sharing a rare save, verify the shared-track explanation appears after the fifth save or nightly refresh.
3. Search for an artist, producer, and scene. Open each entity and a track. Confirm credits stay prominent, platform playback works, and saving updates other subscribed screens.
4. On a SoundCloud and a YouTube track, explicitly start playback and listen naturally past 60%. Check both entity stats in the Firebase console. Seek near the end on another track; no listen should be recorded. Repeat a qualifying listen within the same hour; the counter must stay unchanged.
5. Put the app in the background during playback. Audio should stop when the WebView unmounts. Resume and reopen the player; a new explicit interaction is required.
6. Open the feed and matches, background and foreground the app repeatedly, then leave the screens. Use the emulator/Firestore debugger to confirm listener counts do not accumulate.
7. After loading the catalog, kill the app, disable networking, and reopen. Cached catalog/profile/saves should render. Queued native writes should synchronize after reconnecting. Callable operations show network errors instead of fabricated success.
8. Upload an avatar, verify its 512px resize and Storage ownership, edit bio, comment, delete your own comment, follow another user, and observe their save in the live feed.
9. Add the same public URL in short/canonical forms and from two accounts concurrently; only one track ID should exist. Try private/invalid/playlist URLs; they must fail.
10. Add a track with a known user-entered producer. If Genius matches, inspect credits and attribution; the entered producer must stay unchanged. If unmatched, no extra Credits card appears.
11. Run scheduled functions in the emulator or from the authenticated Google Cloud console. Inspect earned tiers and subsequent decay. Never initialize or edit client scores to make the UI look populated.
12. Verify Analytics events and a controlled Crashlytics test in a development build with collection enabled; release debug settings before shipping.
