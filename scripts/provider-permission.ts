import { readFile } from 'node:fs/promises';
/** This records an operator's provider agreement; it is not itself a license or permission. */
export async function requireProviderPermission(provider: 'soundcloud' | 'genius') {
  if (process.env.FIRESTORE_EMULATOR_HOST) return;
  const policy = JSON.parse(await readFile('docs/provider-retention.json', 'utf8'))[provider];
  if (
    policy?.status !== 'approved' ||
    !policy.approvalReference?.trim() ||
    !policy.allowedFields?.length ||
    !policy.artistProfilesPermitted
  )
    throw new Error(
      `Record the ${provider} permission and retention scope in docs/provider-retention.json before expanding live imports.`,
    );
  for (const name of [
    'serverRetentionDays',
    'deviceCacheRetentionDays',
    'artworkCacheRetentionDays',
    'searchIndexRetentionDays',
    'removalDeadlineHours',
  ])
    if (!Number.isFinite(policy[name]) || policy[name] <= 0)
      throw new Error(
        `Record ${provider} ${name} from the agreement before expanding live imports.`,
      );
}
