import type { AdviceGoalCode } from '@uk-energy/shared';

const GOAL_LABEL: Record<AdviceGoalCode, string> = {
  'ev-charge': 'EV charging',
  'heat-pump': 'Heat pump',
  'high-usage-appliance': 'Appliance',
  'battery-storage': 'Home battery',
  general: 'General',
};

export function goalLabel(goal: AdviceGoalCode): string {
  return GOAL_LABEL[goal] ?? goal;
}

export function relativeTime(isoTimestamp: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(isoTimestamp).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}
