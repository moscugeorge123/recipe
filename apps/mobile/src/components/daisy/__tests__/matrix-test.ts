import { affine, translate } from '@/components/daisy/matrix';

function apply(matrix: number[], x: number, y: number): [number, number] {
  const [a, b, c, d, tx, ty] = matrix as [
    number,
    number,
    number,
    number,
    number,
    number,
  ];
  return [a * x + c * y + tx, b * x + d * y + ty];
}

describe('affine', () => {
  test('a neutral pose is the identity matrix', () => {
    affine(0, 0, 0, 1, 1, 130, 127).forEach((value, index) => {
      expect(value).toBeCloseTo([1, 0, 0, 1, 0, 0][index] as number);
    });
  });

  test('rotation leaves the pivot in place', () => {
    const matrix = affine(0, 0, 25, 1, 1, 184, 192);
    const [x, y] = apply(matrix, 184, 192);

    expect(x).toBeCloseTo(184);
    expect(y).toBeCloseTo(192);
  });

  test('scaling leaves the pivot in place', () => {
    const matrix = affine(0, 0, 0, 1.015, 1.035, 130, 220);
    const [x, y] = apply(matrix, 130, 220);

    expect(x).toBeCloseTo(130);
    expect(y).toBeCloseTo(220);
  });

  test('breathing lifts the head without moving the hem', () => {
    const matrix = affine(0, 0, 0, 1.015, 1.035, 130, 220);
    const [, hem] = apply(matrix, 130, 220);
    const [, crown] = apply(matrix, 130, 46);

    expect(hem).toBeCloseTo(220);
    expect(crown).toBeLessThan(46);
  });

  test('a 90 degree turn maps the x axis onto the y axis', () => {
    const [a, b, c, d] = affine(0, 0, 90, 1, 1, 0, 0);

    expect(a).toBeCloseTo(0);
    expect(b).toBeCloseTo(1);
    expect(c).toBeCloseTo(-1);
    expect(d).toBeCloseTo(0);
  });

  test('translation is applied after the pivot maths', () => {
    expect(apply(affine(5, -7, 0, 1, 1, 130, 127), 130, 127)).toEqual([
      135, 120,
    ]);
    expect(translate(0, -24)).toEqual([1, 0, 0, 1, 0, -24]);
  });
});
