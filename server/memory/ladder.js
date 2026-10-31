// server/memory/ladder.js  (Owner: C)
// The explanation ladder: each time the student says "I didn't understand",
// we move to the next teaching style.
//   Step 0: saved preferred style (if any), else theory
//   Step 1: simple
//   Step 2: preferred style or visual
//   Step 3: analogy or dry_run

const STYLE_LABEL = {
  theory: 'a theory explanation',
  simple: 'a simple explanation',
  analogy: 'an analogy',
  visual: 'a visual',
  dry_run: 'a step-by-step dry run',
};

const FALLBACK_ORDER = ['analogy', 'dry_run', 'visual', 'theory', 'simple'];

// Looks through the retrieved memories for the best learning_preference
function pickPreferred(memoriesUsed) {
  const prefs = (memoriesUsed || [])
    .map((x) => x.memory || x)
    .filter((m) => m.type === 'learning_preference' && m.meta && m.meta.style);
  if (prefs.length === 0) return null;
  prefs.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
  return prefs[0];
}

function whereItWorked(mem, topic) {
  if (mem.topic === '*') return 'across your topics';
  if (mem.topic === topic) return `on ${topic}`;
  return `on ${mem.topic}`;
}

// First message of a question
function startLadder(topic, memoriesUsed) {
  const pref = pickPreferred(memoriesUsed);
  const style = pref ? pref.meta.style : 'theory';
  const reason = pref
    ? `Started with ${STYLE_LABEL[style] || style} because it worked for you ${whereItWorked(pref, topic)}`
    : 'No saved preference yet, starting with a theory explanation';
  return { ladder: { topic: topic || null, step: 0, stylesTried: [style] }, style, reason };
}

// After "I didn't understand"
function nextStep(ladder, memoriesUsed) {
  const pref = pickPreferred(memoriesUsed);
  const preferred = pref ? pref.meta.style : null;
  const tried = ladder.stylesTried || [];
  const step = (ladder.step || 0) + 1;

  let wanted;
  if (step === 1) wanted = ['simple'];
  else if (step === 2) wanted = [preferred, 'visual'];
  else wanted = ['analogy', 'dry_run'];

  const candidates = wanted.filter(Boolean).concat(FALLBACK_ORDER);
  const style = candidates.find((s) => !tried.includes(s)) || 'dry_run';

  let reason = `Switched to ${STYLE_LABEL[style] || style} because the last explanation did not land`;
  if (pref && style === preferred) {
    reason = `Switched to ${STYLE_LABEL[style]} because it worked for you ${whereItWorked(pref, ladder.topic)}`;
  }

  return {
    ladder: { topic: ladder.topic, step, stylesTried: [...tried, style] },
    style,
    reason,
  };
}

export { startLadder, nextStep, pickPreferred, STYLE_LABEL };