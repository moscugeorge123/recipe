import { Fragment } from 'react';

import logo from '../assets/tortie-logo.png';
import { CookScreen, GroceriesScreen, Phone, RecipeScreen, TodayScreen } from '../components/Phone';
import { Icon } from '../components/Icon';
import { StoreBadges } from '../components/StoreBadges';
import { useScrollY, useTicker } from '../hooks';

const SCREENS = ['Today', 'Recipe', 'Cook mode', 'Groceries'] as const;
const SECONDS_PER_SCREEN = 4;

export function Hero() {
  const tick = useTicker(1000);
  const y = useScrollY();
  const active = Math.floor(tick / SECONDS_PER_SCREEN) % SCREENS.length;
  const local = tick % SECONDS_PER_SCREEN;
  const words = ['Every', 'recipe', 'you', 'love,'];

  return (
    <section className="hero" id="top">
      <div className="hero__blobs" aria-hidden="true">
        <span className="blob blob--green" />
        <span className="blob blob--terra" />
        <span className="blob blob--sun" />
      </div>

      <div className="wrap hero__grid">
        <div className="hero__copy">
          <span className="pill pill--soft hero__kicker">
            <Icon name="sparkle" size={14} /> Your recipe box, finally tidy
          </span>
          <h1 className="hero__title">
            {words.map((w, i) => (
              <Fragment key={w}>
                <span className="word" style={{ animationDelay: `${120 + i * 90}ms` }}>
                  {w}
                </span>{' '}
              </Fragment>
            ))}
            <em className="word" style={{ animationDelay: '520ms' }}>
              in one kitchen.
            </em>
          </h1>
          <p className="hero__lede">
            Tortie pulls recipes from any website, video or cookbook page into one calm, ad-free cookbook, then walks you
            through cooking, planning and shopping, step by step.
          </p>
          <StoreBadges />
          <ul className="hero__proof">
            <li>
              <Icon name="check" size={16} /> No ads, no life stories
            </li>
            <li>
              <Icon name="check" size={16} /> Works with links &amp; photos
            </li>
            <li>
              <Icon name="check" size={16} /> Free to start
            </li>
          </ul>
        </div>

        <div className="hero__stage" style={{ transform: `translateY(${y * -0.06}px)` }}>
          <img className="hero__cat" src={logo} alt="Tortie, a calico cat holding a steaming bowl" />
          <svg className="hero__steam" viewBox="0 0 60 60" aria-hidden="true">
            <path d="M15 55c-8-10 8-14 0-26s6-16 0-26" />
            <path d="M30 55c-8-10 8-14 0-26s6-16 0-26" />
            <path d="M45 55c-8-10 8-14 0-26s6-16 0-26" />
          </svg>

          <Phone className="hero__phone">
            <div className="screens">
              {SCREENS.map((name, i) => (
                <div key={name} className={`screen ${i === active ? 'is-active' : ''} ${i === (active + SCREENS.length - 1) % SCREENS.length ? 'is-leaving' : ''}`}>
                  {i === 0 && <TodayScreen />}
                  {i === 1 && <RecipeScreen />}
                  {i === 2 && <CookScreen step={2} timerLeft={i === active ? 300 - local * 17 : 300} />}
                  {i === 3 && <GroceriesScreen checked={i === active ? local + 1 : 0} />}
                </div>
              ))}
            </div>
          </Phone>

          <div className="float float--a" style={{ transform: `translateY(${y * -0.12}px)` }}>
            <span className="float__icon float__icon--green">
              <Icon name="check" size={16} />
            </span>
            <span>
              <b>Imported from TikTok</b>
              <small>7 ingredients · 4 steps</small>
            </span>
          </div>
          <div className="float float--b" style={{ transform: `translateY(${y * -0.2}px)` }}>
            <span className="float__icon float__icon--terra">
              <Icon name="flame" size={16} />
            </span>
            <span>
              <b>252 kcal</b>
              <small>per serving</small>
            </span>
          </div>
          <div className="float float--c" style={{ transform: `translateY(${y * -0.08}px)` }}>
            <span className="float__icon float__icon--amber">
              <Icon name="bell" size={16} />
            </span>
            <span>
              <b>Timer done</b>
              <small>Rest the guacamole</small>
            </span>
          </div>

          <div className="hero__dots" role="presentation">
            {SCREENS.map((name, i) => (
              <span key={name} className={i === active ? 'is-active' : ''}>
                {name}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
