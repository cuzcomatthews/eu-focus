export const TIMEZONE = 'America/Guayaquil';

export function getGuayaquilNow(): Date {
  return new Date();
}

export function getGuayaquilHour(date: Date = new Date()): number {
  return parseInt(
    date.toLocaleString('es-EC', { timeZone: TIMEZONE, hour: '2-digit', hour12: false }),
    10
  );
}

export function getCurrentGuayaquilTime(): string {
  const now = new Date();
  const h = getGuayaquilHour(now).toString().padStart(2, '0');
  const m = parseInt(
    now.toLocaleString('es-EC', { timeZone: TIMEZONE, minute: '2-digit', hour12: false }),
    10
  ).toString().padStart(2, '0');
  return `${h}:${m}`;
}

export function getTodayString(date: Date = new Date()): string {
  const parts = date
    .toLocaleDateString('es-EC', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' })
    .split('/');
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

export function getGuayaquilMidnight(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00-05:00');
}

export function getGuayaquilDayOfWeek(date: Date = new Date()): number {
  const day = date.toLocaleString('es-EC', { timeZone: TIMEZONE, weekday: 'short' });
  const map: Record<string, number> = { 'dom': 0, 'lun': 1, 'mar': 2, 'mié': 3, 'jue': 4, 'vie': 5, 'sáb': 6 };
  return map[day.toLowerCase()] ?? date.getDay();
}

export function getDateForDayOfWeek(targetDayOfWeek: number): string {
  const todayStr = getTodayString();
  const todayParts = todayStr.split('-').map(Number);
  const todayDate = new Date(todayParts[0], todayParts[1] - 1, todayParts[2]);
  const currentDay = todayDate.getDay();
  const diff = targetDayOfWeek - currentDay;
  const target = new Date(todayDate);
  target.setDate(todayDate.getDate() + diff);
  return target.toISOString().split('T')[0];
}

export function getLabelForDayOfWeek(dayOfWeek: number): string {
  const labels = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  return labels[dayOfWeek] || '';
}

export function getDateOfWeekOfDay(dayOfWeek: number): number {
  const todayStr = getTodayString();
  const todayParts = todayStr.split('-').map(Number);
  const todayDate = new Date(todayParts[0], todayParts[1] - 1, todayParts[2]);
  const currentDay = todayDate.getDay();
  const diff = dayOfWeek - currentDay;
  const target = new Date(todayDate);
  target.setDate(todayDate.getDate() + diff);
  return target.getDate();
}