import { soundCloudSnapshot, editorialProjection } from './provider-metadata';
import { randomUUID } from 'node:crypto';
import { defineSecret } from 'firebase-functions/params';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { FieldPath } from 'firebase-admin/firestore';
import { db, FieldValue, hash, rateLimit } from './core';
import {
  fetchSoundCloudMetadata,
  soundCloudProfileUrl,
  SoundCloudError,
  type SoundCloudMetadata,
} from './soundcloud-api';

export const SOUNDCLOUD_CLIENT_ID = defineSecret('SOUNDCLOUD_CLIENT_ID');
export const SOUNDCLOUD_CLIENT_SECRET = defineSecret('SOUNDCLOUD_CLIENT_SECRET');
export const soundCloudSecrets = [SOUNDCLOUD_CLIENT_ID, SOUNDCLOUD_CLIENT_SECRET];

/** Shared, client-inaccessible token cache and lease for single-use refresh tokens. */
export async function soundCloudToken(rejected?: string): Promise<string> {
  const clientId = SOUNDCLOUD_CLIENT_ID.value(),
    clientSecret = SOUNDCLOUD_CLIENT_SECRET.value();
  if (!clientId || !clientSecret)
    throw new HttpsError('failed-precondition', 'SoundCloud integration is not configured.');
  const fingerprint = hash(`${clientId}:${clientSecret}`);
  const ref = db.doc('_integrations/soundcloudOAuth'),
    lease = randomUUID();
  for (let attempt = 0; attempt < 60; attempt++) {
    const state = await db.runTransaction(async (tx) => {
      const data = (await tx.get(ref)).data() || {};
      if (
        data.fingerprint === fingerprint &&
        data.accessToken &&
        data.accessToken !== rejected &&
        data.expiresAt > Date.now() + 60000
      )
        return { token: data.accessToken as string };
      if (data.leaseUntil > Date.now()) return {};
      tx.set(ref, { lease, leaseUntil: Date.now() + 45000 }, { merge: true });
      return {
        claimed: true,
        refreshToken:
          data.fingerprint === fingerprint ? (data.refreshToken as string | undefined) : undefined,
      };
    });
    if (state.token) return state.token;
    if (!state.claimed) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      continue;
    }
    try {
      const exchange = (refresh?: string) =>
        fetch('https://secure.soundcloud.com/oauth/token', {
          method: 'POST',
          redirect: 'error',
          signal: AbortSignal.timeout(15000),
          headers: {
            Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          body: new URLSearchParams(
            refresh
              ? {
                  grant_type: 'refresh_token',
                  refresh_token: refresh,
                  client_id: clientId,
                  client_secret: clientSecret,
                }
              : { grant_type: 'client_credentials' },
          ),
        });
      let response = await exchange(state.refreshToken);
      if (state.refreshToken && response.status === 400) response = await exchange();
      if (!response.ok)
        throw new SoundCloudError(
          response.status,
          `SoundCloud authentication failed (${response.status}).`,
        );
      const body = (await response.json()) as {
        access_token?: string;
        refresh_token?: string;
        expires_in?: number;
      };
      if (!body.access_token || !Number.isFinite(body.expires_in) || body.expires_in! <= 0)
        throw new SoundCloudError(502, 'Invalid SoundCloud token response.');
      await db.runTransaction(async (tx) => {
        const current = await tx.get(ref);
        if (current.data()?.lease !== lease)
          throw new SoundCloudError(503, 'SoundCloud token refresh lease expired.');
        tx.set(ref, {
          fingerprint,
          accessToken: body.access_token,
          refreshToken: body.refresh_token || '',
          expiresAt: Date.now() + body.expires_in! * 1000,
          updatedAt: FieldValue.serverTimestamp(),
        });
      });
      return body.access_token;
    } catch (error) {
      await db.runTransaction(async (tx) => {
        const current = await tx.get(ref);
        if (current.data()?.lease === lease)
          tx.update(ref, { lease: FieldValue.delete(), leaseUntil: FieldValue.delete() });
      });
      throw error;
    }
  }
  throw new HttpsError('unavailable', 'SoundCloud is busy. Try again shortly.');
}
export const getSoundCloudTrack = (sourceUrl: string, urn?: string) =>
  fetchSoundCloudMetadata(sourceUrl, urn, soundCloudToken);
export const soundCloudIdentityRef = (urn: string) => db.doc(`_soundcloudTracks/${hash(urn)}`);

export function soundCloudFields(metadata: SoundCloudMetadata) {
  return {
    title: metadata.title,
    artworkUrl: metadata.artworkUrl,
    durationSeconds: metadata.durationSeconds,
    sourceUrl: metadata.permalinkUrl,
    soundcloud: metadata,
    sourceStatus: 'available',
    sourceCheckedAt: FieldValue.serverTimestamp(),
  };
}
/** Update only provider fields. Document IDs, editorial artist identity, credits, and all social fields survive. */
export async function reconcileSoundCloudTrack(trackId: string, metadata: SoundCloudMetadata) {
  return db.runTransaction(async (tx) => {
    const ref = db.doc(`tracks/${trackId}`),
      identity = soundCloudIdentityRef(metadata.urn);
    const [track, mapping] = await Promise.all([tx.get(ref), tx.get(identity)]);
    if (!track.exists || track.data()!.sourcePlatform !== 'soundcloud') return false;
    const data = track.data()!;
    if (
      (data.soundcloud?.urn && data.soundcloud.urn !== metadata.urn) ||
      (mapping.exists && mapping.data()!.trackId !== trackId)
    )
      throw new HttpsError('already-exists', 'SoundCloud identity needs manual reconciliation.');
    const artistRef = db.doc(`artists/${data.artistId}`),
      artist = await tx.get(artistRef);
    tx.set(db.doc(`_providerMetadata/${trackId}/sources/soundcloud`), soundCloudSnapshot(metadata));
    tx.update(ref, editorialProjection(soundCloudFields(metadata), data.editorial));
    tx.set(identity, { trackId, urn: metadata.urn });
    const a = artist.data();
    if (
      a &&
      (a.soundcloud?.urn === metadata.uploader.urn ||
        (!a.soundcloud?.urn &&
          soundCloudProfileUrl(a.sourceUrl) !== '' &&
          soundCloudProfileUrl(a.sourceUrl) === metadata.uploader.profileUrl))
    ) {
      tx.update(artistRef, {
        imageUrl: metadata.uploader.avatarUrl,
        sourceUrl: metadata.uploader.profileUrl,
        soundcloud: metadata.uploader,
        sourceCheckedAt: FieldValue.serverTimestamp(),
      });
    }
    return true;
  });
}
export async function syncSoundCloudPage(afterId?: string, apply = false) {
  let query = db
    .collection('tracks')
    .where('sourcePlatform', '==', 'soundcloud')
    .orderBy(FieldPath.documentId())
    .limit(25);
  if (afterId) query = query.startAfter(afterId);
  const page = await query.get();
  const result = {
    checked: page.size,
    refreshed: 0,
    unavailable: 0,
    conflicts: 0,
    nextCursor: page.size === 25 ? page.docs.at(-1)!.id : (null as string | null),
  };
  for (const doc of page.docs) {
    const track = doc.data();
    try {
      const metadata = await getSoundCloudTrack(track.sourceUrl, track.soundcloud?.urn);
      if (apply) await reconcileSoundCloudTrack(doc.id, metadata);
      result.refreshed++;
    } catch (error) {
      if (error instanceof SoundCloudError && [404, 410].includes(error.status)) {
        result.unavailable++;
        if (apply) {
          const batch = db.batch();
          batch.update(doc.ref, {
            sourceStatus: 'unavailable',
            sourceCheckedAt: FieldValue.serverTimestamp(),
          });
          batch.set(
            db.doc(`_providerMetadata/${doc.id}/sources/soundcloud`),
            { status: 'unavailable', lastAttemptAt: FieldValue.serverTimestamp() },
            { merge: true },
          );
          await batch.commit();
        }
      } else if (error instanceof HttpsError && error.code === 'already-exists') result.conflicts++;
      else throw error; // Outages/rate limits must not mark the catalog missing.
    }
  }
  return result;
}
export const adminSyncSoundCloud = onCall(
  { secrets: soundCloudSecrets, timeoutSeconds: 540 },
  async (request) => {
    if (request.auth?.token.admin !== true)
      throw new HttpsError('permission-denied', 'Admin only.');
    const afterId = request.data?.afterId;
    if (
      afterId !== undefined &&
      (typeof afterId !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(afterId))
    )
      throw new HttpsError('invalid-argument', 'Invalid sync cursor.');
    await rateLimit(request.auth.uid, 'soundcloudSync', 30);
    try {
      return await syncSoundCloudPage(afterId, request.data?.apply === true);
    } catch {
      throw new HttpsError(
        'unavailable',
        'SoundCloud sync could not finish. Retry this page later.',
      );
    }
  },
);
