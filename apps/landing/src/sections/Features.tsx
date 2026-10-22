import type { ReactNode } from 'react';

import { Dish, type DishKind } from '../components/Dish';
import { Icon, type IconName } from '../components/Icon';
import { useTicker } from '../hooks';

function Card({
  icon,
  title,
  body,
  className = '',
  children,
}: {
  icon: IconName;
  title: string;
  body: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <article className={`feat ${className}`} data-reveal>
      <div className="feat__visual">{children}</div>
      <div className="feat__text">
        <span className="feat__icon">
          <Icon name={icon} size={18} />
        </span>
        <h3>{title}</h3>
        <p>{body}</p>
      </div>
    </article>
  );
}

const FILTERS = ['All', 'Under 30 min', 'Vegetarian', 'Seafood'] as const;
const SHELF: [DishKind, string, string][] = [
  ['guac', 'The best guacamole', '10 min'],
  ['soup', 'Tomato soup', '25 min'],
  ['salad', 'Garden salad', '15 min'],
  ['pancakes', 'Sunday pancakes', '30 min'],
];

function CookbookVisual({ tick }: { tick: number }) {
  const active = tick % FILTERS.length;
  return (
    <div className="v-cookbook">
      <div className="v-chips">
        {FILTERS.map((f, i) => (
          <span key={f} className={i === active ? 'is-on' : ''}>
            {f}
          </span>
        ))}
      </div>
      <div className="v-shelf">
        {SHELF.map(([kind, name, time], i) => (
          <div key={name} className={`v-shelf__card ${active !== 0 && i % FILTERS.length === (active + 1) % 4 ? 'is-dim' : ''}`}>
            <div className="v-shelf__img">
              <Dish kind={kind} />
              <span>
                <Icon name="clock" size={10} /> {time}
              </span>
            </div>
            <b>{name}</b>
          </div>
        ))}
      </div>
    </div>
  );
}

function NutritionVisual() {
  const macros = [
    ['Protein', 18, 'var(--green-mid)'],
    ['Carbs', 42, 'var(--terra-bright)'],
    ['Fat', 64, 'var(--flash)'],
  ] as const;
  return (
    <div className="v-nutrition">
      <div className="v-kcal">
        <b>252</b>
        <small>kcal / serving</small>
      </div>
      {macros.map(([name, pct, color]) => (
        <div className="v-macro" key={name}>
          <span>{name}</span>
          <span className="v-macro__bar">
            <i style={{ width: `${pct}%`, background: color }} />
          </span>
          <b>{Math.round(pct / 4)}g</b>
        </div>
      ))}
    </div>
  );
}

const SERVINGS = [2, 4, 6] as const;

function ScaleVisual({ tick }: { tick: number }) {
  const s = SERVINGS[tick % SERVINGS.length] ?? 4;
  const imperial = Math.floor(tick / SERVINGS.length) % 2 === 1;
  const rows: [string, number, string, string][] = [
    ['🍝', 100, 'g', 'Spaghetti'],
    ['🧀', 15, 'g', 'Pecorino'],
    ['🧈', 10, 'g', 'Butter'],
  ];
  const fmt = (perServing: number) => {
    const g = perServing * s;
    return imperial ? `${(g / 28.35).toFixed(1)} oz` : `${g} g`;
  };
  return (
    <div className="v-scale">
      <div className="v-scale__top">
        <span className="v-stepper">
          <Icon name="minus" size={12} />
          <b key={s}>{s}</b>
          <Icon name="plus" size={12} />
        </span>
        <span className="v-toggle">
          <span className={imperial ? '' : 'is-on'}>Metric</span>
          <span className={imperial ? 'is-on' : ''}>Imperial</span>
        </span>
      </div>
      {rows.map(([emoji, per, , name]) => (
        <div className="v-scale__row" key={name}>
          <span>{emoji}</span>
          <b key={`${s}-${imperial}`}>{fmt(per)}</b>
          <span>{name}</span>
        </div>
      ))}
    </div>
  );
}

function PlanVisual({ tick }: { tick: number }) {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const meals: (DishKind | null)[] = ['soup', 'guac', null, 'salad', 'pancakes', 'guac', 'soup'];
  const filled = (tick % 9) + 1;
  return (
    <div className="v-plan">
      {days.map((d, i) => {
        const meal = meals[i];
        const show = meal && i < filled;
        return (
          <div key={d} className={`v-plan__day ${show ? 'is-filled' : ''}`}>
            <small>{d}</small>
            <span className="v-plan__slot">{show ? <Dish kind={meal} spin={false} /> : <Icon name="plus" size={14} />}</span>
          </div>
        );
      })}
    </div>
  );
}

function GroceryVisual({ tick }: { tick: number }) {
  const items = ['Avocados', 'Limes', 'Cilantro', 'Buttermilk', 'Tomatoes'];
  const checked = tick % (items.length + 2);
  return (
    <div className="v-groc">
      <div className="v-groc__pantry">
        <Icon name="sparkle" size={13} /> 3 already in your pantry
      </div>
      {items.map((it, i) => (
        <div key={it} className={`ph-check ${i < checked ? 'is-done' : ''}`}>
          <span className="ph-check__box">
            <Icon name="check" size={11} />
          </span>
          {it}
        </div>
      ))}
    </div>
  );
}

function NotesVisual() {
  return (
    <div className="v-notes">
      <div className="v-note v-note--orig">
        <small>Original</small>
        <span>
          1 tsp <s>chili flakes</s>
        </span>
      </div>
      <div className="v-note v-note--mine">
        <small>Your version</small>
        <span>½ tsp smoked paprika</span>
        <em>“Kids loved it this way ♥”</em>
      </div>
    </div>
  );
}

export function Features() {
  const tick = useTicker(1800);
  return (
    <section className="section features" id="features">
      <div className="wrap">
        <header className="section__head" data-reveal>
          <span className="eyebrow">Everything in one place</span>
          <h2>
            A kitchen that keeps up <em>with real life.</em>
          </h2>
          <p>From the moment you find a recipe to the last bite, Tortie quietly handles the busywork.</p>
        </header>

        <div className="bento">
          <Card
            className="feat--wide"
            icon="book"
            title="A cookbook that sorts itself"
            body="Search everything you’ve saved, filter by time or diet, and file favorites into collections. Your most-loved and most-cooked recipes rise to the top."
          >
            <CookbookVisual tick={tick} />
          </Card>
          <Card
            icon="flame"
            title="Nutrition per serving"
            body="Calories and macros are estimated for every recipe and update as you scale."
          >
            <NutritionVisual />
          </Card>
          <Card
            icon="scale"
            title="Scale & convert"
            body="Cooking for two or ten? Change servings and switch between metric and imperial in a tap."
          >
            <ScaleVisual tick={tick} />
          </Card>
          <Card
            className="feat--wide"
            icon="calendar"
            title="Plan the week in minutes"
            body="Drop recipes onto days, swipe between them and see what’s for dinner at a glance on your Today screen."
          >
            <PlanVisual tick={tick} />
          </Card>
          <Card
            icon="basket"
            title="Shop in one trip"
            body="Planned meals become one grocery list, sorted by aisle, minus what’s already in your pantry."
          >
            <GroceryVisual tick={tick} />
          </Card>
          <Card
            icon="note"
            title="Notes & edits, safely"
            body="Add tweaks, swaps and reminders, or edit a recipe outright. The original is always one tap away."
          >
            <NotesVisual />
          </Card>
        </div>
      </div>
    </section>
  );
}
