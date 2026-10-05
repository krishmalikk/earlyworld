// Retry only a conclusively failed provider job, once. Unknown dispatches must
// remain in reconciliation so timeouts cannot start duplicate billed jobs.
export function retryTranscode(job, retries) {
  return job.state === 'FAILED' && [4, 13, 14].includes(job.error?.code) && retries < 1;
}

export function inspectVideo(probe) {
  if (
    probe.format?.format_name &&
    !probe.format.format_name.split(',').includes('mov') &&
    !probe.format.format_name.split(',').includes('mp4')
  )
    throw Error('invalid-container');
  const video = probe.streams?.find((s) => s.codec_type === 'video');
  const duration = Number(probe.format?.duration);
  if (
    !video ||
    !Number.isFinite(duration) ||
    duration < 5 ||
    duration > 60 ||
    !video.width ||
    !video.height ||
    video.width > 7680 ||
    video.height > 7680
  )
    throw Error('invalid-video');
  const rotation =
    Math.abs(
      Number(
        video.tags?.rotate || video.side_data_list?.find((s) => s.rotation != null)?.rotation || 0,
      ),
    ) % 180;
  return {
    duration,
    width: rotation === 90 ? video.height : video.width,
    height: rotation === 90 ? video.width : video.height,
    audio: probe.streams.some((s) => s.codec_type === 'audio'),
  };
}
export function videoConfig(info, input, output) {
  const sizes = [720, 480].map((size) => {
    const scale = Math.min(
      1,
      size / Math.min(info.width, info.height),
      1280 / Math.max(info.width, info.height),
    );
    return {
      widthPixels: Math.max(2, Math.floor((info.width * scale) / 2) * 2),
      heightPixels: Math.max(2, Math.floor((info.height * scale) / 2) * 2),
    };
  });
  return {
    inputs: [{ key: 'input0', uri: input }],
    output: { uri: output },
    elementaryStreams: [
      ...sizes.map((size, i) => ({
        key: `v${i}`,
        videoStream: {
          h264: {
            ...size,
            bitrateBps: i === 0 ? 2200000 : 900000,
            frameRate: 30,
            pixelFormat: 'yuv420p',
          },
        },
      })),
      ...(info.audio ? [{ key: 'audio', audioStream: { codec: 'aac', bitrateBps: 128000 } }] : []),
    ],
    muxStreams: sizes.map((_, i) => ({
      key: `video${i}`,
      container: 'mp4',
      elementaryStreams: [`v${i}`, ...(info.audio ? ['audio'] : [])],
    })),
  };
}
