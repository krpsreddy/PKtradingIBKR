const MARKET_TZ = 'America/New_York';
const MARKET_CLOSE_HOUR = 16;

/** yyyy-MM-dd for the most recent completed US equity session (ET). */
export function lastTradingDayIso(reference = new Date()): string {
  const et = toEtParts(reference);
  let { year, month, day, weekday, hour } = et;

  if (weekday === 0) {
    day -= 2;
  } else if (weekday === 6) {
    day -= 1;
  } else if (hour < MARKET_CLOSE_HOUR) {
    ({ year, month, day } = previousTradingDayParts(year, month, day));
  }

  return formatIsoDate(year, month, day);
}

function toEtParts(date: Date): {
  year: number;
  month: number;
  day: number;
  weekday: number;
  hour: number;
} {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: MARKET_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    hour12: false
  }).formatToParts(date);

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find(p => p.type === type)?.value ?? '';

  const weekdayMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6
  };

  return {
    year: Number(get('year')),
    month: Number(get('month')),
    day: Number(get('day')),
    weekday: weekdayMap[get('weekday')] ?? 0,
    hour: Number(get('hour'))
  };
}

function previousTradingDayParts(year: number, month: number, day: number): {
  year: number;
  month: number;
  day: number;
} {
  const d = new Date(Date.UTC(year, month - 1, day));
  do {
    d.setUTCDate(d.getUTCDate() - 1);
  } while (d.getUTCDay() === 0 || d.getUTCDay() === 6);
  return {
    year: d.getUTCFullYear(),
    month: d.getUTCMonth() + 1,
    day: d.getUTCDate()
  };
}

function formatIsoDate(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
