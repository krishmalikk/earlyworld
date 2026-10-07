# Marketing and launch plan

How earlyworld gets its first users, keeps them, and grows. It answers three questions: should we launch with no users, should we build a referral system, and where does engagement come from?

The findings below come from a deep-research pass (Oct 6, 2026). It covered 24 sources, extracted 105 claims and checked 25 of them adversarially; 20 held up and 5 were refuted. Claims are marked **verified** when they held up, and the plan marks where it goes beyond the evidence as **inference**. A second pass (also Oct 6) looked at how about 20 apps ran their pre-launch waitlists; see finding 7.

## Short answers

- **Launch with no users?** No. Don't open to the public with an empty app. Launch narrow and dense: one scene, a small group of people who share taste, and a launch moment that brings them in together. Keep the real catalog and openly labeled curator ratings so the first people don't arrive to an empty app.
- **Referral system?** Yes, but as invites from members and a shared scene goal, not a ranked leaderboard, cash or perks. Expect it to add to growth, not to be the engine of growth. A good k-factor is 0.15–0.25; k > 1 is rare.
- **Waitlist: referral-ranked or first come, first served?** Neither. People join by scene, and a scene opens when enough of its listeners have signed up. There's no personal position number.
- **Where do we send people before launch?** One link we own (`earlyworld.app/get`). It goes to the website waitlist until pre-orders exist, then to the App Store or Google Play depending on the phone.
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

### 7. How other apps ran pre-launch waitlists (second pass, mostly primary sources)

| App              | How people joined                                 | How they got in                                                | What happened                                                                                                                                                                                              |
| ---------------- | ------------------------------------------------- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Robinhood        | Email on the website                              | Referrals moved you up the queue                               | About 1M signups, about 2/3 from referrals. The pull was free trading ([HuffPost](https://www.huffpost.com/entry/startup-insider-the-story_b_7976446))                                                     |
| Mailbox (2013)   | Reserved a spot in the iOS app                    | Strict signup order, position shown                            | 1M in 6 weeks; people saw 20k+ ahead, uninstalled and left 1-star reviews. Queue dropped after 10 weeks ([Econsultancy](https://econsultancy.com/mailbox-app-how-to-unintentionally-alienate-users/))      |
| Superhuman       | Website, then a survey                            | Survey screening, plus a 1:1 onboarding call                   | 275k waiting against about 15k users: slow, but strong product fit ([TechCrunch](https://techcrunch.com/2020/02/28/superhuman-ceo-rahul-vohra-on-waitlists-freemium-pricing-and-future-products/))         |
| HEY (2020)       | Emailed a story about their email                 | Hand-chosen batches; each invite code worked for 3 accounts    | About 40k on the list. Apple first rejected the app because it did nothing for people without an account ([MacRumors](https://www.macrumors.com/2020/06/22/apple-approves-hey-with-free-14-day-accounts/)) |
| Clubhouse        | Reserved a username in the app                    | Any member with your number in their contacts could let you in | About 10M waiting when it opened. Invites sold on eBay; usage later fell sharply ([TechCrunch](https://techcrunch.com/2021/07/21/clubhouse-invite-open-to-everyone-exits-beta/))                           |
| Monzo            | In-app queue                                      | Signup order, plus "golden tickets" that skipped the line      | Golden tickets reportedly about 40% of 2017 signups (unverified) ([Monzo](https://monzo.com/blog/2018/01/10/golden-tickets-are-back))                                                                      |
| Lapse (2023)     | Downloaded the app                                | Had to invite 5 friends to unlock it                           | Reached #1 in the US App Store, but was criticised as spammy ([TechCrunch](https://techcrunch.com/2023/09/26/photo-sharing-app-lapse-hits-top-of-the-app-store-by-forcing-you-to-invite-your-friends/))    |
| Poparazzi (2021) | TikTok bio linked to the App Store pre-order page | No gate; installed itself on launch day                        | #1 at launch, 5M installs in its first year, shut down in 2023 ([TechCrunch](https://techcrunch.com/2021/05/26/poparazzi-hypes-itself-to-the-top-of-the-app-store))                                        |
| tbh / Gas        | School-specific Instagram accounts                | Opened one school at a time                                    | About 40% of the first school downloaded it ([Wikipedia](https://en.wikipedia.org/wiki/Tbh))                                                                                                               |
| Letterboxd       | Private beta launched at a conference (2011)      | Invite only                                                    | Opened publicly in 2013 ([Letterboxd](https://x.com/letterboxd/status/1845960272696992223))                                                                                                                |

What this means for us:

- **Referral-ranked queues worked when people already wanted the product badly** (free trades, 1GB of email storage). We don't have that pull yet.
- **Leaderboards get gamed.** Harry's said fraud was heaviest among people competing for the top reward tier. It capped signups at 2 per IP address and treated bounced emails as fake ([tim.blog](https://tim.blog/2014/07/21/harrys-prelaunchr-email/)).
- **A visible position in a long queue backfires** (Mailbox). Long waits also kill conversion: free signups convert at about 50% when released within a month and under 20% after three months, according to self-reported founder data ([Lenny's Newsletter](https://www.lennysnewsletter.com/p/what-is-good-waitlist-conversion)).
- **The gates that worked for social apps made sure your people were already there:** Clubhouse let members admit people from their contacts, Lapse made you bring friends, and tbh, Gas and Fizz opened one school at a time. For us, a scene plays the role of a school.

Platform facts:

- **Gated apps:** Apple approves invite-only apps. Guideline 2.1 requires a demo account for App Review. An app that does nothing for someone who's locked out risks rejection (HEY). Contact invites must be picked one person at a time, with nothing pre-selected (5.1.2(v)). ([Apple guidelines](https://developer.apple.com/app-store/review/guidelines/))
- **Pre-orders:** App Store pre-orders can open 2–180 days before release and Google Play pre-registration up to 90 days. Both install the app automatically on launch day. On iOS, `AppTransaction.preorderDate` identifies people who pre-ordered. Pre-orders need a build that has passed App Review and a firm date (the review requirement is unverified). ([Apple](https://developer.apple.com/app-store/pre-orders/), [Google Play](https://support.google.com/googleplay/android-developer/answer/9859047))
- **TestFlight:** up to 10,000 external testers through a public link; builds expire after 90 days. ([Apple](https://developer.apple.com/testflight/))

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

### Phase 0: ready to launch

- Merge `share-cards` and `feature/messages` into `main`.
- **Push notifications** for DMs, message requests and new matches. Without push, a match can't bring anyone back.
- **Seed data:**
  - Keep the real catalog, and ratings and reviews from real named accounts (the founder and openly labeled curators).
  - Remove the 25 `test_` accounts. On an app built around matching, a match with someone who doesn't exist is worse than an empty app (finding 3).
- **Waitlist access:** people still waiting can download the app, browse and rate tracks, but can't match or message. This keeps App Review happy (finding 7). Give App Review a demo account.
- **Invites and the scene gate in the backend:**
  - each member gets 3–5 invite codes
  - every account records who invited it
  - every scene has a signup count and an open/closed flag
- Make every card carry a way back in: an invite link or handle on the image, and a landing page on Hosting. The current `INVITE_URL` points at an empty Hosting root.
- Turn on analytics events for the metrics below.

### Phase 1: before the App Store (inference built on finding 7)

**One link everywhere.** TikTok and Instagram bios, posts and cards all point at `earlyworld.app/get`, a Firebase Hosting route we own. A Linktree adds a tap and loses people, and a direct store link only works for one platform.

| Stage                      | iPhone              | Android               | Desktop                                              |
| -------------------------- | ------------------- | --------------------- | ---------------------------------------------------- |
| Before a build is approved | Website waitlist    | Website waitlist      | Website waitlist                                     |
| Pre-orders live            | App Store pre-order | Play pre-registration | Website with both store buttons and the scene signup |
| After launch               | App Store           | Play Store            | Website                                              |

Tag the link with its source (`?src=tiktok`) so the route can count clicks per channel. Because we own the link, it can change destination without anyone editing a bio.

**The website waitlist** asks for:

- an email (confirmed by a link, to stop fake signups)
- a username to reserve
- their scene
- optionally a SoundCloud profile and 3 rare tracks they love

The tracks tell us which scenes have real taste behind them, and they give us content to post.

**No position number, no leaderboard.** Waitlisters see their scene's progress instead: "Your scene opens at 50 listeners. 31 so far. Share your link to get it there." Their share link counts toward the scene, not toward a personal rank. Everyone wins together, so there's nothing to gain by gaming it.

**Pre-orders vs the website.** Once pre-orders are live, the link sends phones to the store, which is the least effort for them. The trade-off: the stores give us a count, not names or emails, and no scene. Pre-orders don't show up in scene counts until launch day, so before launch the counter shows fewer people than are actually interested. The website stays available for anyone who wants "tell me when my scene opens".

### Phase 2: pick the first scenes and seed them (inference)

1. **Let the waitlist choose.** Open the 1–2 scenes with the most signups and the most rare tracks submitted. Don't guess them in advance.
2. **Seed openly.** The founder and a few curators rate and review those scenes' catalog under their real handles before launch.
3. **Hand-pick a few** artists, producers and standout reviewers from those scenes for the first day, as Superhuman did.

### Phase 3: launch day (inference built on findings 1 and 7)

- **Who gets in:** everyone in the opened scenes, everyone who pre-ordered (identified on iOS by `preorderDate`), and the hand-picked people. Together they're the **founding listeners**, with a badge on their profile and cards.
- **Pre-orderers** pick their scene the first time they open the app.
- **Every member** gets 3–5 invites. Anyone a member invites skips the wait, the way Clubhouse let members admit people. This builds the well-connected group over time; we don't need to know them in advance.
- **A launch moment:** a staff-run listening party for a new drop with an artist from the first scene (see [listening-parties.md](listening-parties.md)). Afterwards, everyone gets a recap card to share.

Expect a download spike, and judge launch day by retention a week later, not by installs (finding 2).

### Phase 4: open scenes in weekly batches

- Each week, open the scenes that have reached their signup goal, plus any scene the founder chooses to open by hand.
- **Keep any wait under about 4 weeks.** After that, conversion drops sharply (finding 7). If a scene stalls, open it anyway, or merge it with a neighbouring scene.
- Open faster or slower depending on retention in the scenes already open. Set the threshold from our own first cohorts, since the research found no verified benchmark.

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
| Waitlist signups per scene, and `/get` clicks by source          | Shows which scenes to open and which channels work                                                                                  |
| Share of waitlisters active 7 days after their scene opens       | Shows whether the waitlist turns into active users (about 50% if released within a month, finding 7)                                |
| Pre-orders vs website signups, compared by retention             | Which pre-launch path brings people who stay                                                                                        |
| Card shares per weekly active user, and installs from card links | Tests the cheapest channel                                                                                                          |
| Party RSVP → attended → still active 7 days later                | Tests whether live events retain people, not just spike installs                                                                    |
| Reports per 1,000 messages                                       | Moderation load as we grow                                                                                                          |

## Open questions

- How many signups should a scene need before it opens (50 is a placeholder)?
- Do pre-orderers stay active as well as website signups, given we know nothing about their scene?
- What retention level unlocks the next scene?
- Do artist-hosted parties bring retained users, or one-off spikes like Fizz's launch events?
- Do status rewards achieve a useful k-factor with no material reward behind them?
