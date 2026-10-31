// Badge catalogue. `metric` is a key of the stats object built in service.js,
// `target` is the value needed to earn it. Pure data, safe to import anywhere.

export const BADGES = [
  { key: 'first_steps',  name: 'First Steps',     description: 'Submit your first solution',         icon: 'footprints', tier: 'bronze', metric: 'attempts',     target: 1 },
  { key: 'first_pass',   name: 'Green Light',     description: 'Pass your first question',           icon: 'circle-check', tier: 'bronze', metric: 'passes',     target: 1 },
  { key: 'solver_5',     name: 'Problem Solver',  description: 'Pass 5 questions',                   icon: 'puzzle',     tier: 'silver', metric: 'passes',       target: 5 },
  { key: 'solver_25',    name: 'Code Machine',    description: 'Pass 25 questions',                  icon: 'cpu',        tier: 'gold',   metric: 'passes',       target: 25 },
  { key: 'streak_3',     name: 'On a Roll',       description: 'Keep a 3 day streak',                icon: 'flame',      tier: 'bronze', metric: 'bestStreak',   target: 3 },
  { key: 'streak_7',     name: 'Week Warrior',    description: 'Keep a 7 day streak',                icon: 'flame',      tier: 'silver', metric: 'bestStreak',   target: 7 },
  { key: 'streak_30',    name: 'Unstoppable',     description: 'Keep a 30 day streak',               icon: 'flame',      tier: 'gold',   metric: 'bestStreak',   target: 30 },
  { key: 'hours_1',      name: 'Hour One',        description: 'Spend 1 hour learning',              icon: 'clock',      tier: 'bronze', metric: 'minutes',      target: 60 },
  { key: 'hours_10',     name: 'Deep Focus',      description: 'Spend 10 hours learning',            icon: 'timer',      tier: 'gold',   metric: 'minutes',      target: 600 },
  { key: 'mentor_5',     name: 'Curious Mind',    description: 'Ask the mentor 5 questions',         icon: 'message-circle', tier: 'bronze', metric: 'chats',    target: 5 },
  { key: 'topic_master', name: 'Topic Master',    description: 'Reach 70+ mastery in a topic',       icon: 'award',      tier: 'silver', metric: 'strongTopics', target: 1 },
  { key: 'all_rounder',  name: 'All-Rounder',     description: 'Reach 70+ mastery in 5 topics',      icon: 'crown',      tier: 'gold',   metric: 'strongTopics', target: 5 }
];

export const BADGE_BY_KEY = Object.fromEntries(BADGES.map(b => [b.key, b]));
