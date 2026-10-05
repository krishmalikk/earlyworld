import { useState } from 'react';
import { Pressable, ScrollView, Share, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fontSize, fontWeight, radius, space } from '../../shared/theme';
import { call, errorMessage } from '../../src/lib/firebase';
import { useLocal } from '../../src/state/local';
import { useSession } from '../../src/data/session';
import { useSocialStatus } from '../../src/data/social';
import { useInbox, useMatches, useProfiles } from '../../src/data/inbox';
import { openConversation } from '../../src/data/messages';
import type { User } from '../../src/data/types';
import { Button, c, Empty, ErrorLine, Heading, Page, s, Section } from '../../src/components/ui';
import { Avatar, ConversationRow, handle } from '../../src/components/Messages';
import { PeopleSections } from '../../src/components/PeopleSections';

// The deployed Hosting origin used by existing share links.
const INVITE_URL = 'https://earlyworld-6831c.web.app';

export default function Inbox() {
  const uid = useLocal((s) => s.uid);
  const status = useSocialStatus();
  if (status.data && !status.data.messaging) return <MatchesOnly />;
  return <InboxContent key={uid || 'out'} uid={uid} />;
}

/** Until messaging is switched on, the tab keeps its previous matches-only purpose. */
function MatchesOnly() {
  return (
    <Page>
      <Heading eyebrow="Inbox" title="Shared taste" />
      <MatchStrip />
      <Button quiet onPress={() => router.push('/matches')}>
        See all matches
      </Button>
    </Page>
  );
}

function InboxContent({ uid }: { uid: string | null }) {
  const inbox = useInbox();
  const matches = useMatches();
  const profiles = useProfiles(
    inbox.conversations.flatMap((r) => r.memberIds).filter((m) => m !== uid),
  );
  const [query, setQuery] = useState(''),
    [opening, setOpening] = useState<string | null>(null),
    [error, setError] = useState<string | null>(null);
  async function message(user: User) {
    setOpening(user.id);
    setError(null);
    try {
      router.push(`/messages/${await openConversation([user.id])}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setOpening(null);
    }
  }
  const quiet = !inbox.loading && !inbox.conversations.length;
  return (
    <Page>
      <Heading
        eyebrow="Inbox"
        title="Your people"
        right={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="New message"
            onPress={() => router.push('/messages/new')}
            hitSlop={8}
            style={{ padding: space[8] }}
          >
            <Ionicons name="create-outline" size={26} color={c.text} />
          </Pressable>
        }
      />
      <ErrorLine message={inbox.error || error} />
      {inbox.requests.length ? (
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/messages/requests')}
          style={[s.panel, s.between, { flexDirection: 'row' }]}
        >
          <Ionicons name="mail-unread-outline" size={20} color={c.accent} />
          <Text style={[s.text, { flex: 1 }]}>
            {inbox.requests.length} message {inbox.requests.length === 1 ? 'request' : 'requests'}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={c.muted} />
        </Pressable>
      ) : null}
      {matches.data.length ? <MatchStrip /> : null}
      {inbox.conversations.length ? (
        <Section title="Messages">
          {inbox.conversations.map((row) => (
            <ConversationRow key={row.id} row={row} uid={uid} profiles={profiles.byId} />
          ))}
        </Section>
      ) : inbox.loading ? (
        <Empty title="Loading your inbox…" />
      ) : null}
      {quiet ? (
        <>
          {!matches.loading && !matches.data.length ? <MatchingStatus /> : null}
          <Section title="Start a conversation">
            <Text style={s.muted}>
              Message your matches, people who follow you, or anyone by username. Listeners you
              aren’t connected to get a message request first.
            </Text>
          </Section>
          <PeopleSections
            mode="message"
            onPick={(user) => void message(user)}
            busyId={opening}
            exclude={uid ? [uid] : []}
            query={query}
            onQuery={setQuery}
          />
          <Section title="Bring a friend">
            <Text style={s.muted}>
              Matching gets better with every listener who saves rare tracks.
            </Text>
            <Button
              quiet
              onPress={() =>
                void Share.share({
                  message: `Find people with your exact taste in underground music on earlyworld: ${INVITE_URL}`,
                }).catch(() => {})
              }
            >
              Invite a friend
            </Button>
          </Section>
        </>
      ) : null}
    </Page>
  );
}

/** Horizontal avatars of the strongest matches, each one tap from their profile. */
function MatchStrip() {
  const matches = useMatches();
  const top = matches.data.slice(0, 12);
  const profiles = useProfiles(top.map((m) => m.id));
  if (!top.length) return matches.loading ? null : <MatchingStatus />;
  return (
    <Section
      title="Matches"
      right={
        <Pressable accessibilityRole="button" onPress={() => router.push('/matches')} hitSlop={8}>
          <Text style={s.link}>See all</Text>
        </Pressable>
      }
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={{ flexDirection: 'row', gap: space[14] }}>
          {top.map((m) => {
            const p = profiles.byId.get(m.id);
            return (
              <Pressable
                key={m.id}
                accessibilityRole="button"
                accessibilityLabel={`${handle(p)}, ${m.sharedTracks.length} shared tracks`}
                onPress={() => router.push(`/user/${m.id}`)}
                style={{ alignItems: 'center', gap: space[5], width: 72 }}
              >
                <View
                  style={{
                    borderRadius: radius.pill,
                    borderWidth: 2,
                    borderColor: c.accent,
                    padding: space[2],
                  }}
                >
                  <Avatar user={p} size={56} />
                </View>
                <Text numberOfLines={1} style={[s.text, { fontSize: fontSize.smallLabel }]}>
                  {handle(p)}
                </Text>
                <Text style={[s.muted, { fontSize: fontSize.caption }]}>
                  {m.sharedTracks.length} shared
                </Text>
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
    </Section>
  );
}

/** Replaces a bare empty state: explains how matching works and what to do next. */
function MatchingStatus() {
  const { user } = useSession();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  const saves = user?.saveCount || 0;
  return (
    <View style={[s.panel, { borderLeftWidth: 3, borderLeftColor: c.accent }]}>
      <Text style={s.mono}>MATCHING</Text>
      <Text style={[s.text, { fontWeight: fontWeight.bold }]}>
        {user?.initialMatchesComputed
          ? 'No matches yet — that’s normal early on.'
          : 'Find your people.'}
      </Text>
      <Text style={s.muted}>
        Matches come from rare tracks you both saved. You’ve saved {saves}{' '}
        {saves === 1 ? 'track' : 'tracks'}; saving lesser-known tracks in your scenes gives the
        strongest matches. They refresh every few saves and nightly.
      </Text>
      <ErrorLine message={error} />
      {!user?.initialMatchesComputed ? (
        <Button
          busy={busy}
          busyLabel="Finding matches…"
          onPress={async () => {
            setBusy(true);
            setError(null);
            try {
              await call('computeMatches');
            } catch (e) {
              setError(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Find matches
        </Button>
      ) : (
        <Button quiet onPress={() => router.push('/(tabs)/discover')}>
          Discover rare tracks
        </Button>
      )}
    </View>
  );
}
