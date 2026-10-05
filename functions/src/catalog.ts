import { soundCloudSnapshot } from './provider-metadata';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { authUid, db, FieldValue, hash, requiredText, rateLimit } from './core';
import { bandcampMetadata } from './bandcamp';
import {
  getSoundCloudTrack,
  soundCloudSecrets,
  soundCloudIdentityRef,
  soundCloudFields,
} from './soundcloud';
import { SoundCloudError } from './soundcloud-api';
import { normalizeName, normalizeSource } from '../../shared/domain';
export async function metadata(sourceUrl: string) {
  const source = normalizeSource(sourceUrl);
  if (source.platform === 'soundcloud') {
    try {
      const info = await getSoundCloudTrack(source.url);
      return {
        title: info.title,
        artworkUrl: info.artworkUrl,
        artistName: info.artistName,
        ...source,
        url: info.permalinkUrl,
        soundcloud: info,
      };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      if (error instanceof SoundCloudError && [403, 404, 410].includes(error.status))
        throw new HttpsError('not-found', 'This public SoundCloud track is unavailable.');
      throw new HttpsError('unavailable', 'SoundCloud metadata is unavailable. Try again shortly.');
    }
  }
  if (source.platform === 'bandcamp') {
    const response = await fetch(source.url, {
      redirect: 'error',
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new HttpsError('unavailable', 'Could not read this Bandcamp page.');
    const html = await response.text();
    const info = bandcampMetadata(html);
    if (!info.title)
      throw new HttpsError('unavailable', 'Could not read this public Bandcamp track.');
    return { ...info, ...source, soundcloud: null };
  }
  const endpoint = 'https://www.youtube.com/oembed';
  const response = await fetch(`${endpoint}?format=json&url=${encodeURIComponent(source.url)}`, {
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok)
    throw new HttpsError('unavailable', 'Could not read this public track. Check the URL.');
  const data = (await response.json()) as {
    title?: string;
    thumbnail_url?: string;
    author_name?: string;
  };
  return {
    title: data.title || '',
    artworkUrl: data.thumbnail_url || '',
    artistName: data.author_name || '',
    ...source,
    soundcloud: null,
  };
}
export const previewTrack = onCall({ secrets: soundCloudSecrets }, async (request) => {
  if (request.auth?.token.admin !== true) throw new HttpsError('permission-denied', 'Catalog creation is managed by administrators.');
  const uid = authUid(request);
  await rateLimit(uid, 'metadata', 60);
  try {
    return await metadata(requiredText(request.data?.sourceUrl, 'URL', 2048));
  } catch (e) {
    if (e instanceof HttpsError) throw e;
    throw new HttpsError('invalid-argument', e instanceof Error ? e.message : 'Check this URL.');
  }
});
export const addTrack = onCall({ secrets: soundCloudSecrets }, async (request) => {
  if (request.auth?.token.admin !== true) throw new HttpsError('permission-denied', 'Catalog creation is managed by administrators.');
  const uid = authUid(request);
  await rateLimit(uid, 'addTrack', 30);
  const data = request.data || {};
  let source;
  try {
    source = normalizeSource(requiredText(data.sourceUrl, 'URL', 2048));
  } catch (e) {
    throw new HttpsError('invalid-argument', (e as Error).message);
  }
  const title = requiredText(data.title, 'title'),
    artistName = requiredText(data.artistName, 'artist name', 100);
  const producerName =
    typeof data.producerName === 'string' && data.producerName.trim()
      ? requiredText(data.producerName, 'producer', 100)
      : null;
  if (data.publicReleaseConfirmed !== true)
    throw new HttpsError('invalid-argument', 'Only public, published tracks belong here.');
  const info = await metadata(source.url);
  const trackId = hash(info.url),
    artistId = `artist_${hash(normalizeName(artistName)).slice(0, 24)}`,
    producerId = producerName ? `producer_${hash(normalizeName(producerName)).slice(0, 24)}` : null;
  return db.runTransaction(async (tx) => {
    const ref = db.doc(`tracks/${trackId}`),
      artistRef = db.doc(`artists/${artistId}`),
      producerRef = producerId ? db.doc(`producers/${producerId}`) : null;
    const identityRef = info.soundcloud ? soundCloudIdentityRef(info.soundcloud.urn) : null;
    const [existing, artist, producer, identity] = await Promise.all([
      tx.get(ref),
      tx.get(artistRef),
      producerRef ? tx.get(producerRef) : Promise.resolve(null),
      identityRef ? tx.get(identityRef) : Promise.resolve(null),
    ]);
    if (identity?.exists) return { trackId: identity.data()!.trackId, existing: true };
    if (existing.exists) {
      if (identityRef) tx.set(identityRef, { trackId, urn: info.soundcloud!.urn });
      return { trackId, existing: true };
    }
    if (!artist.exists)
      tx.create(artistRef, {
        name: artistName,
        imageUrl: '',
        aliases: [],
        scenes: [],
        trackCount: 1,
        createdAt: FieldValue.serverTimestamp(),
      });
    else tx.update(artistRef, { trackCount: FieldValue.increment(1) });
    if (producerRef) {
      if (!producer?.exists)
        tx.create(producerRef, {
          name: producerName,
          imageUrl: '',
          aliases: [],
          tagAudioUrl: null,
          trackCount: 1,
        });
      else tx.update(producerRef, { trackCount: FieldValue.increment(1) });
    }
    if (identityRef) tx.set(identityRef, { trackId, urn: info.soundcloud!.urn });
    if (info.soundcloud)
      tx.create(
        db.doc(`_providerMetadata/${trackId}/sources/soundcloud`),
        soundCloudSnapshot(info.soundcloud),
      );
    tx.create(ref, {
      title,
      artistId,
      artistName,
      producerId,
      producerName,
      sourceUrl: source.url,
      sourcePlatform: source.platform,
      artworkUrl: info.artworkUrl,
      ...(info.soundcloud ? soundCloudFields(info.soundcloud) : {}),
      addedByUid: uid,
      createdAt: FieldValue.serverTimestamp(),
      saveCount: 0,
      savers: [],
      saversCapped: false,
      geniusStatus: 'pending',
      geniusId: null,
      geniusUrl: null,
      geniusCheckedAt: null,
      credits: null,
    });
    return { trackId, existing: false };
  });
});
export const completeOnboarding = onCall(async (request) => {
  const uid = authUid(request);
  await db.runTransaction(async (tx) => {
    const [user, saves, follows] = await Promise.all([
      tx.get(db.doc(`users/${uid}`)),
      tx.get(db.collection(`users/${uid}/saves`).limit(5)),
      tx.get(db.collection(`users/${uid}/following`).where('targetType', '==', 'artist').limit(5)),
    ]);
    const data = user.data();
    if (
      !data?.usernameLower ||
      data.onboardingStep < 5 ||
      data.scenes.length < 2 ||
      saves.size < 5 ||
      follows.size < 5
    )
      throw new HttpsError(
        'failed-precondition',
        'Choose your scenes, five artists, and five tracks.',
      );
    tx.update(user.ref, {
      onboardingComplete: true,
      onboardingStep: 6,
      onboardingCompletedAt: FieldValue.serverTimestamp(),
      lastActiveAt: FieldValue.serverTimestamp(),
    });
  });
  return { complete: true };
});
