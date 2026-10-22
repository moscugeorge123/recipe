import logo from './assets/tortie-logo.png';
import { PLAY_STORE_URL } from './content';
import { useRevealOnScroll, useScrollY } from './hooks';
import { CookSection } from './sections/CookSection';
import { Download } from './sections/Download';
import { Features } from './sections/Features';
import { Hero } from './sections/Hero';
import { ImportSection } from './sections/ImportSection';
import { Kitchen } from './sections/Kitchen';
import { Marquee } from './sections/Marquee';

function Nav() {
  const scrolled = useScrollY() > 12;
  return (
    <nav className={`nav ${scrolled ? 'is-scrolled' : ''}`}>
      <div className="wrap nav__inner">
        <a className="brand" href="#top">
          <img src={logo} alt="" />
          <span>Tortie</span>
        </a>
        <div className="nav__links">
          <a href="#import">Import</a>
          <a href="#features">Features</a>
          <a href="#cook">Cook mode</a>
        </div>
        <a className="btn btn--terra btn--sm" href={PLAY_STORE_URL} target="_blank" rel="noreferrer">
          Get the app
        </a>
      </div>
    </nav>
  );
}

function Footer() {
  return (
    <footer className="footer">
      <div className="wrap footer__inner">
        <a className="brand" href="#top">
          <img src={logo} alt="" />
          <span>Tortie</span>
        </a>
        <p>Every recipe you love, in one kitchen.</p>
        <small>© {new Date().getFullYear()} Tortie</small>
      </div>
    </footer>
  );
}

export function App() {
  useRevealOnScroll();
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Marquee />
        <ImportSection />
        <Features />
        <CookSection />
        <Kitchen />
        <Download />
      </main>
      <Footer />
    </>
  );
}
