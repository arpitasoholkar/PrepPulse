import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Plus } from 'lucide-react';
import UserMenu from './UserMenu.jsx';

const PAGES = {
  '/dashboard': { title: 'Overview', subtitle: 'Your mastery at a glance' },
  '/mentor': { title: 'Mentor', subtitle: 'Ask anything. It remembers how you learn.' },
  '/practice': { title: 'Practice', subtitle: 'Solve a question and the mentor learns from your mistakes' },
  '/vault': { title: 'Memory Vault', subtitle: 'Everything the mentor remembers about you' },
};

export default function Header() {
  const { pathname } = useLocation();
  const page = PAGES[pathname] || { title: 'IntelliPrep', subtitle: '' };

  return (
    <header className="glass rounded-[32px] flex items-center gap-4 px-5 lg:px-8 h-[72px] lg:h-[88px]">
      <div className="min-w-0 flex-1">
        <h1 className="text-2xl lg:text-4xl font-black tracking-tight text-white truncate">{page.title}</h1>
        {page.subtitle && <p className="hidden lg:block text-sm text-slate-400 truncate">{page.subtitle}</p>}
      </div>

      <UserMenu />

      <Link
        to="/mentor"
        state={{ newSession: Date.now() }}
        aria-label="New mentor chat"
        title="New mentor chat"
        className="hidden sm:grid place-items-center w-12 h-12 rounded-full border border-white/15 bg-white/5 text-white hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 transition"
      >
        <Plus className="w-5 h-5" />
      </Link>
    </header>
  );
}
