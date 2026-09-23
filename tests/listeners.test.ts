import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(path.join(dir, e.name)) : [path.join(dir, e.name)],
  );
}
test('server snapshots stay outside Zustand; screens cannot introduce one-shot reads', () => {
  for (const file of [...files('app'), ...files('src')].filter((f) => /\.tsx?$/.test(f))) {
    const text = readFileSync(file, 'utf8');
    assert.doesNotMatch(text, /\b(getDoc|getDocs)\s*\(/, file);
    if (file.startsWith('src/state/'))
      assert.doesNotMatch(text, /onSnapshot|Track\[\]|User\[\]|Rotation\[\]/, file);
  }
});
