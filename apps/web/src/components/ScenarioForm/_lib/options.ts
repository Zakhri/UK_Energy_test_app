import {
  BatteryCharging,
  BatteryFull,
  Flame,
  Leaf,
  Moon,
  PoundSterling,
  Rocket,
  Sparkles,
  WashingMachine,
  type LucideIcon,
} from 'lucide-react';
import type { AdviceGoalCode, PreferenceCode } from '@uk-energy/shared';

export interface GoalOption {
  value: AdviceGoalCode;
  label: string;
  Icon: LucideIcon;
}

export interface PreferenceOption {
  value: PreferenceCode;
  label: string;
  Icon: LucideIcon;
}

export const GOAL_OPTIONS: readonly GoalOption[] = [
  { value: 'ev-charge', label: 'EV charging', Icon: BatteryCharging },
  { value: 'heat-pump', label: 'Heat pump', Icon: Flame },
  { value: 'high-usage-appliance', label: 'Appliance', Icon: WashingMachine },
  { value: 'battery-storage', label: 'Home battery', Icon: BatteryFull },
  { value: 'general', label: 'General', Icon: Sparkles },
];

export const PREFERENCE_OPTIONS: readonly PreferenceOption[] = [
  { value: 'low-carbon', label: 'Low carbon', Icon: Leaf },
  { value: 'low-price', label: 'Low price', Icon: PoundSterling },
  { value: 'avoid-peak', label: 'Avoid peak hours', Icon: Moon },
  { value: 'fast-completion', label: 'Fast completion', Icon: Rocket },
];
