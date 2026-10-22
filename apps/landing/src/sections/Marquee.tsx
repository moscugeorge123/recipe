import { SOURCES } from '../content';

export function Marquee() {
  const row = [...SOURCES, ...SOURCES];
  return (
    <section className="marquee" aria-label="Import sources">
      <p className="marquee__label">Save recipes from</p>
      <div className="marquee__track">
        <ul className="marquee__row">
          {row.map((s, i) => (
            <li key={i} aria-hidden={i >= SOURCES.length}>
              <span className="marquee__dot" />
              {s}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
