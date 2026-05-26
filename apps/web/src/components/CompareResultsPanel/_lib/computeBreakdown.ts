export type AxisRank = 'best' | 'middle' | 'worst' | 'only';

export interface RankedAxis {
  readonly rank: AxisRank;

  readonly value: number;
}

export interface RowBreakdown {
  readonly carbon: RankedAxis;

  readonly cost: RankedAxis | undefined;
}

interface RankedSeed {
  readonly scenarioId: string;
  readonly expectedCarbonGCo2: number;
  readonly expectedCostPounds?: number;
}

export interface RangeContext {
  readonly carbon: { min: number; max: number; count: number };
  readonly cost: { min: number; max: number; count: number } | undefined;
}

export function computeRangeContext(rows: readonly RankedSeed[]): RangeContext {
  const carbons = rows.map((row) => row.expectedCarbonGCo2);
  const carbonCtx = {
    min: Math.min(...carbons),
    max: Math.max(...carbons),
    count: rows.length,
  };

  const costs = rows
    .map((row) => row.expectedCostPounds)
    .filter((value): value is number => typeof value === 'number');
  const costCtx =
    costs.length === 0
      ? undefined
      : { min: Math.min(...costs), max: Math.max(...costs), count: costs.length };

  return { carbon: carbonCtx, cost: costCtx };
}

function rankOnAxis(value: number, ctx: { min: number; max: number; count: number }): AxisRank {
  if (ctx.count <= 1) return 'only';
  const range = ctx.max - ctx.min;
  if (range === 0) return 'only';
  const tolerance = range * 0.05;
  if (value <= ctx.min + tolerance) return 'best';
  if (value >= ctx.max - tolerance) return 'worst';
  return 'middle';
}

export function computeRowBreakdown(row: RankedSeed, ctx: RangeContext): RowBreakdown {
  const carbon: RankedAxis = {
    rank: rankOnAxis(row.expectedCarbonGCo2, ctx.carbon),
    value: row.expectedCarbonGCo2,
  };
  const cost: RankedAxis | undefined =
    ctx.cost && typeof row.expectedCostPounds === 'number'
      ? {
          rank: rankOnAxis(row.expectedCostPounds, ctx.cost),
          value: row.expectedCostPounds,
        }
      : undefined;
  return { carbon, cost };
}
