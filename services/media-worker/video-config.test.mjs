import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inspectVideo, videoConfig, retryTranscode } from './video-config.mjs';
test('only terminal transient provider failures can retry, at most once', () => {
  for (const code of [4, 13, 14]) {
    assert.equal(retryTranscode({ state: 'FAILED', error: { code } }, 0), true);
    assert.equal(retryTranscode({ state: 'FAILED', error: { code } }, 1), false);
  }
  for (const state of ['PENDING', 'RUNNING', 'SUCCEEDED', undefined])
    assert.equal(retryTranscode({ state, error: { code: 13 } }, 0), false);
  for (const code of [3, 5, 7, undefined])
    assert.equal(retryTranscode({ state: 'FAILED', error: { code } }, 0), false);
});
const probe = (duration = 60, audio = true) => ({
  format: { duration },
  streams: [
    { codec_type: 'video', width: 1920, height: 1080 },
    ...(audio ? [{ codec_type: 'audio' }] : []),
  ],
});
test('video boundaries, silence and rotation are validated before encoding', () => {
  assert.equal(inspectVideo(probe(5)).duration, 5);
  assert.equal(inspectVideo(probe()).duration, 60);
  for (const seconds of [0, 4.9, 60.1, NaN]) assert.throws(() => inspectVideo(probe(seconds)));
  const p = probe(30, false);
  p.streams[0].side_data_list = [{ rotation: -90 }];
  assert.deepEqual(inspectVideo(p), { duration: 30, width: 1080, height: 1920, audio: false });
});
test('silent videos have no audio mapping; aspect ratio and bounded outputs are preserved', () => {
  const cfg = videoConfig({ width: 1080, height: 1920, audio: false }, 'gs://a/in', 'gs://a/out/');
  assert.equal(cfg.elementaryStreams.length, 2);
  assert.equal(cfg.elementaryStreams[0].videoStream.h264.widthPixels, 720);
  assert.equal(cfg.elementaryStreams[0].videoStream.h264.heightPixels, 1280);
  assert.deepEqual(cfg.muxStreams[0].elementaryStreams, ['v0']);
  const audio = videoConfig(inspectVideo(probe()), 'gs://a/in', 'gs://a/out/');
  assert.equal(audio.elementaryStreams[2].audioStream.codec, 'aac');
});
