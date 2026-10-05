import { setGlobalOptions } from 'firebase-functions/v2';
setGlobalOptions({ region: 'us-central1', maxInstances: 10 });
export { onSave, onFollow } from './saves';
export { onComment } from './engagement';
export { computeRotation, nightlyMatches } from './rotation';
export { computeMatches } from './matching';
export { enrichFromGenius, adminEnrichTrack } from './genius';
export { addTrack, previewTrack, completeOnboarding } from './catalog';

export {
  setTrackRating,
  deleteTrackRating,
  setFavoriteTracks,
  setReleaseRating,
  deleteReleaseRating,
  setFavoriteReleases,
} from './ratings';

export { adminSyncSoundCloud } from './soundcloud';

export { syncProducerCredits } from './producer-credits';
export { syncArtistReleases } from './releases';
export { syncReleaseCatalog } from './releases';

export {
  searchCatalog,
  buildCatalogSearch,
  indexTrack,
  indexArtist,
  indexProducer,
  indexRelease,
} from './catalog-search';

export {
  requestTrackEnrichment,
  queueSavedTrack,
  queueRatedTrack,
  processCatalogJobs,
} from './catalog-jobs';
export {
  getSocialStatus,
  setSocialEligibility,
  savePostDraft,
  authorizePostUpload,
  completePostUpload,
  submitPost,
  getPost,
  listPosts,
  setPostInteraction,
  createPostComment,
  listPostComments,
  deleteSocialContent,
  reportSocialContent,
  setUserBlock,
  listModeration,
  moderateSocialContent,
  resolveSocialReport,
  suspendSocialAccount,
} from './social';
export { receivePostMedia, processPostMedia, cleanPostMedia } from './social-media';

export {
  requestAccountDeletion,
  processAccountDeletions,
  submitProfileText,
  submitTrackComment,
  authorizeProfilePhoto,
  reserveCommunityUsername,
} from './social-account';
export * from './social-reads';
export {
  openConversation,
  sendMessage,
  respondToRequest,
  leaveConversation,
  removeConversationMember,
  addConversationMembers,
  renameConversation,
  searchUsers,
  removeReportedMessage,
} from './messages';
