export function colorFor(intensity: number): string {
  if (intensity < 80) return '#059669';
  if (intensity < 150) return '#34d399';
  if (intensity < 250) return '#fbbf24';
  return '#f97316';
}
