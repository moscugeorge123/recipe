import { describe, expect, it } from 'vitest';

import {
  addDualMeasurements,
  celsiusToFahrenheit,
  convertMeasurement,
  fahrenheitToCelsius,
  formatQuantity,
  isConsistent,
  isCountUnit,
  parseTemperature,
  reconcileMeasurements,
  reconcileTemperature,
  resolveUnit,
  snapFraction,
} from '../../../../src/modules/normalization/domain/measurement-conversion.js';

describe('resolveUnit', () => {
  it.each([
    ['g', 'g'],
    ['Grams', 'g'],
    ['kilograms', 'kg'],
    ['Tablespoons', 'tbsp'],
    ['tbs', 'tbsp'],
    ['tsp.', 'tsp'],
    ['cups', 'cup'],
    ['fl oz', 'fl oz'],
    ['fluid ounces', 'fl oz'],
    ['ounces', 'oz'],
    ['lbs', 'lb'],
    ['litres', 'l'],
    ['milliliters', 'ml'],
    ['inches', 'in'],
    ['centimetres', 'cm'],
    ['linguri', 'tbsp'],
  ])('%s → %s', (raw, expected) => {
    expect(resolveUnit(raw)).toBe(expected);
  });

  it('returns null for count and unknown units', () => {
    expect(resolveUnit('clove')).toBeNull();
    expect(resolveUnit('pinch')).toBeNull();
    expect(resolveUnit('căței')).toBeNull();
    expect(resolveUnit(null)).toBeNull();
    expect(resolveUnit('')).toBeNull();
  });
});

describe('isCountUnit', () => {
  it('treats missing, piece-like and "to taste" units as counts', () => {
    expect(isCountUnit(null)).toBe(true);
    expect(isCountUnit('cloves')).toBe(true);
    expect(isCountUnit('Pinch')).toBe(true);
    expect(isCountUnit('to taste')).toBe(true);
    expect(isCountUnit('g')).toBe(false);
  });
});

describe('snapFraction', () => {
  it('snaps to kitchen fractions', () => {
    expect(snapFraction(0.33, [2, 3, 4])).toBe(0.333);
    expect(snapFraction(0.66, [2, 3, 4])).toBe(0.667);
    expect(snapFraction(1.26, [2, 3, 4])).toBe(1.25);
    expect(snapFraction(1.97, [2, 3, 4])).toBe(2);
    expect(snapFraction(0.12, [2, 4, 8])).toBe(0.125);
  });

  it('rounds large values to whole numbers and never snaps a positive amount to 0', () => {
    expect(snapFraction(12.4, [2, 3, 4])).toBe(12);
    expect(snapFraction(0.02, [2, 4, 8])).toBe(0.125);
    expect(snapFraction(0, [2])).toBe(0);
  });
});

describe('convertMeasurement → metric', () => {
  it.each([
    [{ quantity: 4, unit: 'oz' }, { quantity: 115, unit: 'g' }],
    [{ quantity: 1, unit: 'oz' }, { quantity: 28, unit: 'g' }],
    [{ quantity: 1, unit: 'lb' }, { quantity: 455, unit: 'g' }],
    [{ quantity: 3, unit: 'lb' }, { quantity: 1.35, unit: 'kg' }],
    [{ quantity: 1, unit: 'cup' }, { quantity: 235, unit: 'ml' }],
    [{ quantity: 0.5, unit: 'cup' }, { quantity: 120, unit: 'ml' }],
    [{ quantity: 4, unit: 'cups' }, { quantity: 945, unit: 'ml' }],
    [{ quantity: 8, unit: 'cup' }, { quantity: 1.9, unit: 'l' }],
    [{ quantity: 2, unit: 'fl oz' }, { quantity: 59, unit: 'ml' }],
    [{ quantity: 1, unit: 'in' }, { quantity: 2.5, unit: 'cm' }],
    [{ quantity: 0.25, unit: 'inch' }, { quantity: 6, unit: 'mm' }],
  ])('%j → %j', (input, expected) => {
    expect(convertMeasurement(input, 'metric')).toEqual(expected);
  });

  it('keeps metric amounts and kitchen spoons exactly as written', () => {
    expect(convertMeasurement({ quantity: 113, unit: 'g' }, 'metric')).toEqual({
      quantity: 113,
      unit: 'g',
    });
    expect(convertMeasurement({ quantity: 2, unit: 'tbsp' }, 'metric')).toEqual({
      quantity: 2,
      unit: 'tbsp',
    });
  });
});

describe('convertMeasurement → imperial', () => {
  it.each([
    [{ quantity: 113.4, unit: 'g' }, { quantity: 4, unit: 'oz' }],
    [{ quantity: 200, unit: 'g' }, { quantity: 7, unit: 'oz' }],
    [{ quantity: 500, unit: 'g' }, { quantity: 1, unit: 'lb' }],
    [{ quantity: 1, unit: 'kg' }, { quantity: 2.25, unit: 'lb' }],
    [{ quantity: 5, unit: 'g' }, { quantity: 0.125, unit: 'oz' }],
    [{ quantity: 250, unit: 'ml' }, { quantity: 1, unit: 'cup' }],
    [{ quantity: 80, unit: 'ml' }, { quantity: 0.333, unit: 'cup' }],
    [{ quantity: 1, unit: 'l' }, { quantity: 4.25, unit: 'cup' }],
    [{ quantity: 30, unit: 'ml' }, { quantity: 2, unit: 'tbsp' }],
    [{ quantity: 5, unit: 'ml' }, { quantity: 1, unit: 'tsp' }],
    [{ quantity: 2.5, unit: 'ml' }, { quantity: 0.5, unit: 'tsp' }],
    [{ quantity: 2, unit: 'cm' }, { quantity: 0.75, unit: 'in' }],
    [{ quantity: 20, unit: 'cm' }, { quantity: 8, unit: 'in' }],
    [{ quantity: 5, unit: 'mm' }, { quantity: 0.25, unit: 'in' }],
  ])('%j → %j', (input, expected) => {
    expect(convertMeasurement(input, 'imperial')).toEqual(expected);
  });
});

describe('convertMeasurement edge cases', () => {
  it('returns count, unknown and quantity-less amounts unchanged', () => {
    expect(convertMeasurement({ quantity: 2, unit: 'clove' }, 'imperial')).toEqual({
      quantity: 2,
      unit: 'clove',
    });
    expect(convertMeasurement({ quantity: 3, unit: null }, 'metric')).toEqual({
      quantity: 3,
      unit: null,
    });
    expect(convertMeasurement({ quantity: null, unit: 'g' }, 'imperial')).toEqual({
      quantity: null,
      unit: 'g',
    });
  });
});

describe('isConsistent', () => {
  it('accepts same-kind amounts within 15%', () => {
    expect(isConsistent({ quantity: 1, unit: 'cup' }, { quantity: 240, unit: 'ml' })).toBe(true);
    expect(isConsistent({ quantity: 1, unit: 'cup' }, { quantity: 350, unit: 'ml' })).toBe(false);
  });

  it('accepts plausible densities for volume↔mass', () => {
    expect(isConsistent({ quantity: 1, unit: 'cup' }, { quantity: 120, unit: 'g' })).toBe(true);
    expect(isConsistent({ quantity: 1, unit: 'cup' }, { quantity: 340, unit: 'g' })).toBe(true);
    expect(isConsistent({ quantity: 1, unit: 'cup' }, { quantity: 5, unit: 'g' })).toBe(false);
    expect(isConsistent({ quantity: 1, unit: 'tbsp' }, { quantity: 900, unit: 'g' })).toBe(false);
  });

  it('rejects length vs mass and unknown units', () => {
    expect(isConsistent({ quantity: 2, unit: 'cm' }, { quantity: 2, unit: 'g' })).toBe(false);
    expect(isConsistent({ quantity: 2, unit: 'cloves' }, { quantity: 2, unit: 'g' })).toBe(false);
  });
});

describe('reconcileMeasurements', () => {
  it('uses the model volume→mass conversion when it is plausible', () => {
    const result = reconcileMeasurements(
      { quantity: 1, unit: 'cup' },
      { quantity: 120, unit: 'g' },
      { quantity: 1, unit: 'cup' },
    );
    expect(result.metric).toEqual({ quantity: 120, unit: 'g' });
    expect(result.imperial).toEqual({ quantity: 1, unit: 'cup' });
  });

  it('keeps the original on its own side even if the model disagrees', () => {
    const result = reconcileMeasurements(
      { quantity: 200, unit: 'g' },
      { quantity: 250, unit: 'g' },
      { quantity: 1.66, unit: 'cups' },
    );
    expect(result.metric).toEqual({ quantity: 200, unit: 'g' });
    expect(result.imperial).toEqual({ quantity: 1.667, unit: 'cup' });
  });

  it('falls back to the deterministic conversion when the model value is missing or off', () => {
    expect(reconcileMeasurements({ quantity: 4, unit: 'oz' }).metric).toEqual({
      quantity: 115,
      unit: 'g',
    });
    expect(
      reconcileMeasurements({ quantity: 250, unit: 'ml' }, null, { quantity: 3, unit: 'cup' })
        .imperial,
    ).toEqual({ quantity: 1, unit: 'cup' });
    expect(
      reconcileMeasurements({ quantity: 250, unit: 'ml' }, null, { quantity: 1, unit: 'g' })
        .imperial,
    ).toEqual({ quantity: 1, unit: 'cup' });
  });

  it('rejects a model value in the wrong system', () => {
    const result = reconcileMeasurements(
      { quantity: 2, unit: 'cups' },
      { quantity: 2, unit: 'cups' },
    );
    expect(result.metric).toEqual({ quantity: 475, unit: 'ml' });
  });

  it('rounds model values', () => {
    const result = reconcileMeasurements(
      { quantity: 1, unit: 'cup' },
      { quantity: 118.29, unit: 'g' },
    );
    expect(result.metric).toEqual({ quantity: 120, unit: 'g' });
  });

  it('keeps count units and "to taste" as-is in both systems', () => {
    for (const original of [
      { quantity: 2, unit: 'cloves' },
      { quantity: 1, unit: 'pinch' },
      { quantity: 3, unit: null },
      { quantity: null, unit: 'to taste' },
    ]) {
      const result = reconcileMeasurements(original, { quantity: 10, unit: 'g' }, null);
      expect(result).toEqual({ metric: original, imperial: original });
    }
  });

  it('cross-checks model values when the original unit is not recognised', () => {
    const agree = reconcileMeasurements(
      { quantity: 1, unit: 'cană' },
      { quantity: 240, unit: 'ml' },
      { quantity: 1, unit: 'cup' },
    );
    expect(agree).toEqual({
      metric: { quantity: 240, unit: 'ml' },
      imperial: { quantity: 1, unit: 'cup' },
    });

    const disagree = reconcileMeasurements(
      { quantity: 1, unit: 'cană' },
      { quantity: 240, unit: 'ml' },
      { quantity: 3, unit: 'cup' },
    );
    expect(disagree.imperial).toEqual({ quantity: 1, unit: 'cup' });

    const onlyImperial = reconcileMeasurements(
      { quantity: 2, unit: 'pahare' },
      null,
      { quantity: '1/2', unit: 'cup' },
    );
    expect(onlyImperial.metric).toEqual({ quantity: 120, unit: 'ml' });

    expect(reconcileMeasurements({ quantity: 2, unit: 'pahare' })).toEqual({
      metric: { quantity: 2, unit: 'pahare' },
      imperial: { quantity: 2, unit: 'pahare' },
    });
  });
});

describe('temperatures', () => {
  it.each([
    [180, 350],
    [200, 400],
    [220, 425],
    [160, 325],
    [190, 375],
    [230, 450],
    [150, 300],
    [63, 145],
    [100, 212],
    [0, 32],
  ])('%i °C → %i °F', (celsius, fahrenheit) => {
    expect(celsiusToFahrenheit(celsius)).toBe(fahrenheit);
  });

  it.each([
    [350, 180],
    [375, 190],
    [400, 200],
    [425, 220],
    [325, 160],
    [450, 230],
    [145, 63],
    [212, 100],
  ])('%i °F → %i °C', (fahrenheit, celsius) => {
    expect(fahrenheitToCelsius(fahrenheit)).toBe(celsius);
  });

  it('parses temperatures written in several ways', () => {
    expect(parseTemperature('Bake at 180°C for 20 min')).toEqual({ celsius: 180, fahrenheit: 350 });
    expect(parseTemperature('350 degrees F')).toEqual({ celsius: 180, fahrenheit: 350 });
    expect(parseTemperature('200 °c')).toEqual({ celsius: 200, fahrenheit: 400 });
    expect(parseTemperature('heat to 63 degrees celsius')).toEqual({
      celsius: 63,
      fahrenheit: 145,
    });
    expect(parseTemperature('medium heat')).toBeNull();
    expect(parseTemperature('bake for 180 minutes')).toBeNull();
    expect(parseTemperature(null)).toBeNull();
  });

  it('reconciles model C/F with the text', () => {
    expect(reconcileTemperature({ celsius: 180, fahrenheit: 350 })).toEqual({
      celsius: 180,
      fahrenheit: 350,
    });
    expect(reconcileTemperature({ celsius: 180, fahrenheit: 180, text: '180°C' })).toEqual({
      celsius: 180,
      fahrenheit: 350,
    });
    expect(reconcileTemperature({ fahrenheit: 425 })).toEqual({ celsius: 220, fahrenheit: 425 });
    expect(reconcileTemperature({ instruction: 'Roast at 200°C until golden' })).toEqual({
      celsius: 200,
      fahrenheit: 400,
    });
    expect(reconcileTemperature({ text: 'medium-high' })).toBeNull();
  });
});

describe('formatQuantity', () => {
  it('writes imperial fractions and metric decimals', () => {
    expect(formatQuantity(0.75, 'in')).toBe('¾');
    expect(formatQuantity(1.5, 'cup')).toBe('1½');
    expect(formatQuantity(0.333, 'cup')).toBe('⅓');
    expect(formatQuantity(2, 'cup')).toBe('2');
    expect(formatQuantity(1.35, 'kg')).toBe('1.35');
    expect(formatQuantity(0.4, 'cup')).toBe('0.4');
  });
});

describe('addDualMeasurements', () => {
  it('adds the other system after temperatures', () => {
    expect(addDualMeasurements('Bake at 180°C for 25 minutes.')).toBe(
      'Bake at 180°C (350°F) for 25 minutes.',
    );
    expect(addDualMeasurements('Preheat the oven to 425°F.')).toBe(
      'Preheat the oven to 425°F (220°C).',
    );
    expect(addDualMeasurements('Heat to 180-200°C')).toBe('Heat to 180-200°C (350–400°F)');
    expect(addDualMeasurements('Heat to 350 degrees F')).toBe('Heat to 350 degrees F (180°C)');
  });

  it('adds the other system after lengths', () => {
    expect(addDualMeasurements('Cut into 2 cm cubes.')).toBe('Cut into 2 cm (¾ in) cubes.');
    expect(addDualMeasurements('Slice into 1-inch pieces.')).toBe(
      'Slice into 1-inch (2.5 cm) pieces.',
    );
    expect(addDualMeasurements('Roll to 5mm thick')).toBe('Roll to 5mm (¼ in) thick');
  });

  it('is idempotent and leaves already-paired values alone', () => {
    const once = addDualMeasurements('Bake at 180°C, then cut into 2 cm cubes.');
    expect(addDualMeasurements(once)).toBe(once);
    expect(addDualMeasurements('Bake at 180°C (350°F).')).toBe('Bake at 180°C (350°F).');
    expect(addDualMeasurements('Bake at 350°F (180°C).')).toBe('Bake at 350°F (180°C).');
  });

  it('inserts before an unrelated parenthetical', () => {
    expect(addDualMeasurements('Cut 2 cm (about dice-sized) cubes')).toBe(
      'Cut 2 cm (¾ in) (about dice-sized) cubes',
    );
  });

  it('does not touch durations, counts, or the word "in"', () => {
    const text = 'Cook 2 in a pan for 10 minutes with 3 eggs.';
    expect(addDualMeasurements(text)).toBe(text);
  });
});
