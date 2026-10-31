/** 75 -> "1h 15 min", 45 -> "45 min", 120 -> "2h" */
export function formatMinutes(min) {
  const m = Math.max(0, Math.round(min || 0));
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (h && r) return `${h}h ${r} min`;
  if (h) return `${h}h`;
  return `${r} min`;
}

/** 1234 minutes -> "20.6" hours */
export function hoursFromMinutes(min) {
  const h = (min || 0) / 60;
  return h >= 10 ? String(Math.round(h)) : (Math.round(h * 10) / 10).toString();
}

export function prettyDate(key) {
  if (!key) return '';
  const d = new Date(`${key}T00:00:00`);
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function prettyTopic(t) {
  return String(t || '').replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function prettyQuestion(id) {
  return String(id || '').replace(/[_-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
