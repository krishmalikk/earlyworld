import { Text, View } from 'react-native';
import { space } from '../../shared/theme';
import { useCommunity } from '../data/community';
import { useMatches, useProfiles, useUserSearch } from '../data/inbox';
import type { User } from '../data/types';
import { ErrorLine, Field, s, Section } from './ui';
import { PersonRow, SmallButton } from './Messages';

type Props = {
  /** `pick` shows checkboxes for compose; `message` shows a Message button per listener. */
  mode: 'pick' | 'message';
  selected?: ReadonlySet<string>;
  onPick: (user: User) => void;
  busyId?: string | null;
  exclude?: readonly string[];
  query: string;
  onQuery: (text: string) => void;
};

/** Everyone a listener can start a conversation with, grouped by how they're connected. */
export function PeopleSections({
  mode,
  selected,
  onPick,
  busyId,
  exclude = [],
  query,
  onQuery,
}: Props) {
  const matches = useMatches();
  const matchProfiles = useProfiles(matches.data.slice(0, 30).map((m) => m.id));
  const followers = useCommunity<User>({ kind: 'followers' }, 50);
  const following = useCommunity<User>({ kind: 'followingUsers' }, 50);
  const suggested = useCommunity<User>({ kind: 'suggestedListeners' }, 10);
  const search = useUserSearch(query);
  const hidden = new Set(exclude);
  const seen = new Set<string>();
  // Each listener appears once, under their closest connection.
  const unique = (people: User[]) =>
    people.filter((p) => !hidden.has(p.id) && !seen.has(p.id) && seen.add(p.id));

  const row = (user: User, detail?: string) => (
    <PersonRow
      key={user.id}
      user={user}
      detail={detail}
      selected={mode === 'pick' ? selected?.has(user.id) : undefined}
      onPress={mode === 'pick' ? () => onPick(user) : undefined}
      right={
        mode === 'message' ? (
          <SmallButton
            label={busyId === user.id ? 'Opening…' : 'Message'}
            disabled={!!busyId}
            onPress={() => onPick(user)}
          />
        ) : undefined
      }
    />
  );
  const searching = query.trim().length > 0;
  const matched = unique(
    matches.data.flatMap((m) => {
      const p = matchProfiles.byId.get(m.id);
      return p ? [p] : [];
    }),
  );
  const sharedCount = new Map(matches.data.map((m) => [m.id, m.sharedTracks.length]));
  const followsYou = unique(followers.data),
    youFollow = unique(following.data),
    scenes = unique(suggested.data);

  return (
    <View style={{ gap: space[22] }}>
      <Field
        accessibilityLabel="Search by username"
        placeholder="Search by @username"
        autoCapitalize="none"
        autoCorrect={false}
        value={query}
        onChangeText={onQuery}
        maxLength={21}
      />
      {searching ? (
        <Section title="Results">
          <ErrorLine message={search.error} />
          {search.data.filter((p) => !hidden.has(p.id)).map((p) => row(p))}
          {!search.loading && !search.data.length ? (
            <Text style={s.muted}>No listeners start with “{query.trim()}”.</Text>
          ) : null}
          {search.loading ? <Text style={s.muted}>Searching…</Text> : null}
        </Section>
      ) : (
        <>
          {matched.length ? (
            <Section title="Your matches">
              {matched.map((p) => {
                const n = sharedCount.get(p.id) || 0;
                return row(p, `${n} rare shared ${n === 1 ? 'save' : 'saves'}`);
              })}
            </Section>
          ) : null}
          {followsYou.length ? (
            <Section title="Follows you">{followsYou.map((p) => row(p))}</Section>
          ) : null}
          {youFollow.length ? (
            <Section title="You follow">{youFollow.map((p) => row(p))}</Section>
          ) : null}
          {scenes.length ? (
            <Section title="Listeners in your scenes">
              {scenes.map((p) => row(p, p.scenes?.slice(0, 3).join(' · ')))}
            </Section>
          ) : null}
          <ErrorLine message={followers.error || following.error || suggested.error} />
        </>
      )}
    </View>
  );
}
