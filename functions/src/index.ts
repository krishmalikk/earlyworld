import { setGlobalOptions } from 'firebase-functions/v2';
setGlobalOptions({ region: 'us-central1', maxInstances: 10 });
export { onSave, onFollow } from './saves';
export { recordEngagement, beginPlayback, onComment } from './engagement';
export { computeRotation, nightlyMatches } from './rotation';
export { computeMatches } from './matching';
export { enrichFromGenius, adminEnrichTrack } from './genius';
export { addTrack, previewTrack, completeOnboarding } from './catalog';
