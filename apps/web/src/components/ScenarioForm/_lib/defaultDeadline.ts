export function defaultDeadline(): string {
  const tomorrow = new Date(Date.now() + 24 * 3600 * 1000);
  tomorrow.setHours(7, 0, 0, 0);
  const pad = (value: number): string => String(value).padStart(2, '0');

  return (
    `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(tomorrow.getDate())}` +
    `T${pad(tomorrow.getHours())}:${pad(tomorrow.getMinutes())}`
  );
}
