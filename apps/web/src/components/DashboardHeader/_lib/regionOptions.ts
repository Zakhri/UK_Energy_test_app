import type { RegionCode } from '@uk-energy/shared';

export const REGION_OPTIONS: ReadonlyArray<{ code: RegionCode; label: string }> = [
  { code: 'GB-LON', label: 'London' },
  { code: 'GB-SOUTH-EAST-ENGLAND', label: 'South East' },
  { code: 'GB-SOUTH-WEST-ENGLAND', label: 'South West' },
  { code: 'GB-EAST-ENGLAND', label: 'East England' },
  { code: 'GB-WEST-MIDLANDS', label: 'West Midlands' },
  { code: 'GB-NORTH-WEST-ENGLAND', label: 'North West' },
  { code: 'GB-YORKSHIRE', label: 'Yorkshire' },
  { code: 'GB-NORTH-WALES', label: 'North Wales' },
  { code: 'GB-SOUTH-WALES', label: 'South Wales' },
  { code: 'GB-NORTH-SCOTLAND', label: 'North Scotland' },
  { code: 'GB-SOUTH-SCOTLAND', label: 'South Scotland' },
];

export function regionLabelFor(code: RegionCode): string {
  return REGION_OPTIONS.find((option) => option.code === code)?.label ?? code;
}
