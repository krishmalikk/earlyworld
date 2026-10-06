# Marketing and launch plan

How earlyworld gets its first users, keeps them, and grows. It answers three questions: should we launch with no users, should we build a referral system, and where does engagement come from?

The findings below come from a deep-research pass (Oct 6, 2026). It covered 24 sources, extracted 105 claims and checked 25 of them adversarially; 20 held up and 5 were refuted. Claims are marked **verified** when they held up, and the plan marks where it goes beyond the evidence as **inference**.

## Short answers

- **Launch with no users?** No. Don't open to the public with an empty app. Launch narrow and dense: one scene, a small group of people who already know each other, and a launch moment that brings them in together.
- **Referral system?** Yes, but as invite gating and status, not cash or perks. Expect it to add to growth, not to be the engine of growth. A good k-factor is 0.15–0.25; k > 1 is rare.
- **Where does engagement come from?** Retention comes first, and invites build on it. Ratings, reviews and matches are the retention core. The share cards are the cheapest acquisition channel we have.

## What the research found

### 1. Start with one atomic network (verified, high confidence)

Every cold-start success studied launched into one small, dense group, then repeated the playbook:

- **Tinder** seeded one USC party of about 500 well-connected students, then repeated it party by party at other schools. The "95% used it daily" figure is an unaudited founder anecdote. ([Chen, _The Cold Start Problem_](https://andrewchen.com/wp-content/uploads/2022/01/ColdStartProb_9780062969743_AS0928_cc20_Final.pdf))
- **Fizz** launched at Stanford in July 2021. It reached 700+ users (about 10% of undergrads) in the first week and around 95% of undergrads by downloads within a year. ([Stanford case study](https://ethicsinsociety.stanford.edu/sites/ethicsinsociety/files/media/file/case_study_fizz1.pdf))
- **BeReal** threw campus parties where entry was free if you downloaded the app and added five friends. ([Contrary Research](https://research.contrary.com/company/bereal))

The pattern is the same each time: a social moment that gets a group of people who already know each other to join together. See also [Lenny's Newsletter on atomic networks](https://www.lennysnewsletter.com/p/atomic-network).

### 2. Launch spikes aren't retention (verified, medium confidence)

Fizz's paid ambassadors and launch events produced hundreds to about 2,000 downloads per campus on day one. Many of those students "downloaded and remained inactive or later deleted the app". A launch event builds the first network, but only the product keeps it. ([Stanford case study](https://ethicsinsociety.stanford.edu/sites/ethicsinsociety/files/media/file/case_study_fizz1.pdf))

### 3. Seed content openly, never with fake people (verified, high confidence)

- Reddit's founders posted links under made-up usernames until real users took over. Huffman said it "set the tone" and made the site "feel alive". It got Reddit through cold start; it didn't drive growth. ([Neowin](https://www.neowin.net/news/the-secret-to-reddits-early-growth-fake-accounts/))
- Fizz paid moderators about $500 a month to post 30–40 times a day as different personas. It drew ethics criticism in campus press and cost the app trust. ([Stanford case study](https://ethicsinsociety.stanford.edu/sites/ethicsinsociety/files/media/file/case_study_fizz1.pdf))

For earlyworld: seed ratings and reviews from real, named accounts (the founder and invited curators). The 25 `test_` accounts in live `earlyworld-6831c` must be removed before launch (see [test-community.md](test-community.md)).

### 4. Share cards are a proven free channel (verified, high confidence)

- **Receiptify**, a web app one person built, passed 1M uses within months in 2020. ([Studio for Creative Inquiry](https://studioforcreativeinquiry.org/project/receiptify))
- **Spotify Wrapped** got 1.2M+ Twitter posts in its first week in 2019, unpaid promotion from millions of users. It uses a story sequence at 9:16 that ends in a share prompt. ([Wikipedia](https://en.wikipedia.org/wiki/Spotify_Wrapped), [NoGood](https://nogood.io/blog/spotify-wrapped-marketing-strategy/))
- **Refuted:** the claim that Wrapped caused a 21% jump in Spotify downloads. That rise came in the holiday season and was only a correlation.

Our Orbit, Recap and Review cards (on the `share-cards` branch) already fit this pattern. They are a growth feature, not a nice-to-have.

### 5. Retention drives virality (verified, medium confidence)

- Andrew Chen: "the highest retention products have empirically shown to be the most viral". A daily user gives 30 chances a month to share; spammy invites wrecked Tagged and Hi5. ([Chen](https://andrewchen.com/more-retention-more-viral-growth/))
- BeReal went from about 20M daily users (Oct 2022, iPhone App of the Year) to under about 6M by March 2023, according to Apptopia estimates. Hype without a habit fades. ([Contrary Research](https://research.contrary.com/company/bereal))
- One analyst credits Letterboxd's stickiness mainly to user ratings and reviews. This is opinion, but it suggests our ratings are the retention core. ([Stat Significant](https://www.statsignificant.com/p/the-rise-and-potential-fall-of-letterboxd))

### 6. Referrals work, with modest numbers (verified, medium confidence)

- **Robinhood**'s waitlist let people move up the queue by referring friends. It reached about 1M waitlist signups before launch; those were signups, not active users.
- **Dropbox**'s "give storage, get storage" grew it from 100K to 4M users in 15 months, with referrals making up 35% of daily signups. The reward was material and cost Dropbox almost nothing; we have no equivalent.
- **Benchmarks** (Rahul Vohra's rule of thumb, about 2012): k of 0.15–0.25 is good, 0.4 great, about 0.7 outstanding. k > 1 is rare. ([Chen](https://andrewchen.com/how-to-design-a-referral-program/), [Saxifrage](https://www.saxifrage.xyz/post/k-factor-benchmarks))
- **Refuted:** that giving the inviter the larger reward performs better, and an "Adjust median k of 0.45" figure.

### Gaps the research didn't settle

There is no verified evidence on:

- D1/D7/D30 retention benchmarks for niche social or music apps
- push notification strategy
- live events and listening parties (Clubhouse, Stationhead)
- how Letterboxd or RateYourMusic launched
- TikTok and artist-partnership tactics
- whether status rewards (as opposed to material ones) produce useful k-factors

The plan below treats all of these as inference to test.

## The plan

### Phase 0: ready to launch (before anyone new is invited)

- Merge `share-cards` and `feature/messages` into `main`.
- **Push notifications** for DMs, message requests and new matches. Without push, a match can't bring anyone back.
- Make every card carry a way back in: an invite link or handle on the image, and a landing page on Hosting. The current `INVITE_URL` points at an empty Hosting root.
- Remove the 25 `test_` accounts.
- Turn on analytics events for the metrics below.

### Phase 1: pick the atomic network (inference)

Choose **one** of these, whichever we have the strongest personal connection to:

- one city's underground rap scene
- one SoundCloud collective's fanbase
- one Discord server or subreddit
- one campus

The test: can we name 30–50 people in it who already talk to each other? Our "rare saves" matches only work when people's taste overlaps, so density inside one scene matters more for us than for most apps.

### Phase 2: seed, then closed beta (inference built on findings 1, 3 and 6)

1. **Seed openly.** The founder and 5–10 invited curators from the chosen scene rate and review its catalog under their real handles, so the first visitors see real taste, not an empty app.
2. **Founding listeners.** Invite 30–50 well-connected people from the scene. Each gets a small number of invites (for example 3), and every account they bring in is tagged with its inviter.
3. **Waitlist for everyone else,** Robinhood style. People pick their scene on signup and move up the queue by inviting friends. When a scene's waitlist is full, it's ready for its own launch.
4. **Status, not perks.** Give out a "founding listener" or "early" badge on profiles and cards. It fits the brand (being early is the point) and costs nothing. Whether it beats material rewards is unverified, so measure it.

### Phase 3: the launch moment (inference built on finding 1)

Run one in-person or online launch event with an artist or producer from the scene. The natural fit is a staff-run **listening party** for a new drop (see [listening-parties.md](listening-parties.md)). The BeReal-style rule: to get in, install the app and follow or match with five people. Afterwards, everyone gets a recap card to share.

Expect a download spike, and judge the event by the retention a week later, not by day-one installs (finding 2).

### Phase 4: expand one scene at a time

Open the next scene only when the first one shows real retention. Set the threshold from our own first cohorts, since the research found no verified benchmark. Repeat the playbook: curators, founding listeners, waitlist, launch moment.

### Channels, in order of expected cost-effectiveness (inference)

1. **Share cards** to IG Stories and TikTok (9:16, ending with a share prompt). Run seasonal pushes: a monthly Recap, and a year-end "your year in the underground".
2. **Artists and producers in the scene:** official listening parties, and claimed profiles with a badge. It costs relationships, not money.
3. **Discord and Reddit communities** where the scene already talks. Post as the founder, openly; share cards and party invites rather than ads.
4. **TikTok/Reels from the founder account:** "rare save of the week", rating clips, match stories.
5. **Music blogs and newsletters,** once there's a story to tell, such as the first big party.

## Metrics

| Metric                                                           | Why                                                                                                                                 |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| D1 / D7 / D30 retention by weekly cohort and by scene            | Decides when to open the next scene                                                                                                 |
| % of new users with at least one match in their first week       | Matches are the "aha" moment; with no match, the app is a catalog                                                                   |
| Ratings and reviews per weekly active user                       | Retention core (finding 5)                                                                                                          |
| Power-user curve (days active out of 7 and out of 30)            | [a16z](https://a16z.com/the-power-user-curve-the-best-way-to-understand-your-most-engaged-users/): shows whether a habit is forming |
| Invites sent, invites accepted, k-factor                         | Compare with 0.15–0.25                                                                                                              |
| Card shares per weekly active user, and installs from card links | Tests the cheapest channel                                                                                                          |
| Party RSVP → attended → still active 7 days later                | Tests whether live events retain people, not just spike installs                                                                    |
| Reports per 1,000 messages                                       | Moderation load as we grow                                                                                                          |

## Open questions

- Which atomic network do we start with?
- What retention level unlocks the next scene?
- Do artist-hosted parties bring retained users, or one-off spikes like Fizz's launch events?
- Do status rewards achieve a useful k-factor with no material reward behind them?
