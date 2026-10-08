import { Unit } from '@pantrio/shared';

/** Convert quantity into a comparable base for the same measurement family. */
export function toBaseQuantity(quantity: number, unit: string): {
  family: 'weight' | 'volume' | 'count';
  base: number;
  baseUnit: Unit;
} | null {
  const u = unit.trim().toLowerCase();
  switch (u) {
    case Unit.G:
      return { family: 'weight', base: quantity, baseUnit: Unit.G };
    case Unit.KG:
      return { family: 'weight', base: quantity * 1000, baseUnit: Unit.G };
    case Unit.ML:
      return { family: 'volume', base: quantity, baseUnit: Unit.ML };
    case Unit.L:
      return { family: 'volume', base: quantity * 1000, baseUnit: Unit.ML };
    case Unit.PCS:
      return { family: 'count', base: quantity, baseUnit: Unit.PCS };
    default:
      return null;
  }
}

export function fromBaseQuantity(
  base: number,
  targetUnit: string,
): number | null {
  const u = targetUnit.trim().toLowerCase();
  switch (u) {
    case Unit.G:
    case Unit.ML:
    case Unit.PCS:
      return base;
    case Unit.KG:
    case Unit.L:
      return base / 1000;
    default:
      return null;
  }
}

export function convertQuantity(
  quantity: number,
  fromUnit: string,
  toUnit: string,
): number | null {
  const from = toBaseQuantity(quantity, fromUnit);
  const oneTarget = toBaseQuantity(1, toUnit);
  if (!from || !oneTarget || from.family !== oneTarget.family) {
    return null;
  }
  return from.base / oneTarget.base;
}

export function sameFamily(a: string, b: string): boolean {
  const left = toBaseQuantity(1, a);
  const right = toBaseQuantity(1, b);
  return Boolean(left && right && left.family === right.family);
}
