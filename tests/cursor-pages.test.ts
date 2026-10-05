import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useCursorPages, type CursorPage } from '../src/data/useCursorPages';
(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const tick = () => new Promise((resolve) => setTimeout(resolve, 5));
test('cursor pages serialize requests, deduplicate IDs, preserve content after failures and retry the same cursor', async () => {
  let output: ReturnType<typeof useCursorPages>;
  const requests: (string | null)[] = [];
  let fail = false;
  const load = async (cursor: string | null) => {
    requests.push(cursor);
    if (fail) throw new Error('offline');
    return cursor ? { ids: ['b', 'c'], cursor: null } : { ids: ['a', 'b'], cursor: 'b' };
  };
  function Harness() {
    output = useCursorPages('alice', true, load);
    return null;
  }
  let view: ReactTestRenderer;
  await act(async () => {
    view = create(React.createElement(Harness));
  });
  await act(tick);
  assert.deepEqual(output!.ids, ['a', 'b']);
  fail = true;
  await act(async () => {
    output!.loadMore();
    output!.loadMore();
  });
  assert.deepEqual(requests, [null, 'b']);
  assert.deepEqual(output!.ids, ['a', 'b']);
  fail = false;
  await act(async () => output!.loadMore());
  assert.deepEqual(requests, [null, 'b', 'b']);
  assert.deepEqual(output!.ids, ['a', 'b', 'c']);
  assert.equal(output!.more, false);
  await act(async () => view.unmount());
});
test('account/filter switch clears old IDs immediately and ignores an outstanding response after switch or unmount', async () => {
  let output: ReturnType<typeof useCursorPages>;
  const complete: ((page: CursorPage) => void)[] = [];
  const load = () => new Promise<CursorPage>((resolve) => complete.push(resolve));
  function Harness({ account }: { account: string }) {
    output = useCursorPages(account, true, load);
    return null;
  }
  let view: ReactTestRenderer;
  await act(async () => {
    view = create(React.createElement(Harness, { account: 'alice' }));
  });
  await act(tick);
  await act(async () => view.update(React.createElement(Harness, { account: 'bob' })));
  await act(tick);
  await act(async () => complete[0]({ ids: ['alice-only'], cursor: null }));
  assert.deepEqual(output!.ids, []);
  await act(async () => complete[1]({ ids: ['bob-only'], cursor: 'next' }));
  assert.deepEqual(output!.ids, ['bob-only']);
  await act(async () => output!.loadMore());
  await act(async () => view.unmount());
  await act(async () => complete[2]({ ids: ['late'], cursor: null }));
  assert.deepEqual(output!.ids, ['bob-only']);
});
