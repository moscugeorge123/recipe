import { CookScreen, Phone } from '../components/Phone';
import { Icon, type IconName } from '../components/Icon';
import { COOK_STEPS } from '../content';
import { useTicker } from '../hooks';

const SECONDS_PER_STEP = 5;

const POINTS: [IconName, string, string][] = [
  ['steps', 'One step at a time', 'Big, readable type with just the ingredients that step needs.'],
  ['bell', 'Timers that actually ring', 'Start a timer from the step. It alarms even if the app is closed.'],
  ['sun', 'Screen stays awake', 'No more tapping the screen with floury fingers.'],
  ['video', 'Clips from the original video', 'Imported from a video? Each step can replay its moment from the source.'],
];

export function CookSection() {
  const tick = useTicker(1000);
  const step = Math.floor(tick / SECONDS_PER_STEP) % COOK_STEPS.length;
  const into = tick % SECONDS_PER_STEP;
  const timer = COOK_STEPS[step]?.timer ?? 0;
  const timerLeft = Math.max(0, timer - into * 37);

  return (
    <section className="section cook" id="cook">
      <div className="cook__glow" aria-hidden="true" />
      <div className="wrap cook__grid">
        <div className="cook__stage" data-reveal>
          <Phone className="cook__phone">
            <CookScreen step={step} timerLeft={timerLeft} />
          </Phone>
          <div className="cook__badge">
            <span>Step</span>
            <b key={step}>{step + 1}</b>
            <span>of {COOK_STEPS.length}</span>
          </div>
        </div>
        <div className="cook__copy" data-reveal>
          <span className="eyebrow eyebrow--light">Cook mode</span>
          <h2>
            Cook hands-free, <em>one step at a time.</em>
          </h2>
          <p>
            Prop your phone against the fruit bowl. Tortie turns any recipe into a calm, focused walkthrough, so you can
            keep your eyes on the pan.
          </p>
          <ul className="cook__points">
            {POINTS.map(([icon, title, body]) => (
              <li key={title}>
                <span className="cook__icon">
                  <Icon name={icon} size={18} />
                </span>
                <span>
                  <b>{title}</b>
                  <small>{body}</small>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
