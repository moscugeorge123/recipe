import type { DishKind } from './components/Dish';

/** Android package id from `apps/mobile/app.json`. */
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.tortie.com';

/** Not published yet — the App Store badge renders disabled while this is null. */
export const APP_STORE_URL: string | null = null;

export const SOURCES = [
  'Any recipe website',
  'YouTube',
  'TikTok',
  'Instagram',
  'Facebook posts & reels',
  'Cookbook pages',
  'Handwritten cards',
  'Shared links',
] as const;

export type ImportDemo = {
  source: string;
  input: string;
  isPhoto: boolean;
  title: string;
  meta: string;
  dish: DishKind;
};

export const IMPORT_DEMOS: readonly ImportDemo[] = [
  {
    source: 'TikTok',
    input: 'tiktok.com/@nonna.cooks/video/7311',
    isPhoto: false,
    title: 'Brown-butter tomato soup',
    meta: '25 min · 7 ingredients · 312 kcal',
    dish: 'soup',
  },
  {
    source: 'Cookbook photo',
    input: 'IMG_2041.jpg · page 112',
    isPhoto: true,
    title: 'Sunday buttermilk pancakes',
    meta: '30 min · 9 ingredients · 286 kcal',
    dish: 'pancakes',
  },
  {
    source: 'Facebook reel',
    input: 'facebook.com/reel/882134',
    isPhoto: false,
    title: 'Crunchy garden salad',
    meta: '15 min · 8 ingredients · 198 kcal',
    dish: 'salad',
  },
  {
    source: 'Website',
    input: 'simplyrecipes.com/guacamole',
    isPhoto: false,
    title: 'The best guacamole',
    meta: '10 min · 10 ingredients · 252 kcal',
    dish: 'guac',
  },
];

export const IMPORT_STAGES = ['Reading the source', 'Finding ingredients & steps', 'Estimating nutrition'] as const;

export const COOK_STEPS = [
  {
    title: 'Cut the avocados',
    body: 'Halve, remove the pit and scoop the flesh into a bowl.',
    need: ['2 ripe avocados'],
    timer: 0,
  },
  {
    title: 'Mash & season',
    body: 'Mash with a fork, then add lime juice and a good pinch of salt.',
    need: ['1 lime', '¼ tsp kosher salt'],
    timer: 0,
  },
  {
    title: 'Let it rest',
    body: 'Fold in onion, chili and cilantro. Rest so the flavors marry.',
    need: ['½ red onion', '1 serrano chili'],
    timer: 300,
  },
  {
    title: 'Serve',
    body: 'Top with diced tomato just before serving. Enjoy right away.',
    need: ['1 ripe tomato'],
    timer: 0,
  },
] as const;
