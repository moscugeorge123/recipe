import avatar from '../assets/avatar.png';
import { Dish } from '../components/Dish';

export function Kitchen() {
  return (
    <section className="section kitchen">
      <div className="wrap kitchen__grid">
        <div className="kitchen__photo" data-reveal>
          <img src={avatar} alt="A home cook smiling while whisking batter in a sunny kitchen" loading="lazy" />
          <div className="kitchen__plate kitchen__plate--a">
            <Dish kind="pancakes" />
          </div>
          <div className="kitchen__plate kitchen__plate--b">
            <Dish kind="salad" />
          </div>
        </div>
        <div className="kitchen__copy" data-reveal>
          <span className="eyebrow">Made for home cooks</span>
          <h2>
            Less scrolling. <em>More cooking.</em>
          </h2>
          <p>
            Recipes live everywhere: screenshots, bookmarks, saved reels, stained cookbook pages. Tortie brings them
            into one warm, uncluttered kitchen that’s ready whenever you are.
          </p>
          <dl className="stats">
            <div>
              <dt>8+</dt>
              <dd>kinds of source, from links to handwriting</dd>
            </div>
            <div>
              <dt>0</dt>
              <dd>pop-ups between you and the ingredients</dd>
            </div>
            <div>
              <dt>1</dt>
              <dd>grocery list for the whole week</dd>
            </div>
          </dl>
        </div>
      </div>
    </section>
  );
}
