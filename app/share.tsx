import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  PixelRatio,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import { getAnalytics, logEvent } from '@react-native-firebase/analytics';
import { colors, fontSize, fontWeight, radius, space } from '../shared/theme';
import { CARD, monthStamp } from '../shared/share-cards';
import { errorMessage, report } from '../src/lib/firebase';
import { useLocal } from '../src/state/local';
import { useOrbitCard, useRecapCard, useReviewCard } from '../src/data/share-cards';
import { Button, Empty, ErrorLine, s } from '../src/components/ui';
import { OrbitCard } from '../src/components/share/OrbitCard';
import { RecapCard } from '../src/components/share/RecapCard';
import { ReviewCard } from '../src/components/share/ReviewCard';

type Kind = 'orbit' | 'recap' | 'review';
const TABS: { id: Kind; label: string; caption: string }[] = [
  { id: 'orbit', label: 'Orbit', caption: 'Your four favorites orbiting your planet.' },
  { id: 'recap', label: 'Recap', caption: 'Your earliest find of the month.' },
  { id: 'review', label: 'Review', caption: 'Your review, with the track you rated.' },
];
// Capture proceeds with initials in place of any artwork still loading after this.
const READY_TIMEOUT = 4000;

export default function ShareScreen() {
  const uid = useLocal((s) => s.uid);
  const params = useLocalSearchParams<{ card?: Kind; trackId?: string }>();
  return <Share key={uid || 'out'} uid={uid} initial={params.card} trackId={params.trackId} />;
}

function Share({
  uid,
  initial,
  trackId,
}: {
  uid: string | null;
  initial?: Kind;
  trackId?: string;
}) {
  const [kind, setKind] = useState<Kind>(
    initial && TABS.some((t) => t.id === initial) ? initial : 'orbit',
  );
  const orbit = useOrbitCard(),
    recap = useRecapCard(uid),
    review = useReviewCard(uid, trackId);
  const card = useRef<View>(null);
  const [ready, setReady] = useState<Set<string>>(new Set()),
    [timedOut, setTimedOut] = useState(false),
    [busy, setBusy] = useState<'share' | 'save' | null>(null),
    [error, setError] = useState<string | null>(null);
  const { width, height } = useWindowDimensions();
  const scale = Math.min((width - space[40]) / CARD.width, (height * 0.62) / CARD.height, 1);
  const stamp = monthStamp(new Date());

  // Each tab waits for its own images; switching restarts the fallback timer.
  useEffect(() => {
    setTimedOut(false);
    const timer = setTimeout(() => setTimedOut(true), READY_TIMEOUT);
    return () => clearTimeout(timer);
  }, [kind]);
  const markReady = (id: string) => setReady((old) => (old.has(id) ? old : new Set(old).add(id)));
  const needed =
    kind === 'orbit'
      ? (orbit.data?.favorites || []).map((f) => f.id)
      : kind === 'recap'
        ? ['recap']
        : ['review'];
  const available =
    kind === 'orbit'
      ? !!orbit.data?.favorites.length
      : kind === 'recap'
        ? !!recap.data
        : !!review.data;
  const imagesReady = timedOut || needed.every((id) => ready.has(id));

  async function capture() {
    return captureRef(card, {
      format: 'png',
      quality: 1,
      // view-shot sizes are in points; divide so the file is exactly 1080×1920 pixels.
      width: CARD.exportWidth / PixelRatio.get(),
      height: CARD.exportHeight / PixelRatio.get(),
      result: 'tmpfile',
    });
  }
  async function act(action: 'share' | 'save') {
    setBusy(action);
    setError(null);
    try {
      const uri = await capture();
      if (action === 'share') {
        if (!(await Sharing.isAvailableAsync()))
          throw Error('Sharing is not available on this device.');
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          UTI: 'public.png',
          dialogTitle: 'Share',
        });
      } else {
        const permission = await MediaLibrary.requestPermissionsAsync(true);
        if (!permission.granted)
          throw Error('Allow earlyworld to add photos in Settings to save cards.');
        await MediaLibrary.Asset.create(uri);
        Alert.alert('Saved to Photos');
      }
      // Card type and action only; no user content reaches analytics.
      void Promise.resolve()
        .then(() => logEvent(getAnalytics(), 'share_card', { card: kind, action }))
        .catch(report);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const loading =
    kind === 'orbit' ? orbit.loading : kind === 'recap' ? recap.loading : review.loading;
  return (
    <ScrollView style={s.page} contentContainerStyle={[s.body, { alignItems: 'stretch' }]}>
      <View
        accessibilityRole="tablist"
        style={{
          flexDirection: 'row',
          gap: space[6],
          padding: space[4],
          borderRadius: radius.pill,
          backgroundColor: colors.panel,
          borderWidth: 1,
          borderColor: colors.line,
        }}
      >
        {TABS.map((tab) => {
          const selected = tab.id === kind;
          return (
            <Pressable
              key={tab.id}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => setKind(tab.id)}
              style={{
                flex: 1,
                minHeight: 40,
                borderRadius: radius.pill,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: selected ? colors.accent : 'transparent',
              }}
            >
              <Text
                style={{
                  color: selected ? colors.bg : colors.muted,
                  fontSize: fontSize.navigation,
                  fontWeight: fontWeight.medium,
                }}
              >
                {tab.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {available ? (
        <View
          style={{
            alignSelf: 'center',
            width: CARD.width * scale,
            height: CARD.height * scale,
            borderRadius: radius.card,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: colors.line,
          }}
        >
          <View style={{ transform: [{ scale }], transformOrigin: 'top left' }}>
            {kind === 'orbit' && orbit.data ? (
              <OrbitCard ref={card} {...orbit.data} stamp={stamp} onReady={markReady} />
            ) : kind === 'recap' && recap.data ? (
              <RecapCard ref={card} {...recap.data} onReady={markReady} />
            ) : kind === 'review' && review.data ? (
              <ReviewCard ref={card} {...review.data} stamp={stamp} onReady={markReady} />
            ) : null}
          </View>
        </View>
      ) : loading ? (
        <Empty title="Preparing your card…" />
      ) : kind === 'orbit' ? (
        <>
          <Empty
            title="Pick your four favorites first."
            detail="Choose them on your profile, then come back to share your orbit."
          />
          <Button quiet onPress={() => router.back()}>
            Back to profile
          </Button>
        </>
      ) : kind === 'recap' ? (
        <>
          <Empty
            title="No saves this month yet."
            detail="Save a few tracks and your recap shows your earliest find."
          />
          <Button quiet onPress={() => router.replace('/(tabs)/discover')}>
            Discover tracks
          </Button>
        </>
      ) : (
        <Empty
          title="No review to share yet."
          detail="Write a review on any track, then share it from there."
        />
      )}

      <Text style={[s.muted, { textAlign: 'center' }]}>
        {TABS.find((t) => t.id === kind)!.caption}
      </Text>
      <ErrorLine message={error} />
      <Button
        disabled={!available || !imagesReady}
        busy={busy === 'share' || (available && !imagesReady)}
        busyLabel={busy === 'share' ? 'Opening…' : 'Loading artwork…'}
        onPress={() => void act('share')}
      >
        Share
      </Button>
      <Button
        quiet
        disabled={!available || !imagesReady || !!busy}
        busy={busy === 'save'}
        busyLabel="Saving…"
        onPress={() => void act('save')}
      >
        Save to Photos
      </Button>
    </ScrollView>
  );
}
