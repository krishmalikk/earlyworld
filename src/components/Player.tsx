import React, { useEffect, useRef, useState } from 'react';
import { Linking, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import type { Track } from '../data/types';
import { PlaybackTracker } from '../../shared/playback';
import { normalizeSource } from '../../shared/domain';
import { call, errorMessage } from '../lib/firebase';
import { useForeground } from '../data/listeners';
import { useLocal } from '../state/local';
import { Button, c, ErrorLine, s } from './ui';
function safeJSON(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
/** The provider reports position, not engagement. Native code verifies continuous playback. */
export function playerHTML(track: Track) {
  const origin = process.env.EXPO_PUBLIC_EMBED_ORIGIN || 'https://earlyworld.app';
  const post = `function post(position,duration,playing){window.ReactNativeWebView.postMessage(JSON.stringify({position:position,duration:duration,playing:playing}));}`;
  const base = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="strict-origin-when-cross-origin"><style>html,body{margin:0;background:#0d0f0d;height:100%;}iframe{border:0;width:100%;height:100%}</style></head><body>`;
  if (track.sourcePlatform === 'soundcloud')
    return `${base}<iframe id="player" allow="autoplay" src="https://w.soundcloud.com/player/?url=${encodeURIComponent(track.sourceUrl)}&auto_play=false&visual=false&color=%23c1ef83"></iframe><script src="https://w.soundcloud.com/player/api.js"></script><script>${post}var w=SC.Widget('player'),d=0,playing=false;w.bind(SC.Widget.Events.READY,function(){w.getDuration(function(n){d=n/1000;});});w.bind(SC.Widget.Events.PLAY,function(){playing=true;w.getDuration(function(n){d=n/1000;});});w.bind(SC.Widget.Events.PAUSE,function(){playing=false;post(0,d,false);});w.bind(SC.Widget.Events.SEEK,function(){post(0,d,false);});w.bind(SC.Widget.Events.PLAY_PROGRESS,function(e){post(e.currentPosition/1000,d,playing);});w.bind(SC.Widget.Events.FINISH,function(){post(d,d,false);});</script></body></html>`;
  if (track.sourcePlatform === 'youtube') {
    const id = new URL(normalizeSource(track.sourceUrl).url).searchParams.get('v');
    return `${base}<div id="player"></div><script>${post}var p;function onYouTubeIframeAPIReady(){p=new YT.Player('player',{width:'100%',height:'100%',videoId:${safeJSON(id)},playerVars:{playsinline:1,autoplay:0,origin:${safeJSON(origin)}},events:{onReady:function(){setInterval(function(){post(p.getCurrentTime(),p.getDuration(),p.getPlayerState()===1);},500);}}});}</script><script src="https://www.youtube.com/iframe_api"></script></body></html>`;
  }
  return `${base}${track.embedUrl ? `<iframe src="${track.embedUrl.replace(/["<>]/g, '')}" seamless></iframe>` : ''}</body></html>`;
}
export function Player({ track }: { track: Track }) {
  const [enabled, setEnabled] = useState(false),
    [session, setSession] = useState<string | null>(null),
    [error, setError] = useState<string | null>(null),
    [busy, setBusy] = useState(false);
  const tracker = useRef(new PlaybackTracker()),
    active = useForeground(),
    playing = useLocal((s) => s.playingTrackId),
    setPlaying = useLocal((s) => s.setPlaying);
  useEffect(
    () => () => {
      if (useLocal.getState().playingTrackId === track.id) setPlaying(null);
    },
    [track.id, setPlaying],
  );
  useEffect(() => {
    if (!active || playing !== track.id) {
      setEnabled(false);
      tracker.current.resetPosition();
    }
  }, [active, playing, track.id]);
  async function start() {
    setBusy(true);
    setError(null);
    try {
      const result = await call<{ sessionId: string }>('beginPlayback', { trackId: track.id });
      setSession(result.sessionId);
      tracker.current = new PlaybackTracker();
      tracker.current.interact();
      setPlaying(track.id);
      setEnabled(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={{ gap: 10 }}>
      {enabled && active ? (
        <WebView
          key={session}
          style={{ height: track.sourcePlatform === 'youtube' ? 230 : 166, backgroundColor: c.bg }}
          source={{
            html: playerHTML(track),
            baseUrl: process.env.EXPO_PUBLIC_EMBED_ORIGIN || 'https://earlyworld.app',
          }}
          originWhitelist={['https://*']}
          javaScriptEnabled
          allowsInlineMediaPlayback
          mediaPlaybackRequiresUserAction
          onShouldStartLoadWithRequest={(request) => {
            if (
              !request.isTopFrame ||
              request.url === 'about:blank' ||
              request.url ===
                (process.env.EXPO_PUBLIC_EMBED_ORIGIN || 'https://earlyworld.app') + '/'
            )
              return true;
            if (request.navigationType === 'click') {
              Linking.openURL(request.url).catch(() => {});
              return false;
            }
            return true;
          }}
          onError={() => setError('The player could not load. Open the track at its source.')}
          onMessage={async (event) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (typeof data.playing !== 'boolean') return;
              const result = tracker.current.sample(
                data.position,
                data.duration,
                data.playing,
                Date.now(),
              );
              if (result && session)
                await call('recordEngagement', {
                  entityId: track.artistId,
                  entityType: 'artist',
                  trackId: track.id,
                  eventType: 'listen',
                  ...result,
                  sessionId: session,
                });
            } catch (e) {
              setError(errorMessage(e));
            }
          }}
        />
      ) : (
        <Button onPress={start} busy={busy}>
          Open player · {track.sourcePlatform}
        </Button>
      )}
      {track.sourcePlatform === 'bandcamp' ? (
        <Text style={s.muted}>
          Bandcamp playback is embedded. Saves and comments build your Rotation here.
        </Text>
      ) : null}
      <ErrorLine message={error} />
      <Text onPress={() => Linking.openURL(track.sourceUrl)} style={s.link}>
        Listen on {track.sourcePlatform} ↗
      </Text>
    </View>
  );
}
