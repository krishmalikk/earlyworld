import test from 'node:test';
import assert from 'node:assert/strict';
import { bandcampMetadata } from '../functions/src/bandcamp';
test('Bandcamp resolves escaped public track metadata without downloading audio', () => {
  const result = bandcampMetadata(
    `<meta content="A &amp; B" property="og:title"><meta property='og:image' content='https://f4.bcbits.com/img/a.jpg'><script data-tralbum="{&quot;artist&quot;:&quot;Artist&quot;,&quot;trackinfo&quot;:[{&quot;track_id&quot;:12345}]}"></script>`,
  );
  assert.equal(result.title, 'A & B');
  assert.equal(result.artistName, 'Artist');
  assert.deepEqual(bandcampMetadata('<meta property="og:title" content="No player">'), {
    title: 'No player',
    artworkUrl: '',
    artistName: '',
  });
});
