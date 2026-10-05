import { requireProviderPermission } from './provider-permission';
async function main() {
  if (!process.env.GCLOUD_PROJECT) throw new Error('Set GCLOUD_PROJECT.');
  const action = process.argv.includes('--resume')
    ? 'resume'
    : process.argv.includes('--pause')
      ? 'pause'
      : 'status';
  if (
    action !== 'status' &&
    !process.env.FIRESTORE_EMULATOR_HOST &&
    !process.argv.includes('--production')
  )
    throw new Error('Pass --production for a live mutation.');
  if (action === 'resume') await requireProviderPermission('genius');
  const { db } = await import('../functions/src/core');
  try {
    if (action !== 'status')
      await db.doc('_catalogControl/genius').set({ enabled: action === 'resume' }, { merge: true });
    const states = [
      'pending',
      'processing',
      'matched',
      'unmatched',
      'ambiguous',
      'skipped',
      'dead',
    ];
    const counts = Object.fromEntries(
      await Promise.all(
        states.map(async (status) => [
          status,
          (await db.collection('_catalogJobs').where('status', '==', status).count().get()).data()
            .count,
        ]),
      ),
    );
    const dead = await db
      .collection('_catalogJobs')
      .where('status', '==', 'dead')
      .limit(10)
      .select('errorCode', 'attempts')
      .get();
    const failures = dead.docs.map((doc) => ({
      trackId: doc.id,
      attempts: doc.data().attempts,
      errorCode: doc.data().errorCode,
    }));
    const config = (await db.doc('_catalogControl/genius').get()).data();
    console.log(
      JSON.stringify({
        enabled: config?.enabled === true,
        retryAt: config?.retryAt || null,
        counts,
        failures,
      }),
    );
  } finally {
    await db.terminate();
  }
}
main().catch((error) => {
  const message = error instanceof Error ? error.message : '';
  console.error(
    message.startsWith('Record the ') || message.startsWith('Record genius ')
      ? message
      : 'Catalog queue command failed. Check project and authorized Application Default Credentials.',
  );
  process.exitCode = 1;
});
