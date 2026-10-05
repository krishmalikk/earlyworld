# Test community

`scripts/test-community.ts` seeds 25 fake listeners with:

- bios and scenes
- saves, artist and listener follows
- track ratings and reviews, release ratings
- track comments
- optionally, an owner's Inbox: a direct message from a match, a message request and a group

The copy is original, written in the voice of underground rap communities (`scripts/test-community/content.ts`). The same input always produces the same community.

```sh
GCLOUD_PROJECT=earlyworld-6831c npm run social:test-community -- plan --owner <uid|email>
GCLOUD_PROJECT=earlyworld-6831c npm run social:test-community -- apply --production --owner <uid|email>
GCLOUD_PROJECT=earlyworld-6831c npm run social:test-community -- cleanup --production
```

## How it writes

- **Tags:** fake account IDs start with `test_`. Account, profile, username, rating, comment and conversation documents carry `testFixture: true`.
- **Saves and follows** are written like client writes, so the deployed triggers maintain:
  - save and follower counts
  - `savers`
  - activity
  - Rotation engagement
- **Ratings** reproduce `setTrackRating`'s aggregates. Their reviews are published directly rather than through moderation.
- **Matches** are recomputed for every fake account and the owner after the save triggers run.
- **Reruns** skip accounts that already exist. A username owned by a real account is never overwritten.

## Cleanup

1. Removes the tagged conversations from every member's inbox.
2. Deletes any match rows that point at fake accounts.
3. Hides the fake accounts immediately.
4. Queues each fake account for the deployed `processAccountDeletions` pipeline. That pipeline reverses saves, follows, ratings and comments, waits for triggers to settle, and removes the profiles; expect about one to two hours.

Rerun `cleanup` to check progress.

## Live record — October 5, 2026

Seeded `earlyworld-6831c` with the owner account `@krish`:

- 25 accounts, 619 saves, 247 track ratings (139 with reviews), 45 release ratings, 82 comments and 146 follows
- 8 of the follows point at the owner, and every fake account has matches
- the owner gained 8 matches and three Inbox conversations

Saves counters equal save documents. Rotation tiers appear after the nightly job.
