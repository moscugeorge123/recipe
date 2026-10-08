import { NavLink, Outlet } from 'react-router-dom';

import { usingFixtures } from '../api';

const LINKS = [
  { to: '/', label: 'Overview', end: true },
  { to: '/imports', label: 'Imports', end: false },
  { to: '/usage', label: 'Usage', end: false },
  { to: '/logs', label: 'Logs', end: false },
] as const;

export function Layout() {
  const mode = usingFixtures() ? 'Fixtures' : 'Live';

  return (
    <div className="shell">
      <a className="skip" href="#content">
        Skip to content
      </a>
      <aside className="rail">
        <div className="brand-copy">
          <NavLink to="/" end className="wordmark">
            Import ledger
          </NavLink>
          <p className="tagline">Recipe import cost and time</p>
        </div>
        <nav aria-label="Primary">
          {LINKS.map((link) => (
            <NavLink key={link.to} to={link.to} end={link.end}>
              {link.label}
            </NavLink>
          ))}
        </nav>
        <p className="mode" aria-label={`Data source: ${mode}`}>
          <span>Data</span>
          <strong>{mode}</strong>
        </p>
      </aside>
      <main className="main" id="content">
        <div className="content">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
