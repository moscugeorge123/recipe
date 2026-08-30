import type { RecipeStepView, RecipeView } from '@/features/recipes/types';

export type PlanStage = {
  name: string;
  mins: number;
  rows: { label: string; time: string | null }[];
};

function mmss(seconds: number): string {
  const m = Math.floor(seconds / 60);
  return `${m}:${String(seconds % 60).padStart(2, '0')}`;
}

export function planRecipe(recipe: RecipeView): {
  stages: PlanStage[];
  totalMin: number;
} {
  const order: RecipeStepView['stage'][] = [];
  recipe.steps.forEach((step) => {
    if (!order.includes(step.stage)) {
      order.push(step.stage);
    }
  });

  const raw = order.map((name) => {
    const rows = recipe.steps.filter((step) => step.stage === name);
    const secs = rows.reduce(
      (sum, step) => sum + (step.durationSeconds ?? 0),
      0,
    );
    return { name, rows, weight: secs || rows.length * 90 };
  });
  const totalWeight = raw.reduce((sum, stage) => sum + stage.weight, 0) || 1;
  const total = recipe.minutes;
  let assigned = 0;
  const withFloor = raw.map((stage) => {
    const exact = (stage.weight / totalWeight) * total;
    const mins = Math.max(1, Math.floor(exact));
    assigned += mins;
    return { name: stage.name, exact, mins };
  });
  let remainder = total - assigned;
  const byRemainder = [...withFloor].sort(
    (a, b) => b.exact - Math.floor(b.exact) - (a.exact - Math.floor(a.exact)),
  );
  for (let i = 0; i < byRemainder.length && remainder > 0; i += 1) {
    const row = byRemainder[i];
    if (row) {
      row.mins += 1;
      remainder -= 1;
    }
  }

  const stages = raw.map((stage) => {
    const mins = withFloor.find((item) => item.name === stage.name)?.mins ?? 1;
    return {
      name: stage.name,
      mins,
      rows: stage.rows.map((step) => ({
        label: step.instruction,
        time: step.durationSeconds ? mmss(step.durationSeconds) : null,
      })),
    };
  });

  return { stages, totalMin: total };
}

export function formatQty(
  quantity: number | null,
  unit: string | null,
  multiplier = 1,
): string {
  if (quantity === null) {
    return unit ?? '';
  }
  const value = Math.round(quantity * multiplier * 10) / 10;
  const text = Number.isInteger(value) ? String(value) : String(value);
  return unit ? `${text} ${unit}` : text;
}
