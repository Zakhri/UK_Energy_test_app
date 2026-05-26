export interface TickPoint {
  readonly iso: string;
  readonly time: string;
}

export function nearestTick(points: readonly TickPoint[], targetMs: number): string | null {
  if (points.length === 0) return null;
  let closest = points[0];
  let closestDelta = Math.abs(new Date(closest?.iso ?? '').getTime() - targetMs);
  for (const point of points) {
    const delta = Math.abs(new Date(point.iso).getTime() - targetMs);
    if (delta < closestDelta) {
      closest = point;
      closestDelta = delta;
    }
  }
  return closest?.iso ?? null;
}
