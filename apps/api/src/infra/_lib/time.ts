export const isoMinute = (date: Date = new Date()): string => date.toISOString().slice(0, 16);

export const isoDay = (date: Date = new Date()): string => date.toISOString().slice(0, 10);

export const floorToBucket = (bucketMinutes: number, date: Date = new Date()): string => {
  const flooredMinute = Math.floor(date.getUTCMinutes() / bucketMinutes) * bucketMinutes;
  const bucket = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      date.getUTCHours(),
      flooredMinute,
    ),
  );
  return bucket.toISOString();
};
