export function friendlyHeadline(level: string | null): string {
  switch (level) {
    case 'very low':
      return 'Ultra-low impact window now';
    case 'low':
      return 'Low-carbon window now';
    case 'moderate':
      return 'Moderate impact right now';
    case 'high':
      return 'High-carbon window — wait if you can';
    case 'very high':
      return 'Peak carbon — delay if possible';
    default:
      return 'Grid status';
  }
}
