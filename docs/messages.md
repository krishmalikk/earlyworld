# Messages

The Inbox tab (formerly Matches) holds direct messages, groups, message requests and matches. Messages contain text, a shared catalog track, or a shared release. There are no photos and no push notifications yet.

## Who can message whom

- Start a conversation from a match, a profile, the compose screen (matches, followers, people you follow, scene suggestions, or `@username` search), or **Send** on a track or release.
- A recipient who **follows the sender**, or who **matched with the sender in either direction**, gets the conversation in their inbox. Anyone else receives a **message request**.
- A sender can send up to **3 messages** into an unaccepted direct request. **Delete** hides the request; the sender is not told, and later messages stay hidden.
- Group invitations follow the same rule, measured against the person who added you. Declining an invitation leaves the group.
- Listeners in different age bands (13–17 and 18+) can't send each other requests. They can only message after a follow or match connects them.
- Blocking in either direction prevents opening or sending, and hides the direct conversation from the blocker. Group messages from people you blocked are hidden on your device.

## Data

| Path                                | Contents                                                                    | Client access                                                |
| ----------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------ |
| `conversations/{id}`                | type, `memberIds`, `createdBy`, name, last message                          | current members read                                         |
| `conversations/{id}/messages/{mid}` | `uid`, kind, body, track/release ID, `createdAt`, `removed`                 | current members read                                         |
| `users/{uid}/conversations/{id}`    | inbox row: state, members, last message, `unread`, `readAt`, `requestCount` | owner reads; the owner may only set `unread: 0` and `readAt` |

- A direct conversation's ID is `dm_<uidA>_<uidB>`, with the two IDs sorted, so it is always reused. Group IDs derive from the creator and a request ID, which makes creation retry-safe.
- Message IDs hash the sender with the client `requestId`, so a retried send is a no-op.
- Each send fans out to every member's inbox row in one transaction. Groups are capped at 20 people.

## Callables

All of these live in `functions/src/messages.ts`:

- `openConversation`, `sendMessage`, `respondToRequest`
- `addConversationMembers`, `removeConversationMember`, `leaveConversation`, `renameConversation`
- `searchUsers`
- `removeReportedMessage` (moderators only)

`readCommunity` gains four kinds: `profiles` (up to 30 per request), `followers`, `followingUsers` and `suggestedListeners`.

## Switch, limits and moderation

- **Switch:** messaging uses its own flag, `_socialControl/config.messaging`. Turn it on with `npm run social:admin -- flags '{"messaging":true}'`. Until then the tab shows matches only; admins can always use messaging.
- **Who can send:** completed onboarding, a verified email, community eligibility, and an account that isn't suspended or being deleted.
- **Limits:** 120 messages per hour and 1,000 per day per sender; 1,000 characters per message.
- **Reports:** messages are delivered instantly, and any member can long-press one to report it. The report copies only that message's text into `_socialReports`. Moderators can remove it from the Moderation screen, which clears its content and leaves a "Removed by a moderator" placeholder.
- **Account deletion:** removes the account's sent messages and takes it out of every conversation (passing group ownership to another member). The inbox rows go with the profile.

## Not yet

- Push notifications. The natural hook is an `onDocumentCreated` trigger on `conversations/{id}/messages/{mid}`.
- Photos and voice notes; typing indicators; read receipts shown to other people.
- Muting.
- The invite link points at the Hosting root, which needs a landing page; see `INVITE_URL` in `app/(tabs)/inbox.tsx`.
