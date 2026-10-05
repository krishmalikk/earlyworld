import { useCommunity } from '../data/community';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { doc } from '@react-native-firebase/firestore';
import { router } from 'expo-router';
import { space, radius, fontWeight } from '../../shared/theme';
import { useCatalogIds, useCatalogPage } from '../data/catalog';
import { useRatings } from '../data/ratings';
import { useDocument } from '../data/listeners';
import type { Release, ReleaseRating, Stamp } from '../data/types';
import { db, call, errorMessage } from '../lib/firebase';
import { Artwork, Button, c, ErrorLine, s, Section } from './ui';
import { CommunityRating, Stars } from './RatingDisplay';
import { UserLine } from './UserLine';

export const releaseLabels = {
  album: 'Album / LP',
  ep: 'EP',
  mixtape: 'Mixtape',
  compilation: 'Compilation',
  single: 'Single',
};
export function ReleaseCard({ release }: { release: Release }) {
  const own = useRatings().byRelease.get(release.id);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${release.title} by ${release.artistName}, ${releaseLabels[release.releaseType]}`}
      onPress={() => router.push(`/release/${release.id}`)}
      style={[s.panel, s.row, { borderWidth: 0, marginBottom: space[10] }]}
    >
      <View style={{ borderRadius: radius.medium, overflow: 'hidden' }}>
        <Artwork uri={release.artworkUrl} name={release.title} size={64} />
      </View>
      <View style={{ flex: 1, gap: space[4] }}>
        <Text numberOfLines={2} style={[s.text, { fontWeight: fontWeight.bold }]}>
          {release.title}
        </Text>
        <Text numberOfLines={1} style={s.muted}>
          {release.artistName}
        </Text>
        <Text style={s.muted}>
          {releaseLabels[release.releaseType]}
          {release.releasedAt ? ` · ${release.releasedAt.slice(0, 4)}` : ''} ·{' '}
          {release.tracks.length} tracks
        </Text>
        <CommunityRating track={release} />
        {own ? (
          <View style={s.row}>
            <Text style={s.muted}>You</Text>
            <Stars value={own.halfStars} size={12} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

export function ArtistReleases({ artistId }: { artistId: string }) {
  const page = useCatalogPage('releases', { artistId });
  const ref = useMemo(() => doc(db, 'artists', artistId), [artistId]);
  const artist = useDocument<{
    releaseSync?: { complete: boolean; updatedAt?: Stamp };
    soundcloud?: { urn: string };
  }>(ref);
  const list = page.data;
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  return (
    <Section title="Releases">
      {Object.entries(releaseLabels).map(([type, label]) => {
        const group = list.filter((r) => r.releaseType === type);
        return group.length ? (
          <View key={type} style={{ gap: space[8] }}>
            <Text style={s.mono}>{label}</Text>
            {group.map((release) => (
              <ReleaseCard key={release.id} release={release} />
            ))}
          </View>
        ) : null;
      })}
      {!list.length ? (
        <Text style={s.muted}>
          {artist.data?.releaseSync?.complete
            ? 'No verified releases available yet.'
            : 'Find albums, EPs, and mixtapes from this artist.'}
        </Text>
      ) : null}
      <ErrorLine message={error || artist.error || page.error} />
      {page.hasMore ? (
        <Button quiet busy={page.loading} onPress={page.loadMore}>
          More releases
        </Button>
      ) : null}
      {artist.data?.soundcloud?.urn && !artist.data.releaseSync?.complete ? (
        <Button
          quiet
          busy={busy}
          onPress={async () => {
            setBusy(true);
            setError(null);
            try {
              await call('syncArtistReleases', { artistId }, 180000);
              page.refresh();
            } catch (e) {
              setError(`Could not load releases. ${errorMessage(e)}`);
            } finally {
              setBusy(false);
            }
          }}
        >
          {artist.data.releaseSync ? 'Load more releases' : 'Load releases'}
        </Button>
      ) : null}
    </Section>
  );
}

export function ReleaseReviews({
  releaseId,
  uid,
  preview = false,
}: {
  releaseId?: string;
  uid?: string;
  preview?: boolean;
}) {
  const [count, setCount] = useState(preview ? 5 : 25);
  const list = useCommunity<ReleaseRating>(
    { kind: 'releaseRatings', ...(uid ? { uid } : { itemId: releaseId }) },
    count,
  );
  const catalog = useCatalogIds('releases', uid ? list.data.map((r) => r.releaseId) : []);
  return (
    <Section title={uid ? 'Release ratings & reviews' : 'Ratings & reviews'}>
      <ErrorLine message={list.error} />
      {list.loading ? <ActivityIndicator color={c.accent} /> : null}
      {list.data.map((rating) => (
        <View key={rating.id} style={s.panel}>
          {!uid ? <UserLine uid={rating.uid} /> : null}
          {uid ? (
            catalog.byId.has(rating.releaseId) ? (
              <ReleaseCard release={catalog.byId.get(rating.releaseId)!} />
            ) : (
              <Text style={s.muted}>Release unavailable</Text>
            )
          ) : null}
          <View style={s.between}>
            <Stars value={rating.halfStars} />
            <Text style={s.muted}>
              {rating.createdAt?.toDate().toLocaleDateString()}
              {rating.updatedAt?.toMillis() > rating.createdAt?.toMillis() ? ' · edited' : ''}
            </Text>
          </View>
          {rating.review ? (
            <Text numberOfLines={preview ? 4 : undefined} style={s.text}>
              {rating.review}
            </Text>
          ) : null}
          <Button
            quiet
            onPress={() =>
              router.push({
                pathname: '/community',
                params: { reportKind: 'releaseRating', reportId: rating.id },
              })
            }
          >
            Report
          </Button>
        </View>
      ))}
      {!list.loading && !list.data.length && !list.error ? (
        <Text style={s.muted}>No release ratings yet.</Text>
      ) : null}
      {list.data.length >= count ? (
        <Button
          quiet
          onPress={() =>
            preview && uid ? router.push(`/user/releases/${uid}`) : setCount((n) => n + 25)
          }
        >
          {preview ? 'View all' : 'Load more ratings'}
        </Button>
      ) : null}
    </Section>
  );
}

export function ReleaseCatalogLoader() {
  const [busy, setBusy] = useState(false),
    [complete, setComplete] = useState(false),
    [error, setError] = useState<string | null>(null);
  return (
    <View style={{ gap: space[8] }}>
      <Text style={s.muted}>Albums, EPs, and mixtapes from artists in earlyworld.</Text>
      {!complete ? (
        <Button
          quiet
          busy={busy}
          onPress={async () => {
            setBusy(true);
            setError(null);
            try {
              const result = await call<{ complete: boolean }>('syncReleaseCatalog', {}, 300000);
              setComplete(result.complete);
            } catch (e) {
              setError(errorMessage(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Find more releases
        </Button>
      ) : (
        <Text style={s.muted}>You’re up to date.</Text>
      )}
      <ErrorLine message={error} />
    </View>
  );
}
