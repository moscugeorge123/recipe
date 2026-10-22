import type { ReactNode } from 'react';

import { COOK_STEPS } from '../content';
import { Dish } from './Dish';
import { Icon } from './Icon';

export function Phone({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`phone ${className}`}>
      <div className="phone__screen">
        <div className="phone__status">
          <span>9:41</span>
          <span className="phone__island" />
          <span className="phone__bars">
            <i />
            <i />
            <i />
          </span>
        </div>
        {children}
        <div className="phone__home" />
      </div>
    </div>
  );
}

function TabBar({ active }: { active: 'today' | 'cookbook' | 'plan' | 'groceries' }) {
  const tabs = [
    ['today', 'home', 'Today'],
    ['cookbook', 'book', 'Cookbook'],
    ['plus', 'plus', ''],
    ['plan', 'calendar', 'Plan'],
    ['groceries', 'basket', 'Groceries'],
  ] as const;
  return (
    <div className="ph-tabs">
      {tabs.map(([key, icon, label]) =>
        key === 'plus' ? (
          <span key={key} className="ph-tabs__plus">
            <Icon name="plus" size={20} />
          </span>
        ) : (
          <span key={key} className={`ph-tabs__tab ${key === active ? 'is-active' : ''}`}>
            <span className="ph-tabs__pill">
              <Icon name={icon} size={16} />
            </span>
            {label}
          </span>
        ),
      )}
    </div>
  );
}

export function TodayScreen() {
  const week = [
    ['M', 12, 2],
    ['T', 13, 1],
    ['W', 14, 3],
    ['T', 15, 0],
    ['F', 16, 2],
    ['S', 17, 1],
    ['S', 18, 0],
  ] as const;
  return (
    <div className="ph-body">
      <div className="ph-greet">
        <small>SATURDAY · OCT 17</small>
        <strong>Good evening</strong>
      </div>
      <div className="ph-hero-card">
        <div className="ph-hero-card__img">
          <Dish kind="pancakes" />
          <span className="ph-hero-card__label">Tonight</span>
          <b>Sunday pancakes</b>
        </div>
        <div className="ph-meta">
          <span>
            <Icon name="clock" size={12} /> 30 min
          </span>
          <span>
            <Icon name="pot" size={12} /> Easy
          </span>
          <span>
            <Icon name="users" size={12} /> Serves 4
          </span>
        </div>
        <div className="ph-hero-card__actions">
          <span className="ph-btn ph-btn--terra">
            <Icon name="flame" size={13} /> Start cook mode
          </span>
          <span className="ph-btn ph-btn--soft">Recipe</span>
        </div>
      </div>
      <div className="ph-week">
        <b>This week</b>
        <div className="ph-week__days">
          {week.map(([d, n, dots], i) => (
            <span key={n} className={`ph-week__day ${i === 5 ? 'is-today' : ''}`}>
              <small>{d}</small>
              {n}
              <span className="ph-week__dots">
                {Array.from({ length: 3 }, (_, k) => (
                  <i key={k} className={k < dots ? 'on' : ''} />
                ))}
              </span>
            </span>
          ))}
        </div>
      </div>
      <TabBar active="today" />
    </div>
  );
}

export function RecipeScreen() {
  const ingredients = [
    ['🥑', '2', 'Ripe avocados'],
    ['🧂', '¼ tsp', 'Kosher salt'],
    ['🍋', '1 tbsp', 'Fresh lime juice'],
    ['🧅', '½', 'Red onion, minced'],
  ] as const;
  return (
    <div className="ph-body ph-body--flush">
      <div className="ph-recipe__img">
        <Dish kind="guac" />
        <div className="ph-recipe__chips">
          <span>
            <Icon name="clock" size={11} /> 10 min
          </span>
          <span>
            <Icon name="steps" size={11} /> 4 steps
          </span>
          <span>
            <Icon name="flame" size={11} /> 252 kcal
          </span>
        </div>
      </div>
      <div className="ph-recipe__sheet">
        <small className="ph-eyebrow">LUNCH</small>
        <h4>The best guacamole</h4>
        <p className="ph-by">
          by <b>Simply Recipes</b>
        </p>
        <div className="ph-seg">
          <span className="is-on">Ingredients</span>
          <span>Method</span>
        </div>
        {ingredients.map(([emoji, qty, name]) => (
          <div className="ph-ing" key={name}>
            <span className="ph-ing__emoji">{emoji}</span>
            <b>{qty}</b>
            <span>{name}</span>
          </div>
        ))}
      </div>
      <div className="ph-recipe__bar">
        <span className="ph-stepper">
          <Icon name="minus" size={12} />
          <b>4</b>
          <Icon name="plus" size={12} />
        </span>
        <span className="ph-btn ph-btn--terra ph-btn--grow">
          <Icon name="play" size={12} /> Start cooking
        </span>
      </div>
    </div>
  );
}

export function CookScreen({ step, timerLeft }: { step: number; timerLeft: number }) {
  const current = COOK_STEPS[step % COOK_STEPS.length] ?? COOK_STEPS[0];
  const total = current.timer;
  const mm = String(Math.floor(timerLeft / 60)).padStart(2, '0');
  const ss = String(timerLeft % 60).padStart(2, '0');
  return (
    <div className="ph-body">
      <div className="ph-cook__head">
        <span className="ph-round">
          <Icon name="close" size={14} />
        </span>
        <span className="ph-cook__title">
          <small>COOK MODE</small>
          The best guacamole
        </span>
        <span className="ph-cook__count">
          {step + 1}/{COOK_STEPS.length}
        </span>
      </div>
      <div className="ph-cook__progress">
        {COOK_STEPS.map((_, i) => (
          <i key={i} className={i < step ? 'done' : i === step ? 'now' : ''} />
        ))}
      </div>
      <div className="ph-cook__step" key={step}>
        <small>Step {step + 1}</small>
        <h4>{current.title}</h4>
        <p>{current.body}</p>
        <small className="ph-cook__need">YOU’LL NEED</small>
        <div className="ph-cook__chips">
          {current.need.map((n) => (
            <span key={n}>{n}</span>
          ))}
        </div>
        {total > 0 && (
          <div className="ph-timer">
            <svg viewBox="0 0 44 44">
              <circle cx="22" cy="22" r="19" className="ph-timer__track" />
              <circle
                cx="22"
                cy="22"
                r="19"
                className="ph-timer__fill"
                style={{ strokeDashoffset: 119.4 * (1 - timerLeft / total) }}
              />
            </svg>
            <span>
              <b>
                {mm}:{ss}
              </b>
              <small>Rest · rings when done</small>
            </span>
          </div>
        )}
      </div>
      <div className="ph-cook__nav">
        <span className="ph-round ph-round--lg">
          <Icon name="back" size={16} />
        </span>
        <span className="ph-btn ph-btn--terra ph-btn--grow ph-btn--lg">
          Next step <Icon name="arrow" size={14} />
        </span>
      </div>
    </div>
  );
}

export function GroceriesScreen({ checked }: { checked: number }) {
  const aisles = [
    ['Produce', ['2 ripe avocados', '3 limes', '1 bunch cilantro', '6 tomatoes']],
    ['Dairy', ['500 ml buttermilk', '2 tbsp butter']],
  ] as const;
  let n = 0;
  return (
    <div className="ph-body">
      <div className="ph-title">
        <h4>Groceries</h4>
        <small>6 items · 2 recipes</small>
      </div>
      {aisles.map(([aisle, items]) => (
        <div key={aisle} className="ph-aisle">
          <small>{aisle}</small>
          {items.map((item) => {
            const done = n++ < checked;
            return (
              <div key={item} className={`ph-check ${done ? 'is-done' : ''}`}>
                <span className="ph-check__box">
                  <Icon name="check" size={11} />
                </span>
                {item}
              </div>
            );
          })}
        </div>
      ))}
      <TabBar active="groceries" />
    </div>
  );
}
