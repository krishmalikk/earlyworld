import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MediaRenewals, privateMediaExpiry } from '../shared/media-renewal';
const url = (seconds: number) =>
  `https://storage.googleapis.com/private/photo?GoogleAccessId=service&Expires=${seconds}&Signature=test`;
test('only signed private image links are renewed', () => {
  assert.equal(privateMediaExpiry(url(1000)), 1000000);
  assert.equal(
    privateMediaExpiry(
      'https://storage.googleapis.com/b/p?X-Goog-Date=20261018T120000Z&X-Goog-Expires=300&X-Goog-Signature=test',
    ),
    Date.parse('2026-10-18T12:05:00Z'),
  );
  for (const value of [
    null,
    'file:///photo',
    'https://i1.sndcdn.com/art.jpg',
    'https://storage.googleapis.com/b/public',
    url(0),
  ])
    assert.equal(privateMediaExpiry(value), null);
});
test('renewal batches images before expiry and deduplicates errors with bounded retries', () => {
  const renewals = new MediaRenewals();
  renewals.register(url(1000));
  renewals.register(url(1001));
  assert.equal(renewals.due(969000), false);
  assert.equal(renewals.due(970000), true);
  assert.equal(renewals.due(970001, url(1000)), false);
  assert.equal(renewals.due(1000000), true); // retry after a failed request or foreground resume
});
test('unmounting duplicate images and account changes release registrations', () => {
  const renewals = new MediaRenewals();
  const first = renewals.register(url(1000)),
    second = renewals.register(url(1000));
  first();
  assert.equal(renewals.due(1, url(1000)), true);
  second();
  assert.equal(renewals.due(1000001), false);
  assert.equal(new MediaRenewals().due(1000001, url(1000)), false);
});
test('replacing expired links stops renewal until the new link approaches expiry', () => {
  const renewals = new MediaRenewals(),
    remove = renewals.register(url(1000));
  assert.equal(renewals.due(1000000), true);
  remove();
  renewals.register(url(1300));
  assert.equal(renewals.due(1030000), false);
  assert.equal(renewals.due(1270000), true);
});
