import { after, before, beforeEach, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, setDoc } from 'firebase/firestore';
import { ref, uploadBytes, getBytes } from 'firebase/storage';
let env: RulesTestEnvironment;
const projectId = 'demo-earlyworld-social-storage';
before(async () => {
  env = await initializeTestEnvironment({
    projectId,
    firestore: {
      host: '127.0.0.1',
      port: Number(process.env.SOCIAL_FIRESTORE_PORT || 8085),
      rules: await readFile('firestore.rules', 'utf8'),
    },
    storage: {
      host: '127.0.0.1',
      port: Number(process.env.SOCIAL_STORAGE_PORT || 9195),
      rules: await readFile('storage.rules', 'utf8'),
    },
  });
});
after(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.clearStorage();
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), '_socialControl/config'), { uploads: true });
    await setDoc(doc(c.firestore(), '_postDrafts/p'), { uid: 'alice', status: 'draft' });
    await setDoc(doc(c.firestore(), '_socialMedia/m'), {
      uid: 'alice',
      postId: 'p',
      status: 'authorized',
      expiresAt: new Date(Date.now() + 60000),
      bytes: 3,
      mime: 'image/jpeg',
    });
  });
});
test('only exact owner-authorized staging uploads pass; originals stay private', async () => {
  const path = 'social-staging/alice/p/m',
    a = ref(env.authenticatedContext('alice').storage(), path);
  await assertFails(
    uploadBytes(ref(env.authenticatedContext('bob').storage(), path), new Uint8Array(3), {
      contentType: 'image/jpeg',
    }),
  );
  await assertFails(uploadBytes(a, new Uint8Array(4), { contentType: 'image/jpeg' }));
  await assertFails(uploadBytes(a, new Uint8Array(3), { contentType: 'video/mp4' }));
  await assertSucceeds(
    uploadBytes(a, new Uint8Array(3), {
      contentType: 'image/jpeg',
    }),
  );
  await assertFails(uploadBytes(a, new Uint8Array(3), { contentType: 'image/jpeg' }));
  await assertFails(getBytes(a));
  await assertFails(getBytes(ref(env.unauthenticatedContext().storage(), path)));
});
test('unknown tickets, public avatar writes and processed writes are denied', async () => {
  const storage = env.authenticatedContext('alice').storage();
  for (const path of [
    'social-staging/alice/p/unknown',
    'social-processed/m/display.jpg',
    'avatars/alice',
  ])
    await assertFails(
      uploadBytes(ref(storage, path), new Uint8Array(3), { contentType: 'image/jpeg' }),
    );
});
