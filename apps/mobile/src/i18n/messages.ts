import type { AppLanguageCode } from './languages';

const en = {
  'tab.today': 'Today',
  'tab.cookbook': 'Cookbook',
  'tab.plan': 'Plan',
  'tab.groceries': 'Groceries',

  'profile.kitchen': 'Kitchen',
  'profile.language': 'Language',
  'profile.units': 'Units',
  'profile.metric': 'Metric',
  'profile.imperial': 'Imperial',
  'profile.appLanguage': 'App language',
  'profile.appLanguageSub': 'Menus, buttons and messages',
  'profile.appLanguageSystem': 'Device',
  'profile.recipeLanguage': 'Recipe language',
  'profile.recipeLanguageSub':
    'Tortie translates recipes that aren’t in this language',
  'profile.recipeLanguageOriginal': 'As saved',

  'recipe.translating': 'Translating to {language}…',
  'recipe.translatingSub':
    'Showing the original while Tortie translates this recipe.',
  'recipe.translationFailed': 'Couldn’t translate this recipe.',
  'recipe.translationRetry': 'Try again',
  'recipe.translationUnavailable': 'Translation isn’t available right now.',
  'recipe.translated': 'Translated to {language}',
} as const;

export type MessageKey = keyof typeof en;
type Messages = Record<MessageKey, string>;

const ro: Messages = {
  'tab.today': 'Azi',
  'tab.cookbook': 'Rețete',
  'tab.plan': 'Plan',
  'tab.groceries': 'Cumpărături',

  'profile.kitchen': 'Bucătărie',
  'profile.language': 'Limbă',
  'profile.units': 'Unități',
  'profile.metric': 'Metric',
  'profile.imperial': 'Imperial',
  'profile.appLanguage': 'Limba aplicației',
  'profile.appLanguageSub': 'Meniuri, butoane și mesaje',
  'profile.appLanguageSystem': 'Dispozitiv',
  'profile.recipeLanguage': 'Limba rețetelor',
  'profile.recipeLanguageSub':
    'Tortie traduce rețetele care nu sunt în această limbă',
  'profile.recipeLanguageOriginal': 'Cum a fost salvată',

  'recipe.translating': 'Se traduce în {language}…',
  'recipe.translatingSub':
    'Se arată originalul cât timp Tortie traduce rețeta.',
  'recipe.translationFailed': 'Nu am putut traduce rețeta.',
  'recipe.translationRetry': 'Încearcă din nou',
  'recipe.translationUnavailable': 'Traducerea nu este disponibilă acum.',
  'recipe.translated': 'Tradusă în {language}',
};

const es: Messages = {
  'tab.today': 'Hoy',
  'tab.cookbook': 'Recetas',
  'tab.plan': 'Plan',
  'tab.groceries': 'Compras',

  'profile.kitchen': 'Cocina',
  'profile.language': 'Idioma',
  'profile.units': 'Unidades',
  'profile.metric': 'Métrico',
  'profile.imperial': 'Imperial',
  'profile.appLanguage': 'Idioma de la app',
  'profile.appLanguageSub': 'Menús, botones y mensajes',
  'profile.appLanguageSystem': 'Dispositivo',
  'profile.recipeLanguage': 'Idioma de las recetas',
  'profile.recipeLanguageSub':
    'Tortie traduce las recetas que no están en este idioma',
  'profile.recipeLanguageOriginal': 'Como se guardó',

  'recipe.translating': 'Traduciendo a {language}…',
  'recipe.translatingSub':
    'Mostrando el original mientras Tortie traduce la receta.',
  'recipe.translationFailed': 'No se pudo traducir esta receta.',
  'recipe.translationRetry': 'Reintentar',
  'recipe.translationUnavailable': 'La traducción no está disponible ahora.',
  'recipe.translated': 'Traducida a {language}',
};

const fr: Messages = {
  'tab.today': 'Aujourd’hui',
  'tab.cookbook': 'Recettes',
  'tab.plan': 'Planning',
  'tab.groceries': 'Courses',

  'profile.kitchen': 'Cuisine',
  'profile.language': 'Langue',
  'profile.units': 'Unités',
  'profile.metric': 'Métrique',
  'profile.imperial': 'Impérial',
  'profile.appLanguage': 'Langue de l’app',
  'profile.appLanguageSub': 'Menus, boutons et messages',
  'profile.appLanguageSystem': 'Appareil',
  'profile.recipeLanguage': 'Langue des recettes',
  'profile.recipeLanguageSub':
    'Tortie traduit les recettes qui ne sont pas dans cette langue',
  'profile.recipeLanguageOriginal': 'Telle qu’enregistrée',

  'recipe.translating': 'Traduction en {language}…',
  'recipe.translatingSub':
    'L’original s’affiche pendant que Tortie traduit la recette.',
  'recipe.translationFailed': 'Impossible de traduire cette recette.',
  'recipe.translationRetry': 'Réessayer',
  'recipe.translationUnavailable':
    'La traduction n’est pas disponible pour le moment.',
  'recipe.translated': 'Traduite en {language}',
};

const de: Messages = {
  'tab.today': 'Heute',
  'tab.cookbook': 'Rezepte',
  'tab.plan': 'Plan',
  'tab.groceries': 'Einkauf',

  'profile.kitchen': 'Küche',
  'profile.language': 'Sprache',
  'profile.units': 'Einheiten',
  'profile.metric': 'Metrisch',
  'profile.imperial': 'Imperial',
  'profile.appLanguage': 'App-Sprache',
  'profile.appLanguageSub': 'Menüs, Schaltflächen und Meldungen',
  'profile.appLanguageSystem': 'Gerät',
  'profile.recipeLanguage': 'Rezeptsprache',
  'profile.recipeLanguageSub':
    'Tortie übersetzt Rezepte, die nicht in dieser Sprache vorliegen',
  'profile.recipeLanguageOriginal': 'Wie gespeichert',

  'recipe.translating': 'Übersetze ins {language}…',
  'recipe.translatingSub':
    'Das Original wird angezeigt, während Tortie das Rezept übersetzt.',
  'recipe.translationFailed': 'Dieses Rezept konnte nicht übersetzt werden.',
  'recipe.translationRetry': 'Erneut versuchen',
  'recipe.translationUnavailable': 'Übersetzung ist gerade nicht verfügbar.',
  'recipe.translated': 'Übersetzt: {language}',
};

export const MESSAGES: Record<AppLanguageCode, Messages> = {
  en,
  ro,
  es,
  fr,
  de,
};
