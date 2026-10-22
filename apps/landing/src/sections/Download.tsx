import type { CSSProperties } from 'react';

import logo from '../assets/tortie-logo.png';
import { StoreBadges } from '../components/StoreBadges';

export function Download() {
  return (
    <section className="section download" id="download">
      <div className="wrap">
        <div className="download__card" data-reveal>
          <div className="download__confetti" aria-hidden="true">
            {Array.from({ length: 14 }, (_, i) => (
              <i key={i} style={{ '--i': i } as CSSProperties} />
            ))}
          </div>
          <img className="download__cat" src={logo} alt="" />
          <h2>
            Ready when <em>you are.</em>
          </h2>
          <p>Tortie is available now on Android. The iPhone app is on its way.</p>
          <StoreBadges tone="light" />
        </div>
      </div>
    </section>
  );
}
