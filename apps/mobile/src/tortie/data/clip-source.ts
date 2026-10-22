import type { ClipPlatform } from '@/tortie/data/step-clips';

/**
 * What the Step clip sheet plays. YouTube, TikTok and Facebook play through the platform's own
 * embedded player. Instagram's embed cannot seek or report time, so it plays the video the API
 * downloaded at import, and only while `EXPO_PUBLIC_INSTAGRAM_STORED_VIDEO` is on. With no source,
 * "Watch step" opens the post in its app.
 */

export type EmbedSource =
  | { kind: 'youtube'; id: string }
  | { kind: 'tiktok'; id: string }
  | { kind: 'facebook'; href: string };

export type ClipSource =
  { kind: 'embed'; embed: EmbedSource } | { kind: 'file'; uri: string };

/** Bridge messages from the embed page: `time` is seconds into the source video. */
export type EmbedEvent =
  | { type: 'ready' }
  | { type: 'loading' }
  | { type: 'time'; t: number }
  | { type: 'ended' }
  | { type: 'error' };

/** Bridge commands to the embed page. */
export type EmbedCommand =
  { type: 'play' } | { type: 'pause' } | { type: 'seek'; t: number };

const YOUTUBE_ID = /^[\w-]{11}$/;

/** The video id in any YouTube link (`watch?v=`, `youtu.be/`, `/shorts/`, `/embed/`, `/live/`). */
export function youtubeId(url: string): string | null {
  const m =
    /youtu\.be\/([\w-]+)/i.exec(url) ??
    /youtube(?:-nocookie)?\.com\/(?:shorts|embed|live|v)\/([\w-]+)/i.exec(
      url,
    ) ??
    /youtube\.com\/.*[?&]v=([\w-]+)/i.exec(url);
  const id = m?.[1];
  return id && YOUTUBE_ID.test(id) ? id : null;
}

/** The numeric video id in a full TikTok link; short `vm.tiktok.com` links have none. */
export function tiktokId(url: string): string | null {
  return (
    /tiktok\.com\/(?:@[^/]+\/video|player\/v1|embed(?:\/v2)?)\/(\d+)/i.exec(
      url,
    )?.[1] ?? null
  );
}

/** The platform's embedded player for a source link; null when it has none we can drive. */
export function embedFor(
  platform: ClipPlatform | null,
  url: string | null | undefined,
): EmbedSource | null {
  const u = (url ?? '').trim();
  if (!u || !platform) return null;
  if (platform.key === 'youtube') {
    const id = youtubeId(u);
    return id ? { kind: 'youtube', id } : null;
  }
  if (platform.key === 'tiktok') {
    const id = tiktokId(u);
    return id ? { kind: 'tiktok', id } : null;
  }
  if (platform.key === 'facebook') return { kind: 'facebook', href: u };
  return null;
}

export function clipSource(o: {
  platform: ClipPlatform | null;
  url: string | null | undefined;
  /** The video the API downloaded at import. */
  file: string | null;
  instagramFile: boolean;
}): ClipSource | null {
  const embed = embedFor(o.platform, o.url);
  if (embed) return { kind: 'embed', embed };
  if (o.platform?.key === 'instagram' && o.instagramFile && o.file) {
    return { kind: 'file', uri: o.file };
  }
  return null;
}

/** Same key, same player: the sheet remounts the player when it changes. */
export function clipSourceKey(s: ClipSource): string {
  if (s.kind === 'file') return `file:${s.uri}`;
  const e = s.embed;
  return e.kind === 'facebook' ? `facebook:${e.href}` : `${e.kind}:${e.id}`;
}

/** A JSON literal safe to drop inside a `<script>`. */
const js = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c');

/** Gives up on an embed that never reports ready (removed, private, region-blocked). */
const READY_TIMEOUT_MS = 15000;

/**
 * The page the WebView loads for an embed. Every player speaks the same bridge: the app calls
 * `window.__clip(command)` and the page posts `EmbedEvent`s back. Commands sent before the
 * player is ready wait for it.
 */
export function embedHtml(e: EmbedSource, origin: string): string {
  return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>html,body{margin:0;height:100%;overflow:hidden;background:#191c19}
#p,iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.fb-video,.fb-video span,.fb-video iframe{width:100%!important;height:100%!important}</style>
</head><body><div id="p"></div><script>
var send=function(m){window.ReactNativeWebView.postMessage(JSON.stringify(m))};
var ready=false,queue=[],run=function(){};
window.__clip=function(c){if(ready)run(c);else queue.push(c)};
function isReady(){if(ready)return;ready=true;send({type:'ready'});queue.splice(0).forEach(run)}
setTimeout(function(){if(!ready)send({type:'error'})},${READY_TIMEOUT_MS});
var timer;
function tick(read){clearInterval(timer);timer=setInterval(function(){send({type:'time',t:read()})},250)}
function stop(){clearInterval(timer)}
${embedScript(e, origin)}
</script></body></html>`;
}

function embedScript(e: EmbedSource, origin: string): string {
  if (e.kind === 'youtube') {
    return `var P,started=false,id=${js(e.id)};
window.onYouTubeIframeAPIReady=function(){P=new YT.Player('p',{videoId:id,
playerVars:{playsinline:1,controls:0,disablekb:1,fs:0,rel:0,iv_load_policy:3,origin:${js(origin)}},
events:{onReady:isReady,onError:function(){send({type:'error'})},
onStateChange:function(ev){var s=ev.data;
if(s===1){started=true;send({type:'ready'});tick(function(){return P.getCurrentTime()})}else stop();
if(s===3)send({type:'loading'});if(s===0)send({type:'ended'})}}})};
// Before the first play a seek cues the video there, so it opens paused on that frame.
run=function(c){if(c.type==='play')P.playVideo();else if(c.type==='pause')P.pauseVideo();
else if(started)P.seekTo(c.t,true);else P.cueVideoById({videoId:id,startSeconds:c.t})};
var s=document.createElement('script');s.src='https://www.youtube.com/iframe_api';document.head.appendChild(s);`;
  }
  if (e.kind === 'tiktok') {
    const src =
      `https://www.tiktok.com/player/v1/${e.id}?controls=0&progress_bar=0&play_button=0` +
      '&volume_control=0&fullscreen_button=0&timestamp=0&loop=0&autoplay=0&music_info=0' +
      '&description=0&rel=0&native_context_menu=0&closed_caption=0';
    return `var f=document.createElement('iframe');f.src=${js(src)};
f.allow='autoplay; encrypted-media';document.getElementById('p').appendChild(f);
function post(type,value){f.contentWindow.postMessage({type:type,value:value,'x-tiktok-player':true},'*')}
window.addEventListener('message',function(ev){var d=ev.data;
if(typeof d==='string'){try{d=JSON.parse(d)}catch(_){return}}
if(!d||!d['x-tiktok-player'])return;
if(d.type==='onPlayerReady')isReady();
else if(d.type==='onCurrentTime'&&d.value)send({type:'time',t:d.value.currentTime});
else if(d.type==='onError')send({type:'error'});
else if(d.type==='onStateChange'){if(d.value===3)send({type:'loading'});
else if(d.value===1)send({type:'ready'});else if(d.value===0)send({type:'ended'})}});
run=function(c){if(c.type==='seek')post('seekTo',c.t);else post(c.type)};`;
  }
  return `var P,el=document.createElement('div');el.className='fb-video';
el.setAttribute('data-href',${js(e.href)});el.setAttribute('data-autoplay','false');
el.setAttribute('data-allowfullscreen','false');el.setAttribute('data-show-text','false');
document.getElementById('p').appendChild(el);
window.fbAsyncInit=function(){FB.Event.subscribe('xfbml.ready',function(m){if(m.type!=='video')return;
P=m.instance;
P.subscribe('startedPlaying',function(){send({type:'ready'});tick(function(){return P.getCurrentPosition()})});
P.subscribe('paused',stop);
P.subscribe('startedBuffering',function(){send({type:'loading'})});
P.subscribe('finishedBuffering',function(){send({type:'ready'})});
P.subscribe('finishedPlaying',function(){stop();send({type:'ended'})});
P.subscribe('error',function(){send({type:'error'})});
isReady()});FB.init({xfbml:true,version:'v21.0'})};
run=function(c){if(c.type==='play')P.play();else if(c.type==='pause')P.pause();else P.seek(c.t)};
var s=document.createElement('script');s.src='https://connect.facebook.net/en_US/sdk.js';s.async=true;document.head.appendChild(s);`;
}

/** Reads one bridge message; null for anything else the page might post. */
export function parseEmbedEvent(data: string): EmbedEvent | null {
  try {
    const m = JSON.parse(data) as { type?: unknown; t?: unknown };
    if (m.type === 'time') {
      return typeof m.t === 'number' && Number.isFinite(m.t)
        ? { type: 'time', t: m.t }
        : null;
    }
    if (
      m.type === 'ready' ||
      m.type === 'loading' ||
      m.type === 'ended' ||
      m.type === 'error'
    ) {
      return { type: m.type };
    }
    return null;
  } catch {
    return null;
  }
}
