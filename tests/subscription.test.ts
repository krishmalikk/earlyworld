import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { useSubscription, type Subscribe } from '../src/data/useSubscription';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
test('listeners detach on unmount/background, resume once, and ignore late events', async () => {
  let attached = 0,
    detached = 0,
    next: (value: string) => void = () => {},
    value = '';
  const subscribe: Subscribe<string> = (emit) => {
    attached++;
    next = emit;
    return () => {
      detached++;
    };
  };
  function Harness({ active, account = 'alice' }: { active: boolean; account?: string }) {
    const result = useSubscription(account, subscribe, 'empty', active);
    value = result.data;
    return null;
  }
  let renderer: ReactTestRenderer;
  await act(async () => {
    renderer = create(React.createElement(Harness, { active: true }));
  });
  assert.equal(attached, 1);
  await act(async () => {
    next('cached');
  });
  assert.equal(value, 'cached');
  await act(async () => {
    renderer.update(React.createElement(Harness, { active: false }));
  });
  assert.equal(detached, 1);
  await act(async () => {
    next('late update');
  });
  assert.equal(value, 'cached');
  await act(async () => {
    renderer.update(React.createElement(Harness, { active: true }));
  });
  assert.equal(attached, 2);
  await act(async () => {
    renderer.update(React.createElement(Harness, { active: true, account: 'bob' }));
  });
  assert.equal(detached, 2);
  assert.equal(value, 'empty');
  await act(async () => {
    renderer.unmount();
  });
  assert.equal(detached, 3);
});
