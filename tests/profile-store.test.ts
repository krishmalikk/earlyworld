import test from 'node:test';
import assert from 'node:assert/strict';
import { ProfileStore, type LoadedProfile } from '../src/data/profile-store';

const tick = () => new Promise((resolve) => setTimeout(resolve, 5));
const person = (id: string, username = id): LoadedProfile => ({ id, username, avatarUrl: '' });

test('rows on one screen share batched requests of at most 30 listeners', async () => {
  const requests: string[][] = [];
  const store = new ProfileStore(
    async (uids) => {
      requests.push(uids);
      return uids.map((id) => person(id));
    },
    undefined,
    0,
  );
  const ids = Array.from({ length: 35 }, (_, i) => `u${i}`);
  ids.forEach((id) => store.retain(id));
  store.retain('u0');
  await tick();
  assert.deepEqual(
    requests.map((r) => r.length),
    [30, 5],
  );
  assert.equal(store.get('u34')?.username, 'u34');
  store.retain('u0');
  await tick();
  assert.equal(requests.length, 2, 'cached identities need no request');
});

test('withheld listeners become null; failures keep cached identity and retry', async () => {
  let fail = false,
    hidden = false,
    failures = 0;
  const store = new ProfileStore(
    async (uids) => {
      if (fail) throw Error('offline');
      return hidden ? [] : uids.map((id) => person(id, 'first'));
    },
    () => failures++,
    0,
  );
  store.retain('a');
  await tick();
  fail = true;
  store.refresh();
  await tick();
  assert.equal(failures, 1);
  assert.equal(store.get('a')?.username, 'first');
  fail = false;
  hidden = true;
  store.refresh();
  await tick();
  assert.equal(store.get('a'), null);
});

test('refresh only requests mounted rows, notifies on change, and closed stores ignore late data', async () => {
  const requests: string[][] = [];
  let name = 'old',
    notified = 0;
  const store = new ProfileStore(
    async (uids) => {
      requests.push(uids);
      return uids.map((id) => person(id, name));
    },
    undefined,
    0,
  );
  store.subscribe(() => notified++);
  const release = store.retain('gone');
  store.retain('here');
  await tick();
  assert.equal(notified, 1);
  release();
  store.refresh();
  await tick();
  assert.deepEqual(requests.at(-1), ['here']);
  assert.equal(notified, 1, 'identical data does not re-render rows');
  assert.equal(store.get('gone'), undefined);
  name = 'new';
  store.refresh();
  await tick();
  assert.equal(store.get('here')?.username, 'new');
  store.close();
  name = 'late';
  store.refresh();
  await tick();
  assert.equal(store.get('here')?.username, 'new');
});
