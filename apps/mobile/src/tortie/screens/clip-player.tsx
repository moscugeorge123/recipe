import { useVideoPlayer, VideoView, type VideoPlayer } from 'expo-video';
import {
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type Ref,
} from 'react';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

import { getEmbedOrigin } from '@/constants/env';
import {
  embedHtml,
  parseEmbedEvent,
  type ClipSource,
  type EmbedCommand,
  type EmbedSource,
} from '@/tortie/data/clip-source';
import { TICK_SECONDS } from '@/tortie/data/step-clips';

/** What the Step clip sheet drives, whether the video is a file or a platform embed. */
export type ClipDriver = {
  play: () => void;
  pause: () => void;
  seek: (seconds: number) => void;
};

export type ClipStatus = 'loading' | 'ready' | 'error';

export type ClipEvents = {
  /** Seconds into the source video, about every quarter second while playing. */
  onTime: (seconds: number) => void;
  /** The video itself reached its end. */
  onEnded: () => void;
  onStatus: (status: ClipStatus) => void;
};

type Props = ClipEvents & {
  source: ClipSource;
  vertical: boolean;
  ref: Ref<ClipDriver>;
};

const PLAYER_BG = '#191c19';

export function ClipPlayer({ source, ...rest }: Props) {
  return source.kind === 'file' ? (
    <FileClip uri={source.uri} {...rest} />
  ) : (
    <EmbedClip embed={source.embed} {...rest} />
  );
}

/** The latest callbacks, so subscriptions made once still call the current ones. */
function useEvents(events: ClipEvents) {
  const ref = useRef(events);
  useEffect(() => {
    ref.current = events;
  });
  return ref;
}

/** Moves the player; kept outside components so the compiler sees no render-time mutation. */
function seekTo(player: VideoPlayer, seconds: number) {
  player.currentTime = seconds;
}

function FileClip({
  uri,
  vertical,
  ref,
  onTime,
  onEnded,
  onStatus,
}: Omit<Props, 'source'> & { uri: string }) {
  const ev = useEvents({ onTime, onEnded, onStatus });
  const player = useVideoPlayer(uri, (pl) => {
    pl.timeUpdateEventInterval = TICK_SECONDS;
  });
  useImperativeHandle(
    ref,
    () => ({
      play: () => player.play(),
      pause: () => player.pause(),
      seek: (s) => seekTo(player, s),
    }),
    [player],
  );
  useEffect(() => {
    const subs = [
      player.addListener('timeUpdate', ({ currentTime }) =>
        ev.current.onTime(currentTime),
      ),
      player.addListener('playToEnd', () => ev.current.onEnded()),
      player.addListener('statusChange', ({ status }) => {
        if (status === 'loading') ev.current.onStatus('loading');
        else if (status === 'readyToPlay') ev.current.onStatus('ready');
        else if (status === 'error') ev.current.onStatus('error');
      }),
    ];
    return () => subs.forEach((sub) => sub.remove());
  }, [player, ev]);
  return (
    <VideoView
      player={player}
      nativeControls={false}
      contentFit={vertical ? 'cover' : 'contain'}
      style={{ flex: 1 }}
    />
  );
}

/** YouTube, TikTok or Facebook's own player in a WebView, driven over the bridge in `embedHtml`. */
function EmbedClip({
  embed,
  ref,
  onTime,
  onEnded,
  onStatus,
}: Omit<Props, 'source' | 'vertical'> & { embed: EmbedSource }) {
  const ev = useEvents({ onTime, onEnded, onStatus });
  const web = useRef<WebView>(null);
  const origin = getEmbedOrigin();
  const html = useMemo(() => embedHtml(embed, origin), [embed, origin]);
  useImperativeHandle(ref, () => {
    const send = (c: EmbedCommand) =>
      web.current?.injectJavaScript(
        `window.__clip&&window.__clip(${JSON.stringify(c)});true;`,
      );
    return {
      play: () => send({ type: 'play' }),
      pause: () => send({ type: 'pause' }),
      seek: (t) => send({ type: 'seek', t }),
    };
  }, []);

  const onMessage = (e: WebViewMessageEvent) => {
    const m = parseEmbedEvent(e.nativeEvent.data);
    if (!m) return;
    if (m.type === 'time') ev.current.onTime(m.t);
    else if (m.type === 'ended') ev.current.onEnded();
    else ev.current.onStatus(m.type);
  };

  return (
    <WebView
      ref={web}
      source={{ html, baseUrl: origin }}
      originWhitelist={['*']}
      onMessage={onMessage}
      onError={() => ev.current.onStatus('error')}
      // The page stays put; the players load in frames.
      onShouldStartLoadWithRequest={(req) =>
        !req.isTopFrame ||
        req.url.startsWith(origin) ||
        req.url === 'about:blank'
      }
      allowsInlineMediaPlayback
      mediaPlaybackRequiresUserAction={false}
      allowsFullscreenVideo={false}
      scrollEnabled={false}
      bounces={false}
      overScrollMode="never"
      setSupportMultipleWindows={false}
      style={{ flex: 1, backgroundColor: PLAYER_BG }}
      containerStyle={{ backgroundColor: PLAYER_BG }}
    />
  );
}
