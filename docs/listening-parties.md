# Listening parties

A listening party is a scheduled group chat built around a new drop. People RSVP, get a countdown, press play on SoundCloud together at the same second, and react track by track. Afterwards they get a recap card to share.

It builds on [Messages](messages.md): the same realtime chat, callables, moderation and blocking, scaled from a 20-person group to a public room for one event.

## Why it fits earlyworld

- **It's a reason to show up at a specific time.** In the underground, a drop is an event. Snippet culture, "it's out!!" posts and first-listen reactions already happen on Reddit and Discord; this gives them a home that's tied to the catalog.
- **It deepens "being early".** Attending a party, and rating the tape in its first hour, becomes part of someone's history ("I was at the first listen").
- **It reuses what exists:**
  - releases with ordered tracklists (`releases/{id}.tracks`)
  - ratings and reviews
  - scenes and follows
  - the messaging rules and moderation
  - share cards
- **No audio licensing is needed.** earlyworld still doesn't play audio; everyone presses play on the source at the same moment.

## The experience

### 1. Before: the announcement
- A host creates a party: the **drop** (a catalog release or track, or an announced upcoming drop not in the catalog yet), a **start time**, scene tags and a short description.
- The party appears:
  - as a card in the Feed for followers of the host, the artist and the producer
  - in Discover under "Upcoming parties", filtered by scene
  - on the artist's and producer's profiles
- People tap **RSVP**. They can see the count and which of the people they follow or match with are going.
- RSVP'd listeners get reminders 1 hour and 5 minutes before the start. These need push notifications; until push ships, the Inbox shows the reminders.

### 2. Lobby (opens 15 minutes before)
- The chat opens. A big countdown sits at the top, synced to server time.
- Pinned at the top: the tracklist, the cover, and an "Open on SoundCloud" button.
- People drift in and chat. Everyone has their own pre-drop rating: "Predict the tape", ½–5★, private until the end.

### 3. Live: the drop
- **Start:** at T-0 everyone gets a synced "3… 2… 1… PLAY" banner, then the source opens. Playback stays outside the app.
- **Now playing:** the room has a "now playing" track that advances by track durations from the shared start time. The host can nudge it back or forward if the room drifts.
- **Per-track reactions:** under the current track, a strip of reaction buttons (🔥, 🌀, 😮‍💨, skip) shows live counts.
- **Rating on the spot:** a quick ½–5★ slider for each track. These become real earlyworld ratings, flagged "rated live", so they count toward the community average. The flag lets the app show "rated during the first listen".
- **Chat:** text and shared tracks, as in Messages. Slow mode is on by default: one message per 5 seconds per person, adjustable by the host.
- **Live stats** in the header: attendees and the top-reacted track so far.

### 4. After: the afterparty
- When the last track ends, the room becomes the afterparty for 24 hours.
  - **Party results:** the most-reacted track, the room's average for each track, the room's rating for the whole tape, and predicted vs actual.
  - **A prompt to write your review** while it's fresh, using the existing rating editor.
- **Party recap share card**, a new card that uses the share-card system:
  - the cover as a moon
  - "First listen · Oct 18, 2026 · 214 listeners"
  - the room's top track and your own top track
  - your rating vs the room's
- **After 24 hours** the party becomes a read-only archive on the release page ("Listening party · 214 listeners · 4.3★ room score"), and the chat history stays readable for attendees.

## Who can host

| Phase | Hosts | Visibility |
| --- | --- | --- |
| v1 (beta) | Moderators and admins only; staff schedule parties for drops they know about | Public, open to everyone eligible |
| v2 | Any eligible listener whose account is in good standing and above a minimum age | Private (people they invite, followers, matches) or public (scene discovery, needs moderator approval) |
| v3 | Claimed artist and producer profiles | Official parties, badged "Hosted by Che" and pinned on the release |

The host can:
- pin a message
- set slow mode
- remove a message
- remove a person from the party
- nudge "now playing"
- end the party early

Moderators can do all of that in any party.

## How it works

### Data model

Parties are a new collection. Messages from 20-person groups fan out to every member's inbox row, but parties have hundreds of attendees, so their messages **don't fan out**. Attendees listen to the party room directly.

| Path | Contents | Client access |
| --- | --- | --- |
| `parties/{pid}` | `hostUid`, `title`, `description`, `scenes[]`, `drop: {kind: 'release'\|'track'\|'upcoming', id?, title, artistName, artworkUrl, tracks[]}`, `startsAt`, `lobbyAt`, `endsAt`, `status: 'scheduled'\|'lobby'\|'live'\|'after'\|'archived'\|'cancelled'`, `visibility: 'public'\|'private'`, `rsvpCount`, `attendeeCount`, `nowPlaying: {index, startedAt}`, `slowModeSeconds`, `pinned`, `results` | Public parties readable by signed-in users; private parties by invitees only |
| `parties/{pid}/members/{uid}` | `rsvpAt`, `joinedAt`, `role: 'host'\|'member'`, `removed`, `prediction` | Owner reads their own; the server writes them |
| `parties/{pid}/messages/{mid}` | The same shape as conversation messages: `uid`, `kind`, `body`, `trackId`, `createdAt`, `removed` | Members who joined and aren't removed |
| `parties/{pid}/reactions/{trackIndex}` | Counts per reaction, updated by the server in shards | Readable by members |
| `users/{uid}/parties/{pid}` | An RSVP row for "Upcoming" lists and reminders | The owner |

**Message reads.** Rules allow reading messages when `exists(parties/{pid}/members/{uid})` and the member isn't removed, the same membership-check pattern Messages uses. Clients listen to the newest 100 messages, ordered by `createdAt`.

**Hot counters.** Reactions and live counts change hundreds of times a minute, so they use sharded counters: N shard docs per track, summed on read. That avoids Firestore's limit on how often a single document can be written. Clients send reactions in batches every couple of seconds.

### Callables (`functions/src/parties.ts`)

- `createParty`, `updateParty`, `cancelParty`: host only; public parties go through moderator approval.
- `rsvpParty` / `unrsvpParty`: write the member doc and `users/{uid}/parties/{pid}`, and update `rsvpCount`.
- `joinParty`: allowed from `lobbyAt` until the archive. Checks eligibility (the same `messagingContext` gate), blocks with the host, and party bans.
- `sendPartyMessage`: reuses Messages' `normalizeMessage`, the requestId idempotency and the rate limits. It also enforces slow mode and the party's status.
- `reactToTrack` (batched) and `rateLive`: `rateLive` writes a real rating through the existing `setTrackRating` path, adding `live: {partyId}`.
- `hostControls`: pin, slow mode, nudge `nowPlaying`, remove a message, remove a member, end.

### Scheduled functions

`advanceParties` runs every minute and moves parties along:
- `scheduled → lobby → live → after → archived`
- when a party starts, it sets `nowPlaying` from the track durations, and computes `results` when the after-party opens
- it sends reminders, as notifications once push ships

### Synced countdown and now-playing

- **Clock skew:** phones' clocks drift, so the client keeps a server-time offset from a lightweight `serverTime` callable (or Firestore's `serverTimestamp` round trip).
- **Countdown and now-playing:** both are computed on the client from `startsAt` and `nowPlaying.startedAt`, plus the cumulative track durations. No per-second writes.

### Moderation and safety
- **Moderation:** the same reports (`reportSocialContent` gains a `partyMessage` kind), blocks and suspensions as Messages.
- **Blocking:** messages from people you've blocked are hidden on your device. You can't join a party hosted by someone who blocked you, or someone you blocked.
- **Who can join:** public parties require community eligibility, like messaging does. Teen accounts can join public parties, but can't DM strangers from inside one, since the request rules still apply.
- **Spam limits:** slow mode, a per-party message cap per person, and link-free text by default (catalog shares only).
- **Feature switch:** a new `parties` flag in `_socialControl/config`, set with `social-admin`, like `messaging`.

### Screens
- **Party detail** (`app/party/[id].tsx`):
  - before it starts: cover, countdown, RSVP, who's going, tracklist
  - during the lobby and live: the chat room
  - after: results and the archive
- **Live room layout:**
  - **Header:** countdown or now-playing, the attendee count, and "Open on SoundCloud".
  - **Track strip:** reactions and a quick-rating slider for the current track.
  - **Chat:** inverted chat list with a composer, reusing the components from `app/messages/[id].tsx`.
- **Feed:** a party card. **Discover:** an "Upcoming parties" shelf.
- **Release page:** a "Listening party" section with the upcoming party or the archived one.
- **Inbox:** an "Upcoming parties" row, and a live party pinned at the top while it's on.
- **Create party** (host): pick a release or announce an upcoming drop, then the date, time, scenes and visibility.

## Build phases

1. **v1, staff-run (about 2 weeks):**
   - data model, rules, join/send, lobby countdown, live chat
   - now-playing for single tracks and releases
   - reactions, results and the archive
   - moderator-only creation, behind the feature switch
2. **v1.1:**
   - live ratings into the real ratings
   - party recap share card
   - Feed and Discover placement
   - reminders in the Inbox
3. **v2:**
   - push notifications (reminders, "it's live")
   - listener-hosted private parties, then moderated public ones
4. **v3:**
   - artist- and producer-hosted official parties, once profiles can be claimed

## Metrics

- RSVP → join rate, and the share of RSVPs who show up at T-0
- messages and reactions per attendee; how long people stay
- ratings and reviews written within 24 hours of a party, compared with releases that had no party
- recap card shares; new accounts arriving through party links
- moderation load: reports per 1,000 messages

## Open questions

- **Upcoming drops not in the catalog:** link the party to the release automatically once a SoundCloud import finds it, or have a moderator attach it?
- **Should live ratings count in the public average** straight away, or only after the person confirms them in the afterparty?
- **Capacity:** cap public parties at a number (for example 500) for v1 cost control, or use overflow rooms?
- **Hosts' power:** should listener hosts be able to remove people, or only report them?
- **Time zones:** show local time everywhere, and also the artist's local time for official parties?
