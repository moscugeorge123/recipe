import { parsePantryText as splitPantryText } from '@recipe/contracts';

import { normalizeUnit, parseQuantity } from '../../normalization/domain/units.js';

export interface ParsedPantryLine {
  index: number;
  rawText: string;
  remainder: string;
  quantity: number | null;
  unit: string | null;
}

const LEADING_QUANTITY =
  /^(?<qty>\d+(?:[./]\d+)?)\s*(?<unit>g|kg|ml|l|cups?|tbsp|tsp|oz|lbs?|cloves?|pinch|handful)?\s+(?<name>.+)$/iu;

export function parsePantryText(text: string): ParsedPantryLine[] {
  return splitPantryText(text).map((rawText, index) => {
    const match = LEADING_QUANTITY.exec(rawText);
    const name = match?.groups?.['name']?.trim() ?? rawText;
    const qtyRaw = match?.groups?.['qty'];
    const unitRaw = match?.groups?.['unit'];
    return {
      index,
      rawText,
      remainder: name,
      quantity: qtyRaw ? parseQuantity(qtyRaw) : null,
      unit: unitRaw ? normalizeUnit(unitRaw) : null,
    };
  });
}

export function estimateTokenCount(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}
