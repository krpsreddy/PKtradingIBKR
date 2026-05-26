/** US equity regular session (ET) — lightweight client schedule, no holiday calendar. */

export function isUsMarketOpen(now = new Date()): boolean {
  const et = easternParts(now);
  if (et.weekday === 0 || et.weekday === 6) return false;
  const mins = et.hour * 60 + et.minute;
  return mins >= 9 * 60 + 30 && mins < 16 * 60;
}

export function minutesUntilUsMarketOpen(now = new Date()): number {
  if (isUsMarketOpen(now)) return 0;
  const et = easternParts(now);
  if (et.weekday === 0 || et.weekday === 6) return 24 * 60;
  const openMins = 9 * 60 + 30;
  const mins = et.hour * 60 + et.minute;
  if (mins < openMins) return openMins - mins;
  return 24 * 60 - mins + openMins;
}

export function sessionDayKey(now = new Date()): string {
  const et = easternParts(now);
  return `${et.year}-${et.month}-${et.day}`;
}

function easternParts(d: Date): { year: number; month: number; day: number; hour: number; minute: number; weekday: number } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hour12: false
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '0';
  const wd = get('weekday');
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd);
  return {
    year: parseInt(get('year'), 10),
    month: parseInt(get('month'), 10),
    day: parseInt(get('day'), 10),
    hour: parseInt(get('hour'), 10),
    minute: parseInt(get('minute'), 10),
    weekday: weekday >= 0 ? weekday : 0
  };
}
