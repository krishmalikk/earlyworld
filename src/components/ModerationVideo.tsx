import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useForeground } from '../data/listeners';
export function ModerationVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri),
    active = useForeground();
  useEffect(() => {
    if (!active) player.pause();
  }, [active, player]);
  useFocusEffect(useCallback(() => () => player.pause(), [player]));
  return (
    <VideoView
      player={player}
      contentFit="contain"
      nativeControls
      style={{ width: '100%', height: 400 }}
    />
  );
}
