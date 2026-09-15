const UNITS = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 };

/** Converts a duration such as `7d`, `12h` or `900` (seconds) to milliseconds. */
export default function toMilliseconds(value) {
  if (typeof value === 'number') return value * 1000;
  const match = /^(\d+)\s*([smhdw])?$/i.exec(String(value).trim());
  if (!match) throw new Error(`Invalid duration: ${value}`);
  const amount = Number(match[1]);
  const unit = (match[2] || 's').toLowerCase();
  return amount * UNITS[unit];
}
