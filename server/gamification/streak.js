// Pure date and streak helpers (no database), so they are easy to test.

export const QUALIFY_SECONDS = 300; // 5 minutes in the app counts as a learning day

/** Local calendar day "YYYY-MM-DD" for a client offset (Date#getTimezoneOffset, minutes). */
export function dayKey(tzOffsetMin = 0, now = new Date()) {
  return new Date(now.getTime() - tzOffsetMin * 60000).toISOString().slice(0, 10);
}

/** Add `n` days (can be negative) to a "YYYY-MM-DD" key. */
export function addDays(key, n) {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** 0 = Sunday ... 6 = Saturday */
export function weekday(key) {
  return new Date(`${key}T00:00:00Z`).getUTCDay();
}

/** A day counts toward the streak when the user did something real. */
export function dayQualifies(a) {
  return (a.attempts || 0) + (a.chats || 0) > 0 || (a.seconds || 0) >= QUALIFY_SECONDS;
}

/**
 * @param {Set<string>|string[]} qualifyingDays  days that count
 * @param {string} today                         "YYYY-MM-DD"
 * @returns {{current:number, longest:number, activeToday:boolean}}
 * The current streak stays alive until the end of today if yesterday was active.
 */
export function computeStreaks(qualifyingDays, today) {
  const set = qualifyingDays instanceof Set ? qualifyingDays : new Set(qualifyingDays);
  const activeToday = set.has(today);

  let current = 0;
  let cursor = activeToday ? today : addDays(today, -1);
  while (set.has(cursor)) {
    current += 1;
    cursor = addDays(cursor, -1);
  }

  const sorted = [...set].sort();
  let longest = 0;
  let run = 0;
  let prev = null;
  for (const d of sorted) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = d;
  }
  return { current, longest: Math.max(longest, current), activeToday };
}
