import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
const [command, project, value] = process.argv.slice(2);
if (!project || !['init', 'moderator', 'flags', 'status'].includes(command))
  throw Error('Usage: social-admin.ts init|moderator|flags|status PROJECT [EMAIL|JSON]');
initializeApp({ credential: applicationDefault(), projectId: project });
const db = getFirestore(),
  ref = db.doc('_socialControl/config');
async function main() {
  if (command === 'init') {
    await db.runTransaction(async (tx) => {
      const old = await tx.get(ref);
      if (!old.exists)
        tx.create(ref, {
          creation: false,
          publication: false,
          playback: false,
          uploads: false,
          supportEmail: 'earlyworldofficial@gmail.com',
          processingSecondsDaily: 1200,
          createdAt: FieldValue.serverTimestamp(),
        });
      else tx.update(ref, { supportEmail: 'earlyworldofficial@gmail.com' });
    });
  } else if (command === 'moderator') {
    if (!value || !value.includes('@'))
      throw Error('Pass the explicitly approved moderator email.');
    const user = await getAuth().getUserByEmail(value);
    await getAuth().setCustomUserClaims(user.uid, { ...user.customClaims, admin: true });
    console.log('Moderator access assigned. Sign out and sign in to refresh claims.');
  } else if (command === 'flags') {
    const flags = JSON.parse(value || '{}');
    if (
      Object.keys(flags).some(
        (k) => !['creation', 'publication', 'playback', 'uploads', 'messaging'].includes(k),
      ) ||
      Object.values(flags).some((v) => typeof v !== 'boolean')
    )
      throw Error('Only boolean feature switches are accepted.');
    const config = (await ref.get()).data();
    if (
      flags.creation === true &&
      !(config?.launchReady === true && config?.legacyReviewComplete === true)
    )
      throw Error(
        'Public creation requires recorded launch readiness and review of existing content. Use admin accounts for internal testing.',
      );
    await ref.set(flags, { merge: true });
  } else {
    const d = (await ref.get()).data() || {};
    console.log(
      JSON.stringify({
        creation: !!d.creation,
        publication: !!d.publication,
        playback: !!d.playback,
        uploads: !!d.uploads,
        messaging: !!d.messaging,
        supportEmail: d.supportEmail || null,
      }),
    );
  }
}
main()
  .catch(() => {
    console.error(
      'Social administration failed. Check project access, arguments, and launch readiness.',
    );
    process.exitCode = 1;
  })
  .finally(() => db.terminate());
