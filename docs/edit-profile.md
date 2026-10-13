# Edit profile

Listeners can change their profile after onboarding from one Edit profile screen. It covers the photo, bio and scenes. Changes publish as soon as they are saved; there is no review step. A new photo appears once it finishes processing, usually within a minute or two.

## What can change

| Field                     | Editable | Path                                                                                                                 |
| ------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------- |
| **Photo**                 | Yes      | Upload ticket → Storage → processing → `submitProfileText({ bio, photoMediaId })` → published when processed         |
| **Bio** (160 characters)  | Yes      | `submitProfileText` publishes immediately, or with the photo when one is processing.                                 |
| **Scenes** (2–12)         | Yes      | Direct owner write to `users/{uid}.scenes`. `firestore.rules` checks the fixed scene list and the two-scene minimum. |
| **Username**              | No       | `reserveCommunityUsername` rejects a second name and the rules lock `usernameLower` once set.                        |
| Counts, Rotation, matches | No       | Server-owned.                                                                                                        |

## Photo pipeline

The pipeline already exists for onboarding step 2 (`app/onboarding.tsx`). Edit profile reuses it.

1. **Pick:** `expo-image-picker` with a square crop, then `expo-image-manipulator` resizes to 512px JPEG at 0.8 quality. Both are installed, so no native build is needed.
2. **Ticket:** `authorizeProfilePhoto({ id, bytes })` (`functions/src/social-account.ts`) requires the `uploads` switch, a file under 2 MB, and at most 10 tickets per user per day. It returns `social-staging/{uid}/profile_{uid}/{mediaId}`.
3. **Upload:** `storage.rules` only accepts the exact byte count and MIME type on an unexpired owner ticket. Originals are never readable by clients.
4. **Process:** `receivePostMedia` (`functions/src/social-media.ts`) revokes the provider download token and queues normalization. The media document becomes `ready`.
5. **Submit:** `submitProfileText({ bio, photoMediaId })` writes one revision (`_textSubmissions/{hash(profile:uid)}`) and calls `publishSubmission` (`functions/src/social-publish.ts`).
6. **Publish:** without a photo, or once the photo is `ready`, the revision sets `bio`, `avatarMediaId` and clears `avatarUrl` on `users/{uid}`. While the photo processes the revision stays `pending`; `processPostMedia` → `advancePost('profile_{uid}')` publishes it when processing finishes. If processing fails, the bio still publishes and the revision records a reason asking for another photo.
7. **Display:** the `profile` community read and post authors sign `avatarMediaId` into a URL that expires after five minutes. `Profile`, `UserLine` and `PostCard` render it through `Artwork`, which falls back to initials.

## Implementation

- **Entry:** the pencil on your own profile (`src/components/Profile.tsx`) opens `app/edit-profile.tsx`, titled Edit profile. It replaces the old inline bio editor.
- **Shared helper:** `src/data/profile-photo.ts` holds `pickProfilePhoto` and `uploadProfilePhoto`. Onboarding and Edit profile both use it.
- **One submission:** a new submission replaces a revision still waiting on its photo. The screen prefills the bio from that revision when there is one, otherwise the published bio. A bio-only change resends the processing photo, so neither change is lost.
- **Saving:** scenes are written directly to `users/{uid}`; the photo and bio go to `submitProfileText` together. The Save changes button stays disabled with fewer than two scenes or no changes.
- **Processing state:** while a photo processes, Edit profile says so and the profile's submissions list shows "Photo & bio update · Processing". `readCommunity` (`textSubmissions`) also returns a five-minute `photoUrl` for a pending revision whose photo is ready. A failed photo's reason shows on Edit profile.
- **Uploads switch:** `getSocialStatus` now returns `uploads`. While it is off, the screen hides Change photo and says photo changes open when community uploads are enabled. Production `uploads` was turned on 2026-10-12. Post photos and videos also need the `creation` switch (see [posts and videos](posts-and-videos.md)).
- **Deploy:** the `uploads` status field and the pending-photo preview are Functions changes. `getSocialStatus` and `readCommunity` were deployed to `earlyworld-6831c` on 2026-10-12 from the uncommitted `edit-profile` branch; redeploy from `main` after merging.

## Limitations

- **No photo removal.** Nothing clears `avatarMediaId`; removal needs a server change.
- **Signed photo URLs last five minutes.** They cache poorly, and share cards still draw initials (`src/components/share/ReviewCard.tsx`).
- **Usernames are fixed.** Changing one needs a server function that releases the old reservation, plus a rules change. Out of scope.

## Verification

- `npm run check`.
- `npm run test:social` (Firestore emulator, Java 21+) covers immediate publishing and a profile photo publishing after processing.
- On a device with uploads enabled: change the photo and bio, and confirm the bio appears immediately and the photo appears on the profile, user rows and posts after processing.
- Change scenes and confirm the rules reject fewer than two.
