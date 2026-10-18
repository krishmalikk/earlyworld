import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { communityPrivacy, communityRules } from '../shared/community-policy';
test('hosted and in-app policy wording remain consistent', () => {
  const page = readFileSync('hosting/community.html', 'utf8');
  const escape = (s: string) =>
    s
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#x27;');
  for (const paragraph of [...communityRules, ...communityPrivacy])
    assert.ok(page.includes(escape(paragraph)));
  assert.ok(page.includes('/delete-account.html'));
});
