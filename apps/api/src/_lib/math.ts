export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

export const clamp01 = (value: number): number => clamp(value, 0, 1);

export const round = (value: number, decimals: number): number => {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
};
