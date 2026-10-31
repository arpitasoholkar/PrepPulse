// Shared colour map for memory types and explanation styles.
// Full class names are written out so Tailwind can detect them.
export const MEMORY_TYPE_STYLES = {
  strength: {
    label: 'Strength',
    chip: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/30',
    bar: 'bg-emerald-400',
    edge: 'border-l-emerald-400',
  },
  weakness: {
    label: 'Weakness',
    chip: 'bg-rose-400/10 text-rose-300 border-rose-400/30',
    bar: 'bg-rose-400',
    edge: 'border-l-rose-400',
  },
  mistake: {
    label: 'Mistake',
    chip: 'bg-amber-400/10 text-amber-300 border-amber-400/30',
    bar: 'bg-amber-400',
    edge: 'border-l-amber-400',
  },
  learning_preference: {
    label: 'Learning preference',
    chip: 'bg-sky-400/10 text-sky-300 border-sky-400/30',
    bar: 'bg-sky-400',
    edge: 'border-l-sky-400',
  },
  concept_understood: {
    label: 'Understood concept',
    chip: 'bg-teal-400/10 text-teal-300 border-teal-400/30',
    bar: 'bg-teal-400',
    edge: 'border-l-teal-400',
  },
  revision_needed: {
    label: 'Revision needed',
    chip: 'bg-violet-400/10 text-violet-300 border-violet-400/30',
    bar: 'bg-violet-400',
    edge: 'border-l-violet-400',
  },
};

export const FALLBACK_TYPE_STYLE = {
  label: 'Memory',
  chip: 'bg-white/10 text-slate-300 border-white/15',
  bar: 'bg-slate-400',
  edge: 'border-l-slate-400',
};

export const getTypeStyle = (type) => MEMORY_TYPE_STYLES[type] || FALLBACK_TYPE_STYLE;

export const STYLE_BADGES = {
  theory: { label: 'Theory', chip: 'bg-white/10 text-slate-200 border-white/20' },
  simple: { label: 'Simple', chip: 'bg-sky-400/10 text-sky-300 border-sky-400/30' },
  example: { label: 'Worked example', chip: 'bg-rose-400/10 text-rose-300 border-rose-400/30' },
  analogy: { label: 'Analogy', chip: 'bg-amber-400/10 text-amber-300 border-amber-400/30' },
  visual: { label: 'Visual', chip: 'bg-violet-400/10 text-violet-300 border-violet-400/30' },
  dry_run: { label: 'Dry run', chip: 'bg-emerald-400/10 text-emerald-300 border-emerald-400/30' },
};

export const getStyleBadge = (style) =>
  STYLE_BADGES[style] || { label: style || 'Reply', chip: 'bg-white/10 text-slate-300 border-white/15' };

// Same colours as hex, for charts (recharts, SVG) that cannot use Tailwind classes.
// Keep in sync with MEMORY_TYPE_STYLES above.
export const MEMORY_TYPE_HEX = {
  strength: '#34d399',
  weakness: '#fb7185',
  mistake: '#fbbf24',
  learning_preference: '#38bdf8',
  concept_understood: '#2dd4bf',
  revision_needed: '#a78bfa',
};
