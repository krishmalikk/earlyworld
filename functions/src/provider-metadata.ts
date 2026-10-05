import type { SoundCloudMetadata } from './soundcloud-api';
import { FieldValue } from './core';
/** Provider snapshots are separate from the stable community document and never contain social counters. */
export function soundCloudSnapshot(metadata: SoundCloudMetadata) {
  return {
    provider: 'soundcloud',
    providerId: metadata.urn,
    status: 'available',
    metadata,
    lastSuccessfulFetchAt: FieldValue.serverTimestamp(),
    lastAttemptAt: FieldValue.serverTimestamp(),
    retentionPolicy: 'pending',
    expiresAt: null,
  };
}
/** Only explicit editorial overrides take precedence over the compatibility projection. */
export function editorialProjection(fields: Record<string, unknown>, editorial: unknown) {
  const result = { ...fields };
  if (editorial && typeof editorial === 'object')
    for (const key of ['title', 'artworkUrl', 'durationSeconds']) {
      const value = (editorial as Record<string, unknown>)[key];
      if (
        key === 'durationSeconds'
          ? typeof value === 'number' && Number.isFinite(value) && value > 0
          : typeof value === 'string' && value.trim()
      )
        result[key] = value;
    }
  return result;
}
