import { APP_STORE_URL, PLAY_STORE_URL } from '../content';

function PlayMark() {
  return (
    <svg width="26" height="28" viewBox="0 0 26 28" aria-hidden="true">
      <path d="M1.4 1.2 14.6 14 1.4 26.8A2 2 0 0 1 1 25.6V2.4c0-.5.1-.9.4-1.2Z" fill="#32bbff" />
      <path d="m19.1 9.6-4.5 4.4L1.4 1.2c.3-.3.9-.4 1.5-.1l16.2 8.5Z" fill="#2fd573" />
      <path d="m19.1 18.4-16.2 8.5c-.6.3-1.2.2-1.5-.1L14.6 14l4.5 4.4Z" fill="#ff4a52" />
      <path d="M24 12.2c1.3.7 1.3 2.9 0 3.6l-4.9 2.6-4.5-4.4 4.5-4.4 4.9 2.6Z" fill="#ffd400" />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg width="22" height="26" viewBox="0 0 22 26" aria-hidden="true" fill="currentColor">
      <path d="M18.2 13.8c0-3 2.5-4.5 2.6-4.6-1.4-2.1-3.6-2.4-4.4-2.4-1.9-.2-3.6 1.1-4.6 1.1-.9 0-2.4-1.1-3.9-1-2 0-3.9 1.2-5 3-2.1 3.7-.5 9.2 1.5 12.2 1 1.5 2.2 3.1 3.8 3 1.5-.1 2.1-1 3.9-1s2.4 1 3.9.9c1.6 0 2.7-1.5 3.6-3 1.1-1.7 1.6-3.4 1.6-3.5-.1 0-3-1.2-3-4.7ZM15.3 4.9c.8-1 1.4-2.4 1.2-3.8-1.2.1-2.6.8-3.5 1.8-.8.9-1.4 2.3-1.2 3.7 1.3.1 2.7-.7 3.5-1.7Z" />
    </svg>
  );
}

export function StoreBadges({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  return (
    <div className={`stores stores--${tone}`}>
      <a className="store" href={PLAY_STORE_URL} target="_blank" rel="noreferrer">
        <PlayMark />
        <span className="store__text">
          <small>Get it on</small>
          <strong>Google Play</strong>
        </span>
      </a>
      {APP_STORE_URL ? (
        <a className="store" href={APP_STORE_URL} target="_blank" rel="noreferrer">
          <AppleMark />
          <span className="store__text">
            <small>Download on the</small>
            <strong>App Store</strong>
          </span>
        </a>
      ) : (
        <span className="store store--soon" aria-disabled="true" title="Tortie for iPhone is on its way">
          <AppleMark />
          <span className="store__text">
            <small>Coming soon to the</small>
            <strong>App Store</strong>
          </span>
          <span className="store__ribbon">Soon</span>
        </span>
      )}
    </div>
  );
}
