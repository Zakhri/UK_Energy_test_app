import { ChevronDown } from 'lucide-react';
import type { RegionCode } from '@uk-energy/shared';

import { REGION_OPTIONS } from './_lib/regionOptions.js';

interface RegionPickerProps {
  region: RegionCode;
  onChange: (region: RegionCode) => void;
}

export function RegionPicker({ region, onChange }: RegionPickerProps) {
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">Region</span>
      <select
        value={region}
        onChange={(event) => onChange(event.target.value as RegionCode)}
        className="appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-3.5 pr-9 text-xs font-medium text-slate-700 shadow-soft transition hover:border-slate-300 focus:border-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/15"
      >
        {REGION_OPTIONS.map((option) => (
          <option key={option.code} value={option.code}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 h-3.5 w-3.5 text-slate-400" />
    </label>
  );
}
