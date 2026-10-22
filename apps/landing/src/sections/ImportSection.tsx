import { Dish } from '../components/Dish';
import { Icon } from '../components/Icon';
import { IMPORT_DEMOS, IMPORT_STAGES } from '../content';
import { useTicker } from '../hooks';

/** Ticks of 90ms per demo: type the input, run the stages, then show the result. */
const TYPE_END = 22;
const WORK_END = 52;
const CYCLE = 90;

export function ImportSection() {
  const tick = useTicker(90);
  const demo = IMPORT_DEMOS[Math.floor(tick / CYCLE) % IMPORT_DEMOS.length] ?? IMPORT_DEMOS[0]!;
  const t = tick % CYCLE;
  const typed = demo.input.slice(0, Math.ceil((Math.min(t, TYPE_END) / TYPE_END) * demo.input.length));
  const working = t >= TYPE_END && t < WORK_END;
  const done = t >= WORK_END;
  const stage = Math.min(IMPORT_STAGES.length, Math.floor(((t - TYPE_END) / (WORK_END - TYPE_END)) * IMPORT_STAGES.length));
  const progress = done ? 100 : working ? ((t - TYPE_END) / (WORK_END - TYPE_END)) * 100 : 0;

  return (
    <section className="section import" id="import">
      <div className="wrap import__grid">
        <div className="import__copy" data-reveal>
          <span className="eyebrow">Import from anywhere</span>
          <h2>
            Paste a link. Snap a page. <em>Dinner’s saved.</em>
          </h2>
          <p>
            Share a recipe from your browser, YouTube, TikTok, Instagram or Facebook, or photograph a cookbook page or
            grandma’s handwritten card. Tortie reads it, finds the ingredients and steps, and estimates calories and
            macros per serving.
          </p>
          <ol className="how">
            <li>
              <span className="how__n">1</span>
              <span>
                <b>Share or snap</b>
                <small>From any app’s share sheet, or the in-app camera.</small>
              </span>
            </li>
            <li>
              <span className="how__n">2</span>
              <span>
                <b>Tortie tidies it up</b>
                <small>Ingredients, method, timings and nutrition, with the ads and life stories cut out.</small>
              </span>
            </li>
            <li>
              <span className="how__n">3</span>
              <span>
                <b>Make it yours</b>
                <small>Edit freely. The original is always kept, so nothing is ever lost.</small>
              </span>
            </li>
          </ol>
        </div>

        <div className="import__demo" data-reveal>
          <div className="importer">
            <div className="importer__head">
              <span className="importer__source">
                <Icon name={demo.isPhoto ? 'camera' : 'link'} size={14} /> {demo.source}
              </span>
              <span className="importer__dots">
                {IMPORT_DEMOS.map((d) => (
                  <i key={d.source} className={d === demo ? 'on' : ''} />
                ))}
              </span>
            </div>
            <div className={`importer__input ${t < TYPE_END ? 'is-typing' : ''}`}>
              <Icon name={demo.isPhoto ? 'camera' : 'search'} size={16} />
              <span>{typed}</span>
            </div>
            <div className="importer__bar">
              <i style={{ width: `${progress}%` }} />
            </div>
            <ul className="importer__stages">
              {IMPORT_STAGES.map((s, i) => (
                <li key={s} className={done || (working && i < stage) ? 'is-done' : working && i === stage ? 'is-now' : ''}>
                  <span className="importer__tick">
                    <Icon name="check" size={11} />
                  </span>
                  {s}
                </li>
              ))}
            </ul>
            <div className={`importer__result ${done ? 'is-in' : ''}`}>
              <Dish kind={demo.dish} className="importer__img" />
              <div>
                <small className="eyebrow eyebrow--sm">Saved to Cookbook</small>
                <b>{demo.title}</b>
                <small>{demo.meta}</small>
              </div>
              <span className="importer__ok">
                <Icon name="check" size={16} />
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
