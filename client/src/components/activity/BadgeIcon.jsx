import React from 'react';
import {
  Footprints, CircleCheck, Puzzle, Cpu, Flame, Clock, Timer, MessageCircle, Award, Crown, Lock,
} from 'lucide-react';

const ICONS = {
  footprints: Footprints,
  'circle-check': CircleCheck,
  puzzle: Puzzle,
  cpu: Cpu,
  flame: Flame,
  clock: Clock,
  timer: Timer,
  'message-circle': MessageCircle,
  award: Award,
  crown: Crown,
};

const TIERS = {
  bronze: { bg: '#fde3d6', fg: '#9a4d1f', label: 'Bronze' },
  silver: { bg: '#EAE1F7', fg: '#5B3E9E', label: 'Silver' },
  gold: { bg: '#f6f0a8', fg: '#7a6200', label: 'Gold' },
};

export const tierInfo = (tier) => TIERS[tier] || TIERS.bronze;

/** Round badge tile. Locked badges are grey with a small lock. */
export default function BadgeIcon({ icon, tier, earned = true, size = 'w-12 h-12', iconSize = 'w-5 h-5' }) {
  const Icon = ICONS[icon] || Award;
  const t = tierInfo(tier);
  return (
    <span
      className={`relative grid place-items-center shrink-0 rounded-2xl ${size}`}
      style={earned ? { background: t.bg, color: t.fg } : { background: '#efeff4', color: '#a3a3b8' }}
      aria-hidden="true"
    >
      <Icon className={iconSize} />
      {!earned && (
        <span className="absolute -right-1 -bottom-1 grid place-items-center w-5 h-5 rounded-full bg-white border border-[#ececf2]">
          <Lock className="w-3 h-3 text-[#8a8aa3]" />
        </span>
      )}
    </span>
  );
}
