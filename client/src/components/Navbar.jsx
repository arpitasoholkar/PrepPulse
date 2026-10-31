import React from 'react';
import { Link, NavLink } from 'react-router-dom';
import { LayoutDashboard, MessageSquareText, Code2, Brain, UserRound, ArrowUpRight, Flame } from 'lucide-react';
import { useActivity } from '../context/ActivityContext.jsx';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/mentor', label: 'Mentor', icon: MessageSquareText },
  { to: '/practice', label: 'Practice', icon: Code2 },
  { to: '/vault', label: 'Memory Vault', icon: Brain },
  { to: '/profile', label: 'Profile', icon: UserRound },
];

// Waveform mark inside a round badge, like the logo in the reference.
function Logo() {
  const bars = [8, 14, 22, 14, 18, 10];
  return (
    <Link to="/" aria-label="IntelliPrep home" className="flex items-center gap-3 px-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F28A52] rounded-full">
      <span className="grid place-items-center w-11 h-11 rounded-full bg-white">
        <svg width="26" height="24" viewBox="0 0 26 24" fill="none" aria-hidden="true">
          {bars.map((h, i) => (
            <rect key={i} x={2 + i * 4} y={12 - h / 2} width="2.4" height={h} rx="1.2" fill={i % 2 ? '#7652C8' : '#251D35'} />
          ))}
        </svg>
      </span>
      <span className="text-[26px] font-extrabold tracking-tight text-white">IntelliPrep</span>
    </Link>
  );
}

// Streak card at the bottom of the sidebar: dark glass card, orange flame, violet arrow.
function StreakCard() {
  const { summary } = useActivity();
  const streak = summary?.streak?.current ?? 0;
  const doneToday = summary?.streak?.activeToday;
  return (
    <div className="relative z-10 mt-auto rounded-[24px] bg-white/[0.07] border border-white/10 p-4 text-white">
      <Link
        to="/practice"
        aria-label="Practice now"
        className="absolute -top-4 right-4 grid place-items-center w-10 h-10 rounded-full bg-[#7652C8] text-white shadow-lg hover:brightness-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <ArrowUpRight className="w-5 h-5" />
      </Link>
      <div className="flex items-center gap-3">
        <span className="grid place-items-center w-11 h-11 rounded-full bg-[#F28A52]">
          <Flame className="w-6 h-6 text-white" />
        </span>
        <div className="leading-tight">
          <p className="text-2xl font-extrabold">{streak}<span className="text-base font-bold ml-1">day{streak === 1 ? '' : 's'}</span></p>
          <p className="text-xs font-medium text-white/60">learning streak</p>
        </div>
      </div>
      <p className="mt-3 text-sm font-medium leading-snug text-white/90">
        {doneToday ? 'Streak secured for today. Nice work.' : 'Solve a question or ask the mentor to keep it alive.'}
      </p>
    </div>
  );
}

// Soft purple wave behind the streak card
function SidebarWave() {
  return (
    <svg className="pointer-events-none absolute inset-x-0 bottom-0 w-full h-[55%]" viewBox="0 0 300 300" preserveAspectRatio="none" aria-hidden="true">
      <path d="M0 120 C70 60 130 40 200 90 C250 125 280 110 300 90 L300 300 L0 300 Z" fill="#7652C8" fillOpacity="0.22" />
      <path d="M0 190 C60 150 140 140 210 175 C255 197 280 190 300 180 L300 300 L0 300 Z" fill="#7652C8" fillOpacity="0.22" />
    </svg>
  );
}

export default function Navbar() {
  return (
    <>
      {/* Desktop: dark sidebar */}
      <aside className="hidden lg:flex flex-col w-[17rem] xl:w-[18rem] shrink-0 lg:sticky lg:top-3 h-[calc(100vh-3.5rem)] rounded-[36px] bg-[#251D35] p-4 xl:p-5 text-white relative overflow-hidden">
        <SidebarWave />
        <Logo />

        <nav aria-label="Main" className="relative z-10 mt-6 flex flex-col gap-1.5">
          {NAV.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `side-link focus:outline-none focus-visible:ring-2 focus-visible:ring-[#EAE1F7] ${isActive ? 'side-link-active' : ''}`
              }
            >
              <Icon className="w-[22px] h-[22px]" strokeWidth={1.8} />
              {label}
            </NavLink>
          ))}
        </nav>

        <StreakCard />
      </aside>

      {/* Mobile: floating dark bar */}
      <nav
        aria-label="Main"
        className="lg:hidden fixed bottom-3 inset-x-3 z-40 flex items-center justify-around rounded-full bg-[#251D35] px-2 py-2 shadow-2xl pb-[calc(0.5rem+env(safe-area-inset-bottom))]"
      >
        {NAV.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} aria-label={label} title={label}>
            {({ isActive }) => (
              <span className={`grid place-items-center w-12 h-12 rounded-full transition ${isActive ? 'bg-[#EAE1F7] text-[#7652C8]' : 'text-white/80 hover:bg-white/10'}`}>
                <Icon className="w-5 h-5" />
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
