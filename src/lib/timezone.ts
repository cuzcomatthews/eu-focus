export const TIMEZONE = 'America/Guayaquil';

export function formatGuayaquilDate(date: Date = new Date()): string {
  return date.toLocaleDateString('es-EC', { timeZone: TIMEZONE });
}

export function getGuayaquilHour(date: Date = new Date()): number {
  return parseInt(
    date.toLocaleString('es-EC', { timeZone: TIMEZONE, hour: '2-digit', hour12: false }),
    10
  );
}

export function getTodayString(date: Date = new Date()): string {
  const parts = date
    .toLocaleDateString('es-EC', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
    .split('/');
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

export function isToday(date: Date, target: string): boolean {
  const t = new Date(target);
  const d = new Date(date);
  return (
    t.getUTCFullYear() === d.getUTCFullYear() &&
    t.getUTCMonth() === d.getUTCMonth() &&
    t.getUTCDate() === d.getUTCDate()
  );
}